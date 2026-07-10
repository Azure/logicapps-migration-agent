#Requires -Version 5.1
<#
    Refreshes the Prometheus/Thanos bearer token used by the Grafana "Prometheus-Portal"
    datasource. OpenShift service-account tokens are short lived (24h), so the Cluster Pods
    panels break ~24h after each setup run. This script mints a fresh token via `oc` and
    pushes it into the existing Grafana datasource through the Grafana HTTP API.

    It is intended to be run unattended by a Windows Scheduled Task (every few hours and at
    startup). All configuration is read from token-refresh-config.json next to this script,
    so the scheduled task command line never contains secrets.
#>

[CmdletBinding()]
param(
    [string]$ConfigPath
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
    $ConfigPath = Join-Path $scriptDir 'token-refresh-config.json'
}

$logDir = Join-Path $scriptDir 'logs'
$null = New-Item -ItemType Directory -Path $logDir -Force -ErrorAction SilentlyContinue
$logFile = Join-Path $logDir 'prometheus-token-refresh.log'

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $line = '{0} [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
    Write-Host $line
    try { Add-Content -LiteralPath $logFile -Value $line -Encoding utf8 } catch { }
}

try {
    if (-not (Test-Path -LiteralPath $ConfigPath)) {
        throw "Config file not found: $ConfigPath"
    }
    $cfg = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json

    $ocPath        = if ($cfg.OcPath) { $cfg.OcPath } else { 'oc' }
    $grafanaBase   = ($cfg.GrafanaBaseUrl).TrimEnd('/')
    $dsName        = $cfg.DatasourceName
    $promNamespace = if ($cfg.PromNamespace) { $cfg.PromNamespace } else { 'openshift-monitoring' }
    $tokenDuration = if ($cfg.TokenDuration) { $cfg.TokenDuration } else { '24h' }
    $serviceAccts  = if ($cfg.PromServiceAccounts) { @($cfg.PromServiceAccounts) } else { @('prometheus-k8s', 'thanos-querier') }

    # Build common oc args (kubeconfig / context)
    $ocBaseArgs = @()
    if ($cfg.KubeconfigPath -and (Test-Path -LiteralPath $cfg.KubeconfigPath)) { $ocBaseArgs += @('--kubeconfig', $cfg.KubeconfigPath) }
    if ($cfg.KubeContext) { $ocBaseArgs += @('--context', $cfg.KubeContext) }

    # 1) Mint a fresh SA token.
    $token = ''
    foreach ($sa in $serviceAccts) {
        Write-Log "Minting token for service account '$sa' (namespace $promNamespace, duration $tokenDuration)."
        $minted = (& $ocPath @ocBaseArgs -n $promNamespace create token $sa --duration=$tokenDuration 2>$null | Out-String).Trim()
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($minted) -and $minted -notmatch 'error|forbidden|Unauthorized') {
            $token = $minted
            Write-Log "Token minted from '$sa' (length $($token.Length))."
            break
        }
        Write-Log "Could not mint token from '$sa'; trying next." 'WARN'
    }
    if ([string]::IsNullOrWhiteSpace($token)) {
        throw 'Failed to mint a Prometheus token from any configured service account.'
    }

    # 2) Look up the existing datasource by name.
    $auth = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(("{0}:{1}" -f $cfg.GrafanaUser, $cfg.GrafanaPassword)))
    $headers = @{ Authorization = $auth }
    $ds = Invoke-RestMethod -Method GET -Uri ("{0}/api/datasources/name/{1}" -f $grafanaBase, [uri]::EscapeDataString($dsName)) -Headers $headers -TimeoutSec 30
    if (-not $ds -or -not $ds.uid) {
        throw "Datasource '$dsName' not found in Grafana at $grafanaBase."
    }
    Write-Log "Found datasource '$dsName' (uid $($ds.uid))."

    # 3) PUT the datasource back with the fresh bearer token in secureJsonData.
    #    Preserve existing fields; ensure the Authorization custom header is wired.
    $jsonData = if ($ds.jsonData) { $ds.jsonData } else { [pscustomobject]@{} }
    $jsonData | Add-Member -NotePropertyName 'httpHeaderName1' -NotePropertyValue 'Authorization' -Force

    $body = [ordered]@{
        id             = $ds.id
        uid            = $ds.uid
        orgId          = $ds.orgId
        name           = $ds.name
        type           = $ds.type
        access         = $ds.access
        url            = $ds.url
        isDefault      = [bool]$ds.isDefault
        jsonData       = $jsonData
        secureJsonData = @{ httpHeaderValue1 = ("Bearer {0}" -f $token) }
    }

    $null = Invoke-RestMethod -Method PUT -Uri ("{0}/api/datasources/uid/{1}" -f $grafanaBase, $ds.uid) `
        -Headers $headers -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 20 -Compress) -TimeoutSec 30
    Write-Log "Datasource '$dsName' updated with fresh bearer token."

    # 4) Best-effort health probe of the datasource so failures show up in the log.
    try {
        $health = Invoke-RestMethod -Method GET -Uri ("{0}/api/datasources/uid/{1}/health" -f $grafanaBase, $ds.uid) -Headers $headers -TimeoutSec 30
        Write-Log "Datasource health: $($health.status) - $($health.message)"
    } catch {
        Write-Log "Datasource health probe failed (non-fatal): $($_.Exception.Message)" 'WARN'
    }

    Write-Log 'Prometheus token refresh completed successfully.'
    exit 0
}
catch {
    Write-Log "Prometheus token refresh FAILED: $($_.Exception.Message)" 'ERROR'
    exit 1
}
