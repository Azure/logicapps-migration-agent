[CmdletBinding()]
param(
    [string]$SqlServer,
    [string]$SqlDatabase,
    [string]$SqlUser,
    [string]$SqlPassword,
    [string]$LogicAppBaseUrl,
    [string]$MasterKey,
    [string]$PrometheusUrl,
    [string]$PrometheusToken,
    [string]$Namespace,
    [string]$AppName,
    [string]$ResourceGroup,
    [string]$KubeConfigPath,
    [string]$KubeContext,
    [string]$OpenShiftUsername = 'kubeadmin',
    [string]$OpenShiftPassword,
    [string]$OpenShiftToken,
    [bool]$SkipTlsVerify = $true,
    [int]$GrafanaPort = 3000,
    [int]$RunManagerPort = 3001,
    [bool]$UsePortForward = $true,
    [string]$PodSelector,
    [switch]$SkipStart,
    [switch]$NoBrowser
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptRoot = Split-Path -Parent $PSCommandPath
$PortalRoot = Join-Path $ScriptRoot 'grafana-portal'
$ProvisioningRoot = Join-Path $PortalRoot 'provisioning'
$DatasourceRoot = Join-Path $ProvisioningRoot 'datasources'
$DashboardProvisioningRoot = Join-Path $ProvisioningRoot 'dashboards'
$DashboardRoot = Join-Path $PortalRoot 'dashboards'
$LogRoot = Join-Path $PortalRoot 'logs'
$StateRoot = Join-Path $PortalRoot 'state'
$RunManagerPidFile = Join-Path $StateRoot 'run-manager.pid'
$PortForwardPidFile = Join-Path $StateRoot 'port-forward.pid'
$RunManagerOutLog = Join-Path $LogRoot 'run-manager.out.log'
$RunManagerErrLog = Join-Path $LogRoot 'run-manager.err.log'
$PortForwardOutLog = Join-Path $LogRoot 'port-forward.out.log'
$PortForwardErrLog = Join-Path $LogRoot 'port-forward.err.log'
$ComposeFile = Join-Path $PortalRoot 'docker-compose.yaml'
$DatasourceFile = Join-Path $DatasourceRoot 'datasources.yaml'
$DashboardProvisioningFile = Join-Path $DashboardProvisioningRoot 'default.yaml'
$DashboardFile = Join-Path $DashboardRoot 'logicapps-workflow-hub.json'
$RunManagerFile = Join-Path $PortalRoot 'run-manager.js'
$WorkflowManagerFile = Join-Path $PortalRoot 'workflow-manager.js'
$WorkflowMapFile = Join-Path $PortalRoot 'workflow-map.json'
$ManagedGrafanaContainer = 'logicapps-grafana-portal'
$GrafanaAdminUser = 'admin'
$GrafanaAdminPassword = 'admin'
# Out-of-repo credentials file (dotenv format). Secrets live here, NOT in generated
# artifacts. docker-compose loads it via env_file; Grafana interpolates ${SQL_PASSWORD}.
$CredentialsFile = Join-Path (Split-Path -Parent $ScriptRoot) 'credentials.txt'
# Path to the credentials file relative to the docker-compose.yaml location
# (grafana-portal/docker-compose.yaml -> ../../credentials.txt).
$ComposeCredentialsRelPath = '../../credentials.txt'
$LocalLogicAppPort = 8088
$RemoteLogicAppPort = 80
$ThanosLocalPort = 9091
$ThanosTunnelPidFile = Join-Path $StateRoot 'thanos-tunnel.pid'
$ThanosTunnelOutLog = Join-Path $LogRoot 'thanos-tunnel.out.log'
$ThanosTunnelErrLog = Join-Path $LogRoot 'thanos-tunnel.err.log'
$GrafanaDatasourceName = 'LogicApp-SQL'
$PrometheusDatasourceName = 'Prometheus-Portal'
$AppManagerPort = 3002
$AppManagerFile = Join-Path $PortalRoot 'app-manager.js'
$AppManagerPidFile = Join-Path $StateRoot 'app-manager.pid'
$AppManagerOutLog = Join-Path $LogRoot 'app-manager.out.log'
$AppManagerErrLog = Join-Path $LogRoot 'app-manager.err.log'
$script:DefaultDashboardFileName = 'logicapps-workflow-hub.json'
$script:DefaultDashboardUid = 'logicapps-monitor'
$script:PrimaryLogicAppName = ''
$script:LogicAppHostName = ''

function Write-Step([string]$Message) {
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Write-Info([string]$Message) {
    Write-Host "[INFO] $Message" -ForegroundColor Gray
}

function Read-PlainSecret([string]$Prompt) {
    $secure = Read-Host -Prompt $Prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        if ($ptr -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
        }
    }
}

function Get-ObjectPropertyValue {
    param(
        [object]$InputObject,
        [string]$PropertyName
    )

    if (-not $InputObject) {
        return $null
    }

    $property = $InputObject.PSObject.Properties[$PropertyName]
    if ($null -eq $property) {
        return $null
    }

    return $property.Value
}

function Resolve-InputValue {
    param(
        [string]$Name,
        [string]$CurrentValue,
        [string]$Prompt,
        [string]$DefaultValue,
        [switch]$Secret,
        [switch]$Required
    )

    if (-not [string]::IsNullOrWhiteSpace($CurrentValue)) {
        return $CurrentValue
    }

    if ($Secret) {
        $value = Read-PlainSecret -Prompt $Prompt
    }
    else {
        $suffix = if ([string]::IsNullOrWhiteSpace($DefaultValue)) { '' } else { " [$DefaultValue]" }
        $value = Read-Host -Prompt ($Prompt + $suffix)
        if ([string]::IsNullOrWhiteSpace($value)) {
            $value = $DefaultValue
        }
    }

    if ($Required -and [string]::IsNullOrWhiteSpace($value)) {
        throw "A value for '$Name' is required."
    }

    $value
}

function Get-FirstEnvironmentValue {
    param([string[]]$Names)

    foreach ($name in $Names) {
        $value = [Environment]::GetEnvironmentVariable($name)
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value
        }
    }

    return ''
}

function Get-HostSecretsFileCandidates {
    $candidates = New-Object 'System.Collections.Generic.List[string]'

    foreach ($directName in @('LOGICAPPS_HOST_SECRETS_FILE', 'FUNCTIONS_HOST_SECRETS_FILE', 'HOST_SECRETS_FILE')) {
        $directPath = [Environment]::GetEnvironmentVariable($directName)
        if (-not [string]::IsNullOrWhiteSpace($directPath)) {
            $candidates.Add($directPath)
        }
    }

    foreach ($rootName in @('LOGICAPPS_STORAGE_PATH', 'SMB_SHARE_PATH', 'STORAGE_PATH')) {
        $rootPath = [Environment]::GetEnvironmentVariable($rootName)
        if (-not [string]::IsNullOrWhiteSpace($rootPath)) {
            $candidates.Add((Join-Path $rootPath 'Functions\Secrets\host.json'))
        }
    }

    $candidates.Add('C:\storage\Functions\Secrets\host.json')
    $candidates.Add('D:\storage\Functions\Secrets\host.json')

    @($candidates | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique)
}

function Try-ResolveMasterKeyFromHostSecrets {
    $candidateFiles = Get-HostSecretsFileCandidates
    foreach ($candidate in $candidateFiles) {
        if (-not (Test-Path -LiteralPath $candidate)) {
            continue
        }

        try {
            $secrets = Get-Content -LiteralPath $candidate -Raw | ConvertFrom-Json -ErrorAction Stop
            $resolved = ''
            if ($secrets.PSObject.Properties.Name -contains 'masterKey') {
                if ($secrets.masterKey -is [string]) {
                    $resolved = [string]$secrets.masterKey
                }
                elseif ($secrets.masterKey -and ($secrets.masterKey.PSObject.Properties.Name -contains 'value')) {
                    $resolved = [string]$secrets.masterKey.value
                }
            }
            if ($secrets.PSObject.Properties.Name -contains 'hostName') {
                $script:LogicAppHostName = [string]$secrets.hostName
            }

            if (-not [string]::IsNullOrWhiteSpace($resolved)) {
                Write-Info "Resolved Logic Apps master key from '$candidate'."
                return $resolved
            }
        }
        catch {
            Write-Info "Could not parse '$candidate' while resolving master key: $($_.Exception.Message)"
        }
    }

    return ''
}

function Try-ResolveMasterKeyFromPodSecrets {
    if (-not (Test-CommandAvailable -Name 'oc')) {
        return ''
    }

    $targetAppName = if (-not [string]::IsNullOrWhiteSpace($AppName)) { $AppName } elseif (-not [string]::IsNullOrWhiteSpace($script:PrimaryLogicAppName)) { $script:PrimaryLogicAppName } else { '' }
    if ([string]::IsNullOrWhiteSpace($Namespace) -or [string]::IsNullOrWhiteSpace($targetAppName)) {
        return ''
    }

    $podName = ([string](& oc -n $Namespace get pods -l "containerapps.io/app-name=$targetAppName" -o jsonpath='{.items[0].metadata.name}' 2>$null)).Trim()
    if ([string]::IsNullOrWhiteSpace($podName)) {
        return ''
    }

    $candidateFiles = @(
        '/home/site/wwwroot/Functions/Secrets/host.json',
        '/home/site/wwwroot/host.json',
        '/home/data/Functions/Secrets/host.json'
    )

    foreach ($candidate in $candidateFiles) {
        $content = (& oc -n $Namespace exec -c logicapps-container $podName -- cat $candidate 2>$null)
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($content)) {
            continue
        }

        try {
            $secrets = ($content | ConvertFrom-Json -ErrorAction Stop)
            $resolved = ''
            if ($secrets.PSObject.Properties.Name -contains 'masterKey') {
                if ($secrets.masterKey -is [string]) {
                    $resolved = [string]$secrets.masterKey
                }
                elseif ($secrets.masterKey -and ($secrets.masterKey.PSObject.Properties.Name -contains 'value')) {
                    $resolved = [string]$secrets.masterKey.value
                }
            }
            if ($secrets.PSObject.Properties.Name -contains 'hostName') {
                $script:LogicAppHostName = [string]$secrets.hostName
            }
            if (-not [string]::IsNullOrWhiteSpace($resolved)) {
                Write-Info "Resolved Logic Apps master key from pod '$podName' ($candidate)."
                return $resolved
            }
        }
        catch {
            Write-Info "Could not parse '$candidate' from pod '$podName' while resolving master key: $($_.Exception.Message)"
        }
    }

    return ''
}

function Parse-ConnectionString {
    param([string]$ConnectionString)

    $result = @{}
    if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
        return $result
    }

    foreach ($part in ($ConnectionString -split ';')) {
        if ([string]::IsNullOrWhiteSpace($part)) {
            continue
        }

        $kv = $part -split '=', 2
        if ($kv.Count -ne 2) {
            continue
        }

        $key = $kv[0].Trim()
        $value = $kv[1].Trim()
        if (-not [string]::IsNullOrWhiteSpace($key)) {
            $result[$key.ToLowerInvariant()] = $value
        }
    }

    return $result
}

function Get-ParsedSqlSettingsFromConnectionString {
    param([string]$ConnectionString)

    $parsed = Parse-ConnectionString -ConnectionString $ConnectionString
    if ($parsed.Count -eq 0) {
        return $null
    }

    $resolvedServer = ''
    foreach ($key in @('server', 'data source')) {
        if ($parsed.ContainsKey($key)) {
            $resolvedServer = [string]$parsed[$key]
            break
        }
    }
    if ($resolvedServer -match '^(tcp:)?([^,;]+),[0-9]+$') {
        $resolvedServer = $Matches[2]
    }
    $resolvedServer = $resolvedServer -replace '^tcp:', ''

    $resolvedDatabase = ''
    foreach ($key in @('database', 'initial catalog')) {
        if ($parsed.ContainsKey($key)) {
            $resolvedDatabase = [string]$parsed[$key]
            break
        }
    }

    $resolvedUser = ''
    foreach ($key in @('user id', 'uid', 'user')) {
        if ($parsed.ContainsKey($key)) {
            $resolvedUser = [string]$parsed[$key]
            break
        }
    }

    $resolvedPassword = ''
    foreach ($key in @('password', 'pwd')) {
        if ($parsed.ContainsKey($key)) {
            $resolvedPassword = [string]$parsed[$key]
            break
        }
    }

    if ([string]::IsNullOrWhiteSpace($resolvedServer) -and
        [string]::IsNullOrWhiteSpace($resolvedDatabase) -and
        [string]::IsNullOrWhiteSpace($resolvedUser) -and
        [string]::IsNullOrWhiteSpace($resolvedPassword)) {
        return $null
    }

    return [pscustomobject]@{
        Server   = $resolvedServer
        Database = $resolvedDatabase
        User     = $resolvedUser
        Password = $resolvedPassword
    }
}

function Update-CredentialsFile {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][hashtable]$Values
    )
    # Upsert KEY=VALUE pairs into the dotenv-style credentials file, preserving
    # existing keys/comments. This file holds every secret (SQL + Grafana admin)
    # and is loaded by docker-compose via env_file so nothing is baked into the
    # generated artifacts.
    $lines = New-Object System.Collections.Generic.List[string]
    if (Test-Path -LiteralPath $Path) {
        foreach ($existing in [string[]](Get-Content -LiteralPath $Path)) { $null = $lines.Add($existing) }
    }
    else {
        $null = $lines.Add("# Logic Apps SNO setup credentials (auto-generated $(Get-Date -Format o))")
    }
    foreach ($key in $Values.Keys) {
        $val = [string]$Values[$key]
        if ([string]::IsNullOrWhiteSpace($val)) { continue }
        $found = $false
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match "^\s*$([regex]::Escape($key))\s*=") {
                $lines[$i] = "$key=$val"
                $found = $true
                break
            }
        }
        if (-not $found) { $null = $lines.Add("$key=$val") }
    }
    Set-Content -LiteralPath $Path -Value $lines -Encoding ASCII
}

function Resolve-ContainerAppResourceGroup {
    if (-not [string]::IsNullOrWhiteSpace($ResourceGroup)) {
        return $ResourceGroup
    }

    function Get-ResourceGroupFromText([string]$Text) {
        if ([string]::IsNullOrWhiteSpace($Text)) {
            return ''
        }

        function Try-ResolveLogicAppBaseUrlFromContainerApp {
            if (-not (Test-CommandAvailable -Name 'az')) {
                return ''
            }

            $targetAppName = if (-not [string]::IsNullOrWhiteSpace($AppName)) { $AppName } elseif (-not [string]::IsNullOrWhiteSpace($script:PrimaryLogicAppName)) { $script:PrimaryLogicAppName } else { '' }

            if ([string]::IsNullOrWhiteSpace($targetAppName)) {
                return ''
            }

            $resolvedResourceGroup = Resolve-ContainerAppResourceGroup
            if ([string]::IsNullOrWhiteSpace($resolvedResourceGroup)) {
                return ''
            }

            $appJson = & az containerapp show --name $targetAppName --resource-group $resolvedResourceGroup -o json 2>$null
            if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($appJson)) {
                return ''
            }

            try {
                $app = $appJson | ConvertFrom-Json -ErrorAction Stop
            }
            catch {
                return ''
            }

            $fqdn = ''
            if ($app.properties -and $app.properties.configuration -and $app.properties.configuration.ingress) {
                $fqdn = [string]$app.properties.configuration.ingress.fqdn
            }

            if ([string]::IsNullOrWhiteSpace($fqdn)) {
                return ''
            }

            $resolvedUrl = if ($fqdn -match '^https?://') { $fqdn.TrimEnd('/') } else { "https://$fqdn" }
            Write-Info "Resolved Logic Apps base URL from container app ingress: $resolvedUrl"
            return $resolvedUrl
        }
        $match = [regex]::Match($Text, '(?i)/resourceGroups/([^/\s"\\]+)')
        if ($match.Success) {
            return $match.Groups[1].Value
        }
        return ''
    }

    $targetAppName = if (-not [string]::IsNullOrWhiteSpace($AppName)) { $AppName } elseif (-not [string]::IsNullOrWhiteSpace($script:PrimaryLogicAppName)) { $script:PrimaryLogicAppName } else { '' }

    if (Test-CommandAvailable -Name 'oc' -and -not [string]::IsNullOrWhiteSpace($Namespace)) {
        $ocArgs = @('-n', $Namespace)
        if (-not [string]::IsNullOrWhiteSpace($KubeContext)) {
            $ocArgs = @('--context', $KubeContext) + $ocArgs
        }
        if (-not [string]::IsNullOrWhiteSpace($KubeConfigPath) -and (Test-Path -LiteralPath $KubeConfigPath)) {
            $ocArgs = @('--kubeconfig', $KubeConfigPath) + $ocArgs
        }

        $podSelector = if ([string]::IsNullOrWhiteSpace($targetAppName)) { 'containerapps.io/app-name' } else { "containerapps.io/app-name=$targetAppName" }
        $podJson = & oc @ocArgs get pods -l $podSelector -o json 2>$null
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($podJson)) {
            $rgFromPods = Get-ResourceGroupFromText -Text $podJson
            if (-not [string]::IsNullOrWhiteSpace($rgFromPods)) {
                Write-Info "Resolved resource group '$rgFromPods' from Kubernetes metadata."
                return $rgFromPods
            }
        }
    }

    if (-not (Test-CommandAvailable -Name 'az')) {
        return ''
    }

    if ([string]::IsNullOrWhiteSpace($targetAppName)) {
        return ''
    }

    $rg = ([string](& az resource list --name $targetAppName --resource-type Microsoft.App/containerApps --query "[0].resourceGroup" -o tsv 2>$null)).Trim()
    if (-not [string]::IsNullOrWhiteSpace($rg)) {
        Write-Info "Resolved resource group '$rg' for container app '$targetAppName'."
        return $rg
    }

    return ''
}

function Try-ResolveSqlSettingsFromContainerAppSecret {
    if (-not (Test-CommandAvailable -Name 'az')) {
        return $null
    }

    $targetAppName = if (-not [string]::IsNullOrWhiteSpace($AppName)) { $AppName } elseif (-not [string]::IsNullOrWhiteSpace($script:PrimaryLogicAppName)) { $script:PrimaryLogicAppName } else { '' }

    if ([string]::IsNullOrWhiteSpace($targetAppName)) {
        return $null
    }

    $resolvedResourceGroup = Resolve-ContainerAppResourceGroup
    if ([string]::IsNullOrWhiteSpace($resolvedResourceGroup)) {
        return $null
    }

    $secretJson = & az containerapp secret list --name $targetAppName --resource-group $resolvedResourceGroup -o json 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($secretJson)) {
        return $null
    }

    try {
        $secrets = @($secretJson | ConvertFrom-Json -ErrorAction Stop)
    }
    catch {
        return $null
    }

    if (-not $secrets -or $secrets.Count -eq 0) {
        return $null
    }

    $candidateSecretNames = @('sqlconnection', 'workflows-sql-connectionstring', 'sql-connection-string')
    $candidateName = ''
    foreach ($name in $candidateSecretNames) {
        $candidateName = [string]($secrets | Where-Object {
            [string](Get-ObjectPropertyValue -InputObject $_ -PropertyName 'name') -eq $name
        } | Select-Object -First 1 | ForEach-Object { Get-ObjectPropertyValue -InputObject $_ -PropertyName 'name' })
        if (-not [string]::IsNullOrWhiteSpace($candidateName)) { break }
    }
    if ([string]::IsNullOrWhiteSpace($candidateName)) {
        $candidateName = [string]($secrets |
            Where-Object {
                [string](Get-ObjectPropertyValue -InputObject $_ -PropertyName 'name') -match 'sql|connection'
            } |
            Select-Object -First 1 | ForEach-Object { Get-ObjectPropertyValue -InputObject $_ -PropertyName 'name' })
    }
    if ([string]::IsNullOrWhiteSpace($candidateName)) {
        return $null
    }

    $secretValue = (& az containerapp secret show --name $targetAppName --resource-group $resolvedResourceGroup --secret-name $candidateName -o json 2>$null)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($secretValue)) {
        return $null
    }
    try {
        $secretObject = $secretValue | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        return $null
    }

    $resolved = Get-ParsedSqlSettingsFromConnectionString -ConnectionString ([string](Get-ObjectPropertyValue -InputObject $secretObject -PropertyName 'value'))
    if ($resolved) {
        Write-Info "Resolved SQL settings from container app secret '$candidateName' for '$targetAppName'."
    }
    return $resolved
}

function Try-ResolveSqlSettingsFromPod {
    if (-not (Test-CommandAvailable -Name 'oc')) {
        return $null
    }

    if ([string]::IsNullOrWhiteSpace($Namespace) -or [string]::IsNullOrWhiteSpace($AppName)) {
        return $null
    }

    $podName = ([string](& oc -n $Namespace get pods -l "containerapps.io/app-name=$AppName" -o jsonpath='{.items[0].metadata.name}' 2>$null)).Trim()
    if ([string]::IsNullOrWhiteSpace($podName)) {
        return $null
    }

    $podJson = & oc -n $Namespace get pod $podName -o json 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($podJson)) {
        return $null
    }

    try {
        $pod = $podJson | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        return $null
    }

    $containers = @($pod.spec.containers)
    if (-not $containers -or $containers.Count -eq 0) {
        return $null
    }

    $targetContainer = $containers | Where-Object { $_.name -eq 'logicapps-container' } | Select-Object -First 1
    if (-not $targetContainer) {
        $targetContainer = $containers | Where-Object { $_.name -notmatch 'envoy|proxy' } | Select-Object -First 1
    }
    if (-not $targetContainer) {
        $targetContainer = $containers | Select-Object -First 1
    }

    $envItems = @($targetContainer.env)
    if (-not $envItems -or $envItems.Count -eq 0) {
        return $null
    }

    $sqlConnectionString = ''
    foreach ($item in $envItems) {
        $name = [string]$item.name
        $value = [string]$item.value
        if ([string]::IsNullOrWhiteSpace($name) -or [string]::IsNullOrWhiteSpace($value)) {
            continue
        }

        if ($name -eq 'sqlconnection' -or $name -eq 'Workflows.Sql.ConnectionString') {
            $sqlConnectionString = $value
            break
        }
    }

    if ([string]::IsNullOrWhiteSpace($sqlConnectionString)) {
        return $null
    }

    $resolved = Get-ParsedSqlSettingsFromConnectionString -ConnectionString $sqlConnectionString
    if ($resolved) {
        Write-Info "Resolved SQL settings from pod '$podName' environment."
    }
    return $resolved
}

function Try-ResolvePrometheusSettingsFromOpenShift {
    if (-not (Test-CommandAvailable -Name 'oc')) {
        return $null
    }

    $ocBaseArgs = @()
    if (-not [string]::IsNullOrWhiteSpace($KubeConfigPath) -and (Test-Path -LiteralPath $KubeConfigPath)) {
        $ocBaseArgs += @('--kubeconfig', $KubeConfigPath)
    }
    if (-not [string]::IsNullOrWhiteSpace($KubeContext)) {
        $ocBaseArgs += @('--context', $KubeContext)
    }

    function Get-NormalizedValue([AllowNull()]$Value) {
        if ($null -eq $Value) { return '' }
        return $Value.ToString().Trim()
    }

    $promHost = ''
    $candidateRoutes = @('thanos-querier', 'prometheus-k8s', 'prometheus')
    foreach ($routeName in $candidateRoutes) {
        $routeHost = Get-NormalizedValue (& oc @ocBaseArgs -n openshift-monitoring get route $routeName -o jsonpath='{.spec.host}' 2>$null)
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($routeHost)) {
            $promHost = $routeHost
            break
        }
    }

    if ([string]::IsNullOrWhiteSpace($promHost)) {
        $routeList = & oc @ocBaseArgs -n openshift-monitoring get route -o jsonpath='{range .items[*]}{.metadata.name}{"`t"}{.spec.host}{"`n"}{end}' 2>$null
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($routeList)) {
            $candidates = @($routeList -split "`r?`n" | Where-Object { $_ -match '\S' })
            $preferred = $candidates | Where-Object { $_ -match '^thanos-querier\t' -or $_ -match '^prometheus-k8s\t' } | Select-Object -First 1
            if (-not $preferred) {
                $preferred = $candidates | Select-Object -First 1
            }
            if ($preferred) {
                $parts = $preferred -split "`t", 2
                if ($parts.Count -eq 2) {
                    $promHost = $parts[1].Trim()
                }
            }
        }
    }

    if ([string]::IsNullOrWhiteSpace($promHost)) {
        return $null
    }

    $resolvedToken = Get-NormalizedValue (& oc @ocBaseArgs whoami -t 2>$null)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($resolvedToken) -or $resolvedToken -match 'Unauthorized|forbidden|error') {
        $resolvedToken = ''
    }

    if ([string]::IsNullOrWhiteSpace($resolvedToken)) {
        foreach ($saName in @('prometheus-k8s', 'thanos-querier')) {
            $candidateToken = Get-NormalizedValue (& oc @ocBaseArgs -n openshift-monitoring create token $saName --duration=24h 2>$null)
            if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($candidateToken)) {
                $resolvedToken = $candidateToken
                break
            }
        }
    }

    $resolvedUrl = "https://$promHost"
    if ([string]::IsNullOrWhiteSpace($resolvedToken)) {
        Write-Info "Resolved Prometheus URL from OpenShift route: $resolvedUrl"
    } else {
        Write-Info "Resolved Prometheus URL/token from OpenShift."
    }

    return [pscustomobject]@{
        Url = $resolvedUrl
        Token = $resolvedToken
    }
}

function Get-SafeDashboardSlug {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return 'default'
    }

    $slug = $Value.Trim().ToLowerInvariant() -replace '[^a-z0-9]+', '-'
    $slug = $slug.Trim('-')
    if ([string]::IsNullOrWhiteSpace($slug)) {
        return 'default'
    }
    return $slug
}

function Get-LogicAppNamesFromNamespace {
    if (-not (Test-CommandAvailable -Name 'oc')) {
        return @()
    }
    if ([string]::IsNullOrWhiteSpace($Namespace)) {
        return @()
    }

    $ocArgs = @('-n', $Namespace)
    if (-not [string]::IsNullOrWhiteSpace($KubeContext)) {
        $ocArgs = @('--context', $KubeContext) + $ocArgs
    }
    if (-not [string]::IsNullOrWhiteSpace($KubeConfigPath) -and (Test-Path -LiteralPath $KubeConfigPath)) {
        $ocArgs = @('--kubeconfig', $KubeConfigPath) + $ocArgs
    }

    $podNames = & oc @ocArgs get pods --no-headers 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($podNames)) {
        return @()
    }

    $apps = @()
    foreach ($line in @($podNames -split "`r?`n")) {
        $podName = (($line -split '\s+')[0]).Trim()
        if ([string]::IsNullOrWhiteSpace($podName)) {
            continue
        }
        if ($podName -match '^([a-z0-9-]+)--\d{6,}-') {
            $apps += $Matches[1]
        }
    }

    @($apps | Where-Object { $_ } | Sort-Object -Unique)
}

function Try-ResolveLogicAppsScope {
    if (-not (Test-CommandAvailable -Name 'oc')) {
        return $null
    }

    $ocArgs = @()
    if (-not [string]::IsNullOrWhiteSpace($KubeContext)) {
        $ocArgs += @('--context', $KubeContext)
    }
    if (-not [string]::IsNullOrWhiteSpace($KubeConfigPath) -and (Test-Path -LiteralPath $KubeConfigPath)) {
        $ocArgs += @('--kubeconfig', $KubeConfigPath)
    }

    $podsJson = & oc @ocArgs get pods -A -o json 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($podsJson)) {
        return $null
    }

    try {
        $payload = $podsJson | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        return $null
    }

    $items = @($payload.items)
    if ($items.Count -eq 0) {
        return $null
    }

    $rows = foreach ($item in $items) {
        $ns = [string]$item.metadata.namespace
        $podName = [string]$item.metadata.name
        $labels = $item.metadata.labels
        $app = ''
        $app = [string](Get-ObjectPropertyValue -InputObject $labels -PropertyName 'containerapps.io/app-name')
        if ([string]::IsNullOrWhiteSpace($app) -and $podName -match '^([a-z0-9-]+)--\d{6,}-') {
            $app = $Matches[1]
        }
        if (-not [string]::IsNullOrWhiteSpace($ns) -and -not [string]::IsNullOrWhiteSpace($app)) {
            [pscustomobject]@{ Namespace = $ns; AppName = $app }
        }
    }

    $chosenNamespace = $rows |
        Group-Object Namespace |
        Sort-Object Count -Descending |
        Select-Object -First 1 -ExpandProperty Name

    if ([string]::IsNullOrWhiteSpace($chosenNamespace)) {
        return $null
    }

    $appsInNamespace = @($rows | Where-Object { $_.Namespace -eq $chosenNamespace } | ForEach-Object { $_.AppName } | Sort-Object -Unique)
    if ($appsInNamespace.Count -eq 0) {
        return $null
    }

    Write-Info "Resolved Logic Apps scope from cluster: namespace='$chosenNamespace', apps='$($appsInNamespace -join ', ')'."
    return [pscustomobject]@{
        Namespace = $chosenNamespace
        PrimaryAppName = [string]$appsInNamespace[0]
        AppNames = $appsInNamespace
    }
}

function Try-ResolveLogicAppsNamespace {
    if (-not (Test-CommandAvailable -Name 'oc')) {
        return ''
    }

    $baseArgs = @()
    if (-not [string]::IsNullOrWhiteSpace($KubeContext)) {
        $baseArgs += @('--context', $KubeContext)
    }
    if (-not [string]::IsNullOrWhiteSpace($KubeConfigPath) -and (Test-Path -LiteralPath $KubeConfigPath)) {
        $baseArgs += @('--kubeconfig', $KubeConfigPath)
    }

    $currentNamespace = ([string](& oc @baseArgs config view --minify --output 'jsonpath={..namespace}' 2>$null)).Trim()
    if (-not [string]::IsNullOrWhiteSpace($currentNamespace)) {
        $podCheck = (& oc @baseArgs -n $currentNamespace get pods -l 'containerapps.io/app-name' -o name 2>$null)
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($podCheck)) {
            Write-Info "Resolved Logic Apps namespace from current context: '$currentNamespace'."
            return $currentNamespace
        }
    }

    $allPods = & oc @baseArgs get pods -A -l 'containerapps.io/app-name' -o jsonpath='{range .items[*]}{.metadata.namespace}{"`n"}{end}' 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($allPods)) {
        $namespaces = @(
            $allPods -split "`r?`n" |
            ForEach-Object { $_.Trim() } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            Sort-Object -Unique
        )
        if ($namespaces.Count -eq 1) {
            Write-Info "Resolved Logic Apps namespace from cluster pods: '$($namespaces[0])'."
            return $namespaces[0]
        }
        if ($namespaces -contains 'logicapps-aca-ns') {
            Write-Info "Multiple app namespaces detected; defaulting to 'logicapps-aca-ns'."
            return 'logicapps-aca-ns'
        }
    }

    return ''
}

function Refresh-SessionPath {
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = (@($machinePath, $userPath) | Where-Object { $_ }) -join ';'
}

function Test-CommandAvailable([string]$Name) {
    $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-DefaultSwitchIPv4 {
    $candidates = @(
        Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.InterfaceAlias -like '*Default Switch*' -and
            $_.IPAddress -match '^\d{1,3}(\.\d{1,3}){3}$' -and
            $_.IPAddress -notlike '169.254.*'
        } |
        Sort-Object @{ Expression = { $_.AddressState -eq 'Preferred' }; Descending = $true }, InterfaceMetric
    )

    if ($candidates.Count -gt 0) {
        return [string]$candidates[0].IPAddress
    }

    return ''
}

function Get-ActiveTcpPorts {
    [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners().Port
}

function Test-PortListening([int]$Port) {
    (Get-ActiveTcpPorts) -contains $Port
}

function Test-PortConnectable([int]$Port, [int]$TimeoutMs = 1500) {
    # Actively opens a TCP connection to confirm the port forwards traffic, not just
    # that a (possibly dead/TIME_WAIT) socket is bound in the LISTEN state.
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $iar = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $iar.AsyncWaitHandle.WaitOne($TimeoutMs)) { return $false }
        $client.EndConnect($iar)
        return $client.Connected
    }
    catch { return $false }
    finally { $client.Close() }
}

function Wait-PortListening {
    param(
        [int]$Port,
        [int]$TimeoutSeconds = 30,
        [string]$Description = 'service'
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-PortListening -Port $Port) {
            return
        }
        Start-Sleep -Seconds 1
    }

    throw "Timed out waiting for $Description to listen on port $Port."
}

function Stop-ManagedProcess {
    param(
        [string]$PidFile,
        [string]$Name
    )

    if (-not (Test-Path -LiteralPath $PidFile)) {
        return
    }

    try {
        $pidValue = Get-Content -LiteralPath $PidFile | Select-Object -First 1
        if ($pidValue) {
            $process = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
            if ($process) {
                Write-Info "Stopping managed $Name process (PID $pidValue)."
                try {
                    Stop-Process -Id ([int]$pidValue) -Force -ErrorAction Stop
                }
                catch [System.Management.Automation.ItemNotFoundException] {
                    Write-Info "Managed $Name process (PID $pidValue) already exited."
                }
                catch {
                    if ($_.Exception.Message -match 'Cannot find a process with the process identifier') {
                        Write-Info "Managed $Name process (PID $pidValue) already exited."
                    }
                    else {
                        throw
                    }
                }
            }
        }
    }
    finally {
        Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    }
}

function Stop-ProcessOnPort {
    param(
        [Parameter(Mandatory)][int]$Port,
        [Parameter(Mandatory)][string]$Name
    )

    $connections = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
    if (-not $connections -or $connections.Count -eq 0) {
        return
    }

    $pids = @($connections | Where-Object { $_.OwningProcess -gt 0 } | Select-Object -ExpandProperty OwningProcess -Unique)
    foreach ($processId in $pids) {
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($process) {
            Write-Info "Stopping stale $Name listener on port $Port (PID $processId)."
            Stop-Process -Id $processId -Force -ErrorAction Stop
        }
    }
}

function Stop-StaleRunManagerListener {
    param(
        [Parameter(Mandatory)][int]$Port
    )

    $connections = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
    if (-not $connections -or $connections.Count -eq 0) {
        return
    }

    $pids = @($connections | Where-Object { $_.OwningProcess -gt 0 } | Select-Object -ExpandProperty OwningProcess -Unique)
    foreach ($processId in $pids) {
        $commandLine = ''
        try {
            $procInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction Stop
            $commandLine = [string]$procInfo.CommandLine
        }
        catch {
            # Best-effort only; if we cannot inspect command line, don't kill.
            continue
        }

        if ($commandLine -match '(?i)(workflow-manager\.js|run-manager\.js)') {
            Write-Info "Stopping stale Workflow Manager listener on port $Port (PID $processId)."
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    }
}

function Start-ManagedProcess {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$ArgumentList,
        [string]$WorkingDirectory,
        [string]$PidFile,
        [string]$StdOutLog,
        [string]$StdErrLog
    )

    Stop-ManagedProcess -PidFile $PidFile -Name $Name
    Remove-Item -LiteralPath $StdOutLog, $StdErrLog -Force -ErrorAction SilentlyContinue
    $process = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -WorkingDirectory $WorkingDirectory -PassThru -WindowStyle Hidden -RedirectStandardOutput $StdOutLog -RedirectStandardError $StdErrLog
    Set-Content -LiteralPath $PidFile -Value $process.Id -Encoding ascii
    $process
}

function Ensure-PortalDirectories {
    foreach ($path in @($PortalRoot, $ProvisioningRoot, $DatasourceRoot, $DashboardProvisioningRoot, $DashboardRoot, $LogRoot, $StateRoot)) {
        $null = New-Item -ItemType Directory -Path $path -Force
    }
}

function Ensure-DockerReady {
    Write-Step 'Checking Docker Desktop'

    if (-not (Test-CommandAvailable -Name 'docker')) {
        throw @"
Docker Desktop is not installed or docker.exe is not in PATH.
Install Docker Desktop from https://www.docker.com/products/docker-desktop/ and start it before rerunning this script.
"@
    }

    $serverVersion = & docker version --format '{{.Server.Version}}' 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($serverVersion)) {
        throw @"
Docker Desktop is installed but the Docker engine is not responding.
Start Docker Desktop and wait until it shows 'Engine running', then rerun this script.
"@
    }

    Write-Info "Docker is available (server version $serverVersion)."
}

function Ensure-NodeJs {
    Write-Step 'Checking Node.js'

    if (Test-CommandAvailable -Name 'node') {
        Write-Info "Node.js detected: $(& node --version)"
        return
    }

    if (-not (Test-CommandAvailable -Name 'winget')) {
        throw 'Node.js is not installed and winget is unavailable. Install Node.js LTS manually, then rerun the script.'
    }

    Write-Info 'Node.js not found. Installing Node.js LTS with winget...'
    & winget install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        throw 'winget failed to install Node.js LTS. Install Node.js manually and rerun the script.'
    }

    Refresh-SessionPath
    if (-not (Test-CommandAvailable -Name 'node')) {
        throw 'Node.js installation completed but node.exe is still not available in PATH. Open a new shell and rerun the script.'
    }

    Write-Info "Node.js installed successfully: $(& node --version)"
}

function Ensure-OcCli {
    Write-Step 'Checking oc CLI'

    $ocResolved = $false
    if (Test-CommandAvailable -Name 'oc') {
        Write-Info "oc detected."
        $ocResolved = $true
    }
    else {
        $fallbackOc = Join-Path (Split-Path -Parent $ScriptRoot) 'openshift-tools\oc.exe'
        if (Test-Path -LiteralPath $fallbackOc) {
            $fallbackDir = Split-Path -Parent $fallbackOc
            $env:Path = "$fallbackDir;$env:Path"
            if (Test-CommandAvailable -Name 'oc') {
                Write-Info "oc detected via fallback path: $fallbackOc"
                $ocResolved = $true
            }
        }
    }

    if (-not $ocResolved) {
        if ($UsePortForward) {
            throw 'The oc CLI is required when -UsePortForward is true. Install oc and ensure it is available in PATH.'
        }

        Write-Warning 'oc CLI is not available. Continuing because -UsePortForward is false.'
        return
    }

    $authArgs = @()
    if (-not [string]::IsNullOrWhiteSpace($KubeContext)) {
        $authArgs += @('--context', $KubeContext)
    }
    if (-not [string]::IsNullOrWhiteSpace($KubeConfigPath) -and (Test-Path -LiteralPath $KubeConfigPath)) {
        $authArgs += @('--kubeconfig', $KubeConfigPath)
    }

    $apiServer = (& oc @authArgs config view --minify -o "jsonpath={.clusters[0].cluster.server}" 2>$null)
    if ($null -ne $apiServer) {
        $apiServer = $apiServer.ToString().Trim()
    }
    if ([string]::IsNullOrWhiteSpace($apiServer)) {
        throw "Unable to resolve OpenShift API server URL from kubeconfig using 'oc config view --minify -o jsonpath={.clusters[0].cluster.server}'."
    }

    $previousNativeErrorPreference = $null
    $nativeErrorPreferenceVar = Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue
    $hasNativeErrorPreference = $null -ne $nativeErrorPreferenceVar
    if ($hasNativeErrorPreference) {
        $previousNativeErrorPreference = [bool]$nativeErrorPreferenceVar.Value
        $PSNativeCommandUseErrorActionPreference = $false
    }

    try {
        $tokenAutoDetected = $false
        if ([string]::IsNullOrWhiteSpace($OpenShiftToken)) {
            $detectedToken = (& oc @authArgs whoami -t 2>$null)
            if ($null -ne $detectedToken) {
                $detectedToken = $detectedToken.ToString().Trim()
            }
            if ($LASTEXITCODE -eq 0 -and
                -not [string]::IsNullOrWhiteSpace($detectedToken) -and
                $detectedToken -notmatch 'Unauthorized|forbidden|error') {
                $OpenShiftToken = $detectedToken
                $tokenAutoDetected = $true
                Write-Info 'Using OpenShift token resolved from current oc context (oc whoami -t).'
            }
        }

        $tokenLoginSucceeded = $false
        if (-not [string]::IsNullOrWhiteSpace($OpenShiftToken)) {
            $loginOutput = (& oc @authArgs login $apiServer "--token=$OpenShiftToken" "--insecure-skip-tls-verify=$($SkipTlsVerify.ToString().ToLowerInvariant())" --request-timeout=30s 2>$null)
            if ($LASTEXITCODE -eq 0) {
                $tokenLoginSucceeded = $true
            }
            elseif ($tokenAutoDetected) {
                Write-Warning "Auto-detected OpenShift token failed to login for '$apiServer'. Falling back to password/current context."
                $OpenShiftToken = ''
            }
            else {
                throw "oc login with token failed for '$apiServer': $($loginOutput -join [Environment]::NewLine)"
            }
        }

        if (-not $tokenLoginSucceeded -and -not [string]::IsNullOrWhiteSpace($OpenShiftPassword)) {
            $loginOutput = (& oc @authArgs login -u $OpenShiftUsername -p $OpenShiftPassword $apiServer "--insecure-skip-tls-verify=$($SkipTlsVerify.ToString().ToLowerInvariant())" --request-timeout=30s 2>$null)
            if ($LASTEXITCODE -ne 0) {
                throw "oc login with username/password failed for '$apiServer': $($loginOutput -join [Environment]::NewLine)"
            }
        }

        $identity = (& oc @authArgs whoami 2>$null)
        if ($null -ne $identity) {
            $identity = $identity.ToString().Trim()
        }
        $contextLabel = if (-not [string]::IsNullOrWhiteSpace($KubeContext)) { $KubeContext } else { '(current context)' }
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($identity)) {
            throw "oc CLI is available but authentication failed for context '$contextLabel' (API: $apiServer). Provide -OpenShiftToken or -OpenShiftPassword (or OPENSHIFT_TOKEN / OPENSHIFT_PASSWORD), then retry."
        }
    }
    finally {
        if ($hasNativeErrorPreference) {
            $PSNativeCommandUseErrorActionPreference = $previousNativeErrorPreference
        }
    }
}

function Initialize-KubeConfig {
    if ([string]::IsNullOrWhiteSpace($KubeConfigPath)) {
        return
    }

    if (-not (Test-Path -LiteralPath $KubeConfigPath)) {
        throw "Kubeconfig file not found at '$KubeConfigPath'."
    }

    $env:KUBECONFIG = (Resolve-Path -LiteralPath $KubeConfigPath).Path
    Write-Info "Using kubeconfig: $env:KUBECONFIG"
}

function Ensure-PortAvailability {
    param(
        [bool]$PreserveManagedProcesses = $false
    )

    Write-Step 'Checking local ports'

    if (-not $PreserveManagedProcesses) {
        Stop-ManagedProcess -PidFile $RunManagerPidFile -Name 'run-manager'
        Stop-StaleRunManagerListener -Port $RunManagerPort
        if ($UsePortForward) {
            Stop-ManagedProcess -PidFile $PortForwardPidFile -Name 'oc port-forward'
        }
    }
    else {
        Write-Info 'Preserving managed Workflow Manager/port-forward processes (SkipStart mode).'
    }

    if (Test-PortListening -Port $GrafanaPort) {
        $containerName = & docker ps --filter "name=^${ManagedGrafanaContainer}$" --format '{{.Names}}' 2>$null
        if ($containerName -notcontains $ManagedGrafanaContainer) {
            throw "Port $GrafanaPort is already in use by another process. Free the port or rerun with -GrafanaPort set to a different value."
        }
        Write-Info "Port $GrafanaPort is already used by the managed Grafana container and will be reused."
    }
    else {
        Write-Info "Port $GrafanaPort is available for Grafana."
    }

    if (Test-PortListening -Port $RunManagerPort) {
        if ($PreserveManagedProcesses) {
            Write-Info "Port $RunManagerPort is already in use and will be reused."
        }
        else {
            throw "Port $RunManagerPort is already in use. Free it or rerun with -RunManagerPort set to a different value."
        }
    }
    else {
        Write-Info "Port $RunManagerPort is available for Workflow Manager."
    }

    if ($UsePortForward -and -not (Test-PortListening -Port $LocalLogicAppPort)) {
        Write-Info "Port $LocalLogicAppPort is available for oc port-forward."
    }
    elseif ($UsePortForward) {
        Write-Warning "Port $LocalLogicAppPort is already in use. The script will attempt to reuse the existing listener."
    }
}

function Escape-SqlIdentifier([string]$Value) {
    $Value.Replace(']', ']]')
}

function Escape-SqlString([string]$Value) {
    $Value.Replace("'", "''")
}

function Invoke-SqlQuery {
    param([string]$Query)

    $connectionString = "Server=$SqlServer;Database=$SqlDatabase;User ID=$SqlUser;Password=$SqlPassword;Encrypt=False;TrustServerCertificate=True;Connection Timeout=15;"
    $connection = New-Object System.Data.SqlClient.SqlConnection $connectionString
    $command = $connection.CreateCommand()
    $command.CommandText = $Query
    $command.CommandTimeout = 60
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter $command
    $table = New-Object System.Data.DataTable

    try {
        $connection.Open()
        $null = $adapter.Fill($table)
        ,$table
    }
    finally {
        $connection.Close()
        $connection.Dispose()
        $adapter.Dispose()
        $command.Dispose()
    }
}

function Resolve-LogicAppUrl([string]$RelativePath) {
    $base = $script:EffectiveLogicAppBaseUrl.TrimEnd('/')
    "$base$RelativePath"
}

function Invoke-LogicAppRequest {
    param(
        [ValidateSet('GET', 'POST')]
        [string]$Method,
        [string]$RelativePath,
        [object]$Body
    )

    $uri = Resolve-LogicAppUrl -RelativePath $RelativePath
    $params = @{
        Method      = $Method
        Uri         = $uri
        TimeoutSec  = 30
        ErrorAction = 'Stop'
    }
    if (-not [string]::IsNullOrWhiteSpace($script:LogicAppHostName) -and
        ([uri]$uri).Host -match '^(localhost|127\.0\.0\.1)$') {
        $params.Headers = @{ Host = $script:LogicAppHostName }
    }
    if ($PSBoundParameters.ContainsKey('Body')) {
        $params.ContentType = 'application/json'
        $params.Body = if ($null -eq $Body) { '{}' } else { ($Body | ConvertTo-Json -Depth 20 -Compress) }
    }

    # The Logic Apps workflow runtime returns 503 (Service Unavailable) and the
    # port-forward refuses connections while the Functions host is still loading
    # workflows, even after the pod reports Running. Retry transient failures
    # with backoff so the runtime has time to finish booting.
    $maxAttempts = 30
    $delaySeconds = 5
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        try {
            return Invoke-RestMethod @params
        }
        catch {
            $statusCode = $null
            if ($_.Exception.Response -and ($_.Exception.Response.PSObject.Properties.Name -contains 'StatusCode')) {
                $statusCode = [int]$_.Exception.Response.StatusCode
            }
            $message = $_.Exception.Message
            $isTransient = ($statusCode -eq 503) -or ($statusCode -eq 502) -or ($statusCode -eq 504) -or
                ($message -match 'actively refused|connection (was )?refused|ECONNREFUSED|unable to connect|connection reset|timed out|Service Unavailable')

            if ($isTransient -and $attempt -lt $maxAttempts) {
                Write-Warning ("Logic Apps runtime not ready yet ($Method $RelativePath): {0}. Retrying in {1}s ({2}/{3})." -f $message.Trim(), $delaySeconds, $attempt, $maxAttempts)
                Start-Sleep -Seconds $delaySeconds
                continue
            }

            throw "Logic Apps API request failed ($Method $uri): $message"
        }
    }
}

function Resolve-PodResource {
    if (-not $UsePortForward) {
        return $null
    }

    Write-Step 'Resolving pod for port-forward'

    if ($PodSelector) {
        if ($PodSelector.StartsWith('pod/')) {
            return $PodSelector
        }
        if ($PodSelector -match '=' -or $PodSelector -match ',') {
            $podName = ([string](& oc -n $Namespace get pods -l $PodSelector -o jsonpath='{.items[0].metadata.name}' 2>$null)).Trim()
            if (-not $podName) {
                throw "No pod matched label selector '$PodSelector' in namespace '$Namespace'."
            }
            return "pod/$podName"
        }

        $exactPod = (& oc -n $Namespace get pod $PodSelector -o name 2>$null)
        if ($LASTEXITCODE -eq 0 -and $exactPod) {
            return $exactPod.Trim()
        }
    }

    if ($AppName) {
        $nameMatch = (& oc -n $Namespace get pods --no-headers 2>$null) -split "`r?`n" |
            ForEach-Object { ($_ -split '\s+')[0] } |
            Where-Object { $_ -like "$AppName--*" } |
            Select-Object -First 1
        if ($nameMatch) {
            return "pod/$nameMatch"
        }

        $labelMatch = ([string](& oc -n $Namespace get pods -l "containerapps.io/app-name=$AppName" -o jsonpath='{.items[0].metadata.name}' 2>$null)).Trim()
        if ($LASTEXITCODE -eq 0 -and $labelMatch) {
            return "pod/$labelMatch"
        }
    }

    $podList = & oc -n $Namespace get pods --no-headers 2>$null
    if (-not $podList) {
        throw "Unable to list pods in namespace '$Namespace'. Verify your oc login/context and namespace."
    }

    $match = $podList -split "`r?`n" |
        ForEach-Object { ($_ -split '\s+')[0] } |
        Where-Object { $_ -like "$AppName*" -or ($PodSelector -and $_ -like "*$PodSelector*") } |
        Select-Object -First 1

    if (-not $match) {
        $podLines = & oc -n $Namespace get pods --no-headers 2>$null
        $candidatePods = @($podLines -split "`r?`n" | ForEach-Object { ($_ -split '\s+')[0] } | Where-Object { $_ -match '^([a-z0-9-]+)--\d{6,}-' } )
        if ($candidatePods.Count -eq 1) {
            $resolvedPod = $candidatePods[0]
            $resolvedApp = ($resolvedPod -replace '--\d{6,}-.*$', '')
            Write-Info "Auto-discovered Logic App '$resolvedApp' from pod name."
            return "pod/$resolvedPod"
        }

        if ($uniqueApps.Count -gt 1) {
            throw "Multiple Logic Apps were discovered in namespace '$Namespace' ($($uniqueApps -join ', ')). Supply -AppName or -PodSelector explicitly."
        }

        throw "Unable to auto-discover a pod for app '$AppName'. Supply -AppName or -PodSelector after the Logic App container app has been deployed."
    }

    "pod/$match"
}

function Test-PrometheusNeedsTunnel {
    # The OpenShift Thanos/Prometheus route is not directly reachable from the Grafana
    # container; it is remapped via compose extra_hosts to the Docker host, where this
    # script runs an oc port-forward tunnel. Direct IP/localhost URLs need no tunnel.
    if ([string]::IsNullOrWhiteSpace($PrometheusUrl)) { return $false }
    $promHost = ([uri]$PrometheusUrl).Host
    if ([string]::IsNullOrWhiteSpace($promHost)) { return $false }
    if ($promHost -match '^(localhost|127\.0\.0\.1|host\.docker\.internal)$') { return $false }
    if ($promHost -match '^\d+\.\d+\.\d+\.\d+$') { return $false }
    return $true
}

function Start-ThanosTunnel {
    if (-not (Test-PrometheusNeedsTunnel)) {
        Write-Info 'Prometheus URL is directly reachable; no Thanos tunnel needed.'
        return
    }
    if (-not (Test-CommandAvailable -Name 'oc')) {
        Write-Warning 'oc CLI unavailable; cannot start Thanos tunnel. Prometheus panels may show no data.'
        return
    }

    # If a working tunnel is already up that we did NOT start (no managed pidfile),
    # reuse it. Check this BEFORE stopping anything so we don't race our own teardown.
    $haveManaged = (Test-Path -LiteralPath $ThanosTunnelPidFile)
    if (-not $haveManaged -and (Test-PortConnectable -Port $ThanosLocalPort)) {
        Write-Info "Port $ThanosLocalPort already forwards; reusing existing Thanos tunnel."
        return
    }

    Stop-ManagedProcess -PidFile $ThanosTunnelPidFile -Name 'thanos-tunnel'
    # Wait for the port to be fully released so the fresh tunnel binds cleanly and we
    # don't race a just-killed socket that still briefly accepts connections.
    $freeDeadline = (Get-Date).AddSeconds(8)
    while (((Get-Date) -lt $freeDeadline) -and (Test-PortConnectable -Port $ThanosLocalPort)) { Start-Sleep -Milliseconds 300 }

    Write-Step 'Starting Thanos querier tunnel'
    $ocArgs = New-Object System.Collections.Generic.List[string]
    if (-not [string]::IsNullOrWhiteSpace($KubeConfigPath)) { $ocArgs.Add('--kubeconfig'); $ocArgs.Add($KubeConfigPath) }
    if (-not [string]::IsNullOrWhiteSpace($KubeContext)) { $ocArgs.Add('--context'); $ocArgs.Add($KubeContext) }
    foreach ($a in @('-n', 'openshift-monitoring', 'port-forward', 'svc/thanos-querier', "${ThanosLocalPort}:9091", '--address', '0.0.0.0')) { $ocArgs.Add($a) }
    $null = Start-ManagedProcess -Name 'thanos-tunnel' -FilePath 'oc' -ArgumentList $ocArgs.ToArray() -WorkingDirectory $PortalRoot -PidFile $ThanosTunnelPidFile -StdOutLog $ThanosTunnelOutLog -StdErrLog $ThanosTunnelErrLog
    try {
        # Wait until the tunnel actually accepts connections, not merely LISTENs.
        $ready = $false
        $deadline = (Get-Date).AddSeconds(25)
        while ((Get-Date) -lt $deadline) {
            if (Test-PortConnectable -Port $ThanosLocalPort) { $ready = $true; break }
            Start-Sleep -Milliseconds 500
        }
        if (-not $ready) { throw "port $ThanosLocalPort did not become connectable within 25s" }
        Write-Info "Thanos tunnel forwarding on 0.0.0.0:$ThanosLocalPort -> svc/thanos-querier:9091."
    }
    catch {
        Write-Warning "Thanos tunnel did not become ready: $($_.Exception.Message). Prometheus panels may show no data."
    }
}

function Start-LogicAppPortForward {
    param([string]$PodResource)

    if (-not $UsePortForward) {
        return [pscustomobject]@{ Reused = $false; Started = $false; BaseUrl = $LogicAppBaseUrl.TrimEnd('/'); Target = $null }
    }

    $localUrl = "http://127.0.0.1:$LocalLogicAppPort"
    if (Test-PortListening -Port $LocalLogicAppPort) {
        Write-Info "Reusing existing listener on port $LocalLogicAppPort for Logic Apps API access."
        return [pscustomobject]@{ Reused = $true; Started = $false; BaseUrl = $localUrl; Target = $PodResource }
    }

    Write-Step 'Starting oc port-forward'
    $null = Start-ManagedProcess -Name 'oc port-forward' -FilePath 'oc' -ArgumentList @('-n', $Namespace, 'port-forward', $PodResource, "${LocalLogicAppPort}:${RemoteLogicAppPort}", '--address', '127.0.0.1') -WorkingDirectory $PortalRoot -PidFile $PortForwardPidFile -StdOutLog $PortForwardOutLog -StdErrLog $PortForwardErrLog
    Wait-PortListening -Port $LocalLogicAppPort -TimeoutSeconds 20 -Description 'Logic Apps port-forward'
    Write-Info "Port-forward established: $PodResource -> $localUrl"
    [pscustomobject]@{ Reused = $false; Started = $true; BaseUrl = $localUrl; Target = $PodResource }
}

function Get-WorkflowMetadata {
    Write-Step 'Discovering workflows from Logic Apps management API'

    $code = [uri]::EscapeDataString($MasterKey)
    $response = Invoke-LogicAppRequest -Method GET -RelativePath "/runtime/webhooks/workflow/api/management/workflows?api-version=2020-05-01-preview&code=$code"
    $workflowItems = @(
        if ($response -and ($response.PSObject.Properties.Name -contains 'value')) { @($response.value) } else { @($response) }
    )
    if (-not $workflowItems -or $workflowItems.Count -eq 0) {
        Write-Warning 'No workflows were returned by the Logic Apps management API. Continuing with SQL table-only mapping.'
        return @()
    }

    $workflows = @(
        foreach ($workflow in $workflowItems) {
        $workflowName = [string]$workflow.name
        $detail = Invoke-LogicAppRequest -Method GET -RelativePath ("/runtime/webhooks/workflow/api/management/workflows/{0}?api-version=2020-05-01-preview&code={1}" -f ([uri]::EscapeDataString($workflowName)), $code)
        $triggerSource = $detail.triggers
        if (-not $triggerSource -and $detail.properties) {
            $triggerSource = $detail.properties.triggers
        }
        $triggers = if ($triggerSource) { @($triggerSource.PSObject.Properties.Name | Sort-Object -Unique) } else { @() }

        [pscustomobject]@{
            Name       = $workflowName
            Triggers   = $triggers
            DetailJson = ($detail | ConvertTo-Json -Depth 50 -Compress)
            ItemJson   = ($workflow | ConvertTo-Json -Depth 20 -Compress)
            Normalized = ($workflowName.ToLowerInvariant() -replace '[^a-z0-9]', '')
        }
        }
    )

    $workflowNames = @(
        $workflows |
        Where-Object { $_ -and $_.PSObject.Properties.Name -contains 'Name' -and -not [string]::IsNullOrWhiteSpace([string]$_.Name) } |
        ForEach-Object { [string]$_.Name }
    )
    $workflowCount = @($workflows).Count
    Write-Info "Discovered $workflowCount workflow(s): $($workflowNames -join ', ')"
    $workflows
}

function Get-SqlMetadata {
    Write-Step 'Discovering SQL run tables'

    $tableRows = Invoke-SqlQuery -Query @"
SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE 'flow%runs'
ORDER BY TABLE_SCHEMA, TABLE_NAME;
"@
    if ($tableRows.Rows.Count -eq 0) {
        throw "No SQL run tables matching 'flow%runs' were found in database '$SqlDatabase'."
    }

    $jobTableRows = Invoke-SqlQuery -Query @"
SELECT TOP 1 TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE 'flow%jobdefinitions'
ORDER BY TABLE_SCHEMA, TABLE_NAME;
"@
    $jobTable = if ($jobTableRows.Rows.Count -gt 0) {
        [pscustomobject]@{
            SchemaName = [string]$jobTableRows.Rows[0].TABLE_SCHEMA
            TableName  = [string]$jobTableRows.Rows[0].TABLE_NAME
        }
    }
    else {
        $null
    }

    $tables = foreach ($row in $tableRows.Rows) {
        $schemaName = [string]$row.TABLE_SCHEMA
        $tableName = [string]$row.TABLE_NAME
        $triggerRows = Invoke-SqlQuery -Query ("SELECT DISTINCT TOP 10 TriggerName FROM [{0}].[{1}] WHERE TriggerName IS NOT NULL ORDER BY TriggerName;" -f (Escape-SqlIdentifier $schemaName), (Escape-SqlIdentifier $tableName))
        $tableHash = if ($tableName -match '^flow([a-f0-9]{32})runs$') { $Matches[1] } else { $null }

        [pscustomobject]@{
            SchemaName = $schemaName
            TableName  = $tableName
            Triggers   = @($triggerRows.Rows | ForEach-Object { [string]$_.TriggerName } | Where-Object { $_ })
            TableHash  = $tableHash
        }
    }

    Write-Info "Discovered $($tables.Count) SQL run table(s)."
    [pscustomobject]@{ Tables = $tables; JobTable = $jobTable }
}

function Add-MappingResult {
    param(
        [System.Collections.Generic.List[object]]$Mappings,
        [System.Collections.Generic.HashSet[string]]$UsedTables,
        [object]$Workflow,
        [object]$Table,
        [string]$Method
    )

    if ($UsedTables.Contains($Table.TableName)) {
        return
    }

    $null = $UsedTables.Add($Table.TableName)
    $Mappings.Add([pscustomobject]@{
        WorkflowName  = $Workflow.Name
        TableName     = $Table.TableName
        SchemaName    = $Table.SchemaName
        Triggers      = $Workflow.Triggers
        MappingMethod = $Method
    })
}

function Get-WorkflowTableMapping {
    param(
        [object[]]$Workflows,
        [object[]]$Tables
    )

    Write-Step 'Mapping workflows to SQL run tables'

    $mappings = New-Object 'System.Collections.Generic.List[object]'
    $usedTables = New-Object 'System.Collections.Generic.HashSet[string]'
    $candidateWorkflows = @(
        @($Workflows) |
        Where-Object {
            $_ -and $_.PSObject -and
            ($_.PSObject.Properties.Name -contains 'Name') -and
            -not [string]::IsNullOrWhiteSpace([string]$_.Name)
        } |
        ForEach-Object {
            [pscustomobject]@{
                Name       = [string]$_.Name
                Triggers   = @($_.Triggers)
                DetailJson = [string]$_.DetailJson
                ItemJson   = [string]$_.ItemJson
                Normalized = if (-not [string]::IsNullOrWhiteSpace([string]$_.Normalized)) { [string]$_.Normalized } else { ([string]$_.Name).ToLowerInvariant() -replace '[^a-z0-9]', '' }
            }
        }
    )

    function Get-MappedWorkflowNames {
        @($mappings | ForEach-Object { if ($_.PSObject.Properties.Name -contains 'WorkflowName') { [string]$_.WorkflowName } })
    }

    function Get-TableLatestCreatedTime {
        param([object]$Table)

        $schema = Escape-SqlIdentifier $Table.SchemaName
        $name = Escape-SqlIdentifier $Table.TableName
        $row = Invoke-SqlQuery -Query ("SELECT TOP 1 CreatedTime FROM [{0}].[{1}] ORDER BY CreatedTime DESC;" -f $schema, $name)
        if ($row.Rows.Count -gt 0 -and $row.Rows[0].CreatedTime) {
            return [datetime]$row.Rows[0].CreatedTime
        }

        return [datetime]::MinValue
    }

    if (-not $candidateWorkflows -or $candidateWorkflows.Count -eq 0) {
        foreach ($table in ($Tables | Sort-Object TableName)) {
            $tableLabel = if ($table.TableName -match '^flow([a-f0-9]{32})runs$') {
                "workflow-$($Matches[1].Substring(0,8))"
            } else {
                $table.TableName
            }

            $mappings.Add([pscustomobject]@{
                WorkflowName  = $tableLabel
                TableName     = $table.TableName
                SchemaName    = $table.SchemaName
                Triggers      = @($table.Triggers)
                MappingMethod = 'table-only-fallback'
            })
            $null = $usedTables.Add($table.TableName)
        }
    }

    foreach ($workflow in $candidateWorkflows) {
        $matchByHash = @($Tables | Where-Object {
            -not $usedTables.Contains($_.TableName) -and $_.TableHash -and (
                $workflow.DetailJson -match [regex]::Escape($_.TableHash) -or
                $workflow.ItemJson -match [regex]::Escape($_.TableHash)
            )
        })
        if ($matchByHash.Count -eq 1) {
            Add-MappingResult -Mappings $mappings -UsedTables $usedTables -Workflow $workflow -Table $matchByHash[0] -Method 'hash-match'
        }
    }

    foreach ($workflow in $candidateWorkflows | Where-Object { $_.Name -notin (Get-MappedWorkflowNames) }) {
        $triggerCandidates = @()
        foreach ($trigger in $workflow.Triggers) {
            $triggerCandidates += $Tables | Where-Object { -not $usedTables.Contains($_.TableName) -and ($_.Triggers -contains $trigger) }
        }
        $triggerCandidates = @($triggerCandidates | Sort-Object TableName -Unique)
        if ($triggerCandidates.Count -eq 1) {
            Add-MappingResult -Mappings $mappings -UsedTables $usedTables -Workflow $workflow -Table $triggerCandidates[0] -Method 'trigger-name-match'
        }
    }

    foreach ($workflow in $candidateWorkflows | Where-Object { $_.Name -notin (Get-MappedWorkflowNames) }) {
        $nameCandidates = @($Tables | Where-Object {
            -not $usedTables.Contains($_.TableName) -and $_.TableName.ToLowerInvariant().Contains($workflow.Normalized)
        })
        if ($nameCandidates.Count -eq 1) {
            Add-MappingResult -Mappings $mappings -UsedTables $usedTables -Workflow $workflow -Table $nameCandidates[0] -Method 'name-match'
        }
    }

    $remainingWorkflows = @($candidateWorkflows | Where-Object { $_.Name -notin (Get-MappedWorkflowNames) } | Sort-Object Name)
    foreach ($workflow in $remainingWorkflows) {
        $remainingTables = @($Tables | Where-Object { -not $usedTables.Contains($_.TableName) })
        if ($remainingTables.Count -eq 0) {
            break
        }

        $bestTable = $remainingTables |
            Sort-Object @{ Expression = { Get-TableLatestCreatedTime $_ }; Descending = $true }, @{ Expression = { $_.TableName } } |
            Select-Object -First 1

        Add-MappingResult -Mappings $mappings -UsedTables $usedTables -Workflow $workflow -Table $bestTable -Method 'latest-activity-fallback'
    }

    if ($mappings.Count -eq 0) {
        throw 'Unable to map any workflows to SQL run tables.'
    }

    Set-Content -LiteralPath $WorkflowMapFile -Value ($mappings | ConvertTo-Json -Depth 10) -Encoding UTF8
    foreach ($mapping in $mappings) {
        Write-Info ("Mapped workflow '{0}' to table [{1}].[{2}] via {3}." -f $mapping.WorkflowName, $mapping.SchemaName, $mapping.TableName, $mapping.MappingMethod)
    }

    @($mappings.ToArray())
}

function New-GridPos([int]$h, [int]$w, [int]$x, [int]$y) {
    [ordered]@{ h = $h; w = $w; x = $x; y = $y }
}

# Group a flat panel list into collapsible "tab" rows. Each area becomes a
# Grafana row panel; the first area stays expanded, the rest are collapsed with
# their panels nested inside (Grafana's accordion model). Panels are re-packed
# into a clean 24-column grid within each area.
function ConvertTo-AccordionPanels {
    param([object[]]$Panels)

    $areas = @(
        @{ Title = 'Overview & Health'; Titles = @('Total Runs','Succeeded','Failed','Avg Duration','Retry Count','Success Rate','Cluster Pods','Pods Running','Pods Failed','Pods CrashLooping','Pods Pending','Cluster Health Rate','Pod Health (per Pod)','Volume Mounts') }
        @{ Title = 'Management'; Titles = @('Logic App Manager') }
        @{ Title = 'Workflows'; Titles = @('Workflow Manager','Run Status Distribution','P50 / P95 / P99 Latency (sec)','Top Failed Workflows','Runs Over Time (All Workflows)','Execution Duration Over Time','Workflow Execution Errors (SQL)'); Like = @('* - Runs Over Time','* - Recent Runs') }
        @{ Title = 'Resource Metrics'; Titles = @('Total Runs Over Time','Total Action Executions Over Time','Pod Instances','CPU Usage (cores)','Memory Usage (MB)','CPU by Container','Memory by Container (MB)','Network I/O','Pod Restarts','Infrastructure Metrics') }
    )
    $otherTitle = 'Other'

    $buckets = [ordered]@{}
    foreach ($a in $areas) { $buckets[$a.Title] = (New-Object System.Collections.ArrayList) }
    $buckets[$otherTitle] = (New-Object System.Collections.ArrayList)

    foreach ($p in $Panels) {
        if ($p.type -eq 'row') { continue }
        $title = [string]$p.title
        $placed = $false
        foreach ($a in $areas) {
            $hit = ($a.Titles -contains $title)
            if (-not $hit -and $a.ContainsKey('Like')) { foreach ($pat in $a.Like) { if ($title -like $pat) { $hit = $true; break } } }
            if ($hit) { $null = $buckets[$a.Title].Add($p); $placed = $true; break }
        }
        if (-not $placed) { $null = $buckets[$otherTitle].Add($p) }
    }

    $orderedTitles = New-Object System.Collections.ArrayList
    foreach ($a in $areas) { if ($buckets[$a.Title].Count -gt 0) { $null = $orderedTitles.Add($a.Title) } }
    if ($buckets[$otherTitle].Count -gt 0) { $null = $orderedTitles.Add($otherTitle) }

    # Row ids must not collide with existing panel ids.
    $maxId = 0
    foreach ($p in $Panels) { if ($p.id -and ([int]$p.id -gt $maxId)) { $maxId = [int]$p.id } }
    $rowId = $maxId

    $packGrid = {
        param($children, [int]$startY)
        $x = 0; $yy = $startY; $rowMaxH = 0
        foreach ($c in $children) {
            $w = [int]$c.gridPos.w; if (($w -le 0) -or ($w -gt 24)) { $w = 24 }
            $h = [int]$c.gridPos.h; if ($h -le 0) { $h = 8 }
            if (($x + $w) -gt 24) { $yy += $rowMaxH; $x = 0; $rowMaxH = 0 }
            $c.gridPos = [ordered]@{ h = $h; w = $w; x = $x; y = $yy }
            $x += $w; if ($h -gt $rowMaxH) { $rowMaxH = $h }
        }
        return ($yy + $rowMaxH)
    }

    $out = New-Object System.Collections.ArrayList
    $y = 0
    $idx = 0
    foreach ($t in $orderedTitles) {
        $children = @($buckets[$t])
        $rowId++
        $collapsed = ($idx -ne 0)
        $row = [ordered]@{ id = $rowId; title = $t; type = 'row'; collapsed = $collapsed; gridPos = (New-GridPos 1 24 0 $y) }
        $y += 1
        if ($collapsed) {
            $null = (& $packGrid $children ($row.gridPos.y + 1))
            $row.panels = $children
            $null = $out.Add($row)
        } else {
            $row.panels = @()
            $null = $out.Add($row)
            $y = (& $packGrid $children $y)
            foreach ($c in $children) { $null = $out.Add($c) }
        }
        $idx++
    }
    ,$out
}

function New-DashboardObject {
    param(
        [object[]]$WorkflowMappings,
        [object]$JobTable,
        [bool]$HasPrometheus,
        [string]$DashboardAppName,
        [string[]]$DashboardAppNames,
        [string]$DashboardUid,
       [string]$DashboardTitle,
       [bool]$IncludeLiveAppPanels = $true
    )

    $panels = New-Object System.Collections.ArrayList
    $script:PanelCounter = 0
    $grafanaAppVar = '$' + '{app}'
    $grafanaWorkflowVar = '$' + '{workflow}'
    $grafanaWorkflowSql = '$' + '{workflow:sqlstring}'
    $workflowFilterClause = if ($IncludeLiveAppPanels) { "AND ('" + $grafanaWorkflowVar + "' = '*' OR FlowName IN (" + $grafanaWorkflowSql + "))" } else { '' }
    $podRegex = '^' + $grafanaAppVar + '.*'

    function Next-PanelId {
        $script:PanelCounter++
        $script:PanelCounter
    }

    function New-SqlTarget([string]$RefId, [string]$RawSql, [string]$Format = 'table') {
        [ordered]@{ refId = $RefId; rawSql = $RawSql; format = $Format }
    }

    function New-KpiApiTarget([string]$Selector) {
        [ordered]@{
            refId = 'A'
            type = 'json'
            source = 'url'
            format = 'table'
            parser = 'backend'
            datasource = @{ type = 'yesoreyeram-infinity-datasource'; uid = 'logicapps-kpi-api' }
            url = 'http://host.docker.internal:3001/api/kpi/summary?window=24h&app=' + $grafanaAppVar
            url_options = @{ method = 'GET'; data = '' }
            root_selector = ''
            json_options = @{ columnar = $false; root_is_not_array = $true }
            columns = @(@{ selector = $Selector; text = 'value'; type = 'number' })
            filters = @()
            global_query_id = ''
        }
    }

    function New-KpiTimeseriesTarget([string]$Selector) {
        [ordered]@{
            refId = 'A'
            type = 'json'
            source = 'url'
            format = 'table'
            parser = 'backend'
            datasource = @{ type = 'yesoreyeram-infinity-datasource'; uid = 'logicapps-kpi-api' }
            url = 'http://host.docker.internal:3001/api/kpi/timeseries?window=24h&app=' + $grafanaAppVar
            url_options = @{ method = 'GET'; data = '' }
            root_selector = 'series'
            json_options = @{ columnar = $false; root_is_not_array = $false }
            columns = @(
                @{ selector = 'time'; text = 'time'; type = 'timestamp_epoch' },
                @{ selector = $Selector; text = 'value'; type = 'number' }
            )
            filters = @()
            global_query_id = ''
        }
    }

    function New-PromTarget([string]$RefId, [string]$Expr, [string]$LegendFormat, [bool]$Instant = $false, [string]$Format = $null) {
        $target = [ordered]@{ refId = $RefId; expr = $Expr; legendFormat = $LegendFormat }
        if ($Instant) { $target.instant = $true }
        if ($Format) { $target.format = $Format }
        $target
    }

    function New-DynamicFlowRunsQuery {
        param(
            [Parameter(Mandatory)][string]$QueryBody,
            [string]$WorkflowName = ''
        )

        $escapedSchema = Escape-SqlString $runSchema
        $escapedWorkflow = Escape-SqlString $WorkflowName
        $resolvedBody = $QueryBody -replace '\$workflowFilterClause', $workflowFilterClause
        $escapedBody = $resolvedBody -replace "'", "''"

        @"
DECLARE @from DATETIME = `$__timeFrom();
DECLARE @to DATETIME = `$__timeTo();
DECLARE @workflow NVARCHAR(512) = N'$escapedWorkflow';
DECLARE @u NVARCHAR(MAX) = N'';
SELECT @u = @u + CASE WHEN @u = N'' THEN N'' ELSE N' UNION ALL ' END +
  N'SELECT CreatedTime, EndTime, Status, TriggerName, FlowRunSequenceId, Code, COALESCE(NULLIF(LTRIM(RTRIM(FlowName)),''''), N''' + REPLACE(t.name,'''','''''') + N''') AS FlowName FROM [$escapedSchema].[' + t.name + N']'
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = N'$escapedSchema'
  AND t.name LIKE N'flow%runs';
IF @u = N'' SET @u = N'SELECT CAST(NULL AS DATETIME) AS CreatedTime, CAST(NULL AS DATETIME) AS EndTime, CAST(NULL AS NVARCHAR(50)) AS Status, CAST(NULL AS NVARCHAR(255)) AS TriggerName, CAST(NULL AS NVARCHAR(255)) AS FlowRunSequenceId, CAST(NULL AS NVARCHAR(255)) AS Code, CAST(NULL AS NVARCHAR(255)) AS FlowName WHERE 1=0';
DECLARE @sql NVARCHAR(MAX) = N'
WITH runs AS (
  SELECT * FROM (' + @u + N') src
  WHERE src.CreatedTime >= @from
    AND src.CreatedTime < @to
)
$escapedBody';
EXEC sp_executesql @sql, N'@from DATETIME,@to DATETIME,@workflow NVARCHAR(512)', @from = @from, @to = @to, @workflow = @workflow;
"@
    }

    $runSchema = if ($WorkflowMappings -and $WorkflowMappings[0].SchemaName) { $WorkflowMappings[0].SchemaName } else { 'dt' }
    # Discover every per-workflow run table (Logic Apps creates a new flow<hash>runs table on
    # each redeploy) at query time and aggregate by FlowName so new runs always show up.
    $inventoryQuery = @'
DECLARE @u NVARCHAR(MAX) = N'';
SELECT @u = @u + CASE WHEN @u=N'' THEN N'' ELSE N' UNION ALL ' END +
  N'SELECT FlowName, Status, CreatedTime, EndTime FROM [__SCHEMA__].[' + t.name + N']'
FROM sys.tables t JOIN sys.schemas s ON t.schema_id=s.schema_id AND s.name=N'__SCHEMA__'
WHERE t.name LIKE N'flow%runs';
IF @u = N'' SET @u = N'SELECT CAST(NULL AS NVARCHAR(200)) AS FlowName, CAST(NULL AS NVARCHAR(50)) AS Status, CAST(NULL AS DATETIME) AS CreatedTime, CAST(NULL AS DATETIME) AS EndTime WHERE 1=0';
DECLARE @sql NVARCHAR(MAX) = N'
SELECT FlowName AS [Workflow],
  CASE
    WHEN SUM(CASE WHEN Status=''Failed'' THEN 1 ELSE 0 END) > 5 THEN ''Critical''
    WHEN SUM(CASE WHEN Status=''Failed'' THEN 1 ELSE 0 END) > 0 THEN ''Warning''
    WHEN SUM(CASE WHEN Status=''Running'' THEN 1 ELSE 0 END) > 0 THEN ''Running''
    WHEN COUNT(*) = 0 THEN ''Empty''
    ELSE ''Healthy''
  END AS Health,
  COUNT(*) AS [Total Runs],
  SUM(CASE WHEN Status=''Succeeded'' THEN 1 ELSE 0 END) AS [Succeeded],
  SUM(CASE WHEN Status=''Failed'' THEN 1 ELSE 0 END) AS [Failed],
  CAST(SUM(CASE WHEN Status=''Succeeded'' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0) AS DECIMAL(5,1)) AS [Success%],
  CAST(AVG(CASE WHEN EndTime IS NOT NULL AND EndTime > CreatedTime THEN DATEDIFF(MILLISECOND, CreatedTime, EndTime) END) / 1000.0 AS DECIMAL(10,2)) AS [Avg(s)],
  CAST(MIN(CASE WHEN EndTime IS NOT NULL AND EndTime > CreatedTime THEN DATEDIFF(MILLISECOND, CreatedTime, EndTime) END) / 1000.0 AS DECIMAL(10,3)) AS [Min(s)],
  CAST(MAX(CASE WHEN EndTime IS NOT NULL AND EndTime > CreatedTime THEN DATEDIFF(MILLISECOND, CreatedTime, EndTime) END) / 1000.0 AS DECIMAL(10,3)) AS [Max(s)],
  MAX(CreatedTime) AS [Last Run]
FROM (' + @u + N') x
WHERE FlowName IS NOT NULL
GROUP BY FlowName
ORDER BY [Failed] DESC, [Total Runs] DESC';
EXEC sp_executesql @sql;
'@ -replace '__SCHEMA__', $runSchema

    $latencyQuery = New-DynamicFlowRunsQuery -QueryBody @'
SELECT Workflow,
  CAST(P50 / 1000.0 AS DECIMAL(10,3)) AS P50,
  CAST(P95 / 1000.0 AS DECIMAL(10,3)) AS P95,
  CAST(P99 / 1000.0 AS DECIMAL(10,3)) AS P99,
  Runs
FROM (
  SELECT FlowName AS Workflow,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY DATEDIFF(MILLISECOND, CreatedTime, EndTime)) OVER(PARTITION BY FlowName) AS P50,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY DATEDIFF(MILLISECOND, CreatedTime, EndTime)) OVER(PARTITION BY FlowName) AS P95,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY DATEDIFF(MILLISECOND, CreatedTime, EndTime)) OVER(PARTITION BY FlowName) AS P99,
    COUNT(*) OVER(PARTITION BY FlowName) AS Runs,
    ROW_NUMBER() OVER (PARTITION BY FlowName ORDER BY CreatedTime DESC) AS rn
  FROM runs
  WHERE EndTime IS NOT NULL AND EndTime > CreatedTime $workflowFilterClause
) t
WHERE rn = 1
ORDER BY Runs DESC
'@

    $topFailedQuery = New-DynamicFlowRunsQuery -QueryBody @'
SELECT
  FlowName AS Workflow,
  SUM(CASE WHEN Status = 'Failed' THEN 1 ELSE 0 END) AS [Failed],
  CAST(SUM(CASE WHEN Status = 'Failed' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0) AS DECIMAL(5,1)) AS [Failure%]
FROM runs
WHERE 1 = 1 $workflowFilterClause
GROUP BY FlowName
ORDER BY [Failed] DESC, [Failure%] DESC
'@

    $retryQuery = if ($JobTable) {
        'SELECT ISNULL(SUM(CurrentRetryCount), 0) AS retries FROM [{0}].[{1}] WHERE JobId LIKE ''FlowTriggerJob%%''' -f (Escape-SqlIdentifier $JobTable.SchemaName), (Escape-SqlIdentifier $JobTable.TableName)
    }
    else {
        'SELECT 0 AS retries'
    }

    $jobCaseLines = foreach ($mapping in $WorkflowMappings) {
        foreach ($trigger in $mapping.Triggers | Select-Object -Unique) {
            if ($trigger) {
                '    WHEN JobId LIKE ''%{0}%'' THEN ''{1}''' -f (Escape-SqlString $trigger), (Escape-SqlString $mapping.WorkflowName)
            }
        }
    }
    $triggerJobsQuery = if ($JobTable) {
        @(
            'SELECT'
            '  CASE'
            ($jobCaseLines -join "`n")
            '    ELSE JobPartition'
            '  END AS Workflow,'
            '  JobId AS [Trigger Job],'
            '  State,'
            '  LastExecutionStatus AS [Last Status],'
            '  LastExecutionTime AS [Last Exec],'
            '  NextExecutionTime AS [Next Exec],'
            '  TotalSucceededCount AS Succeeded,'
            '  TotalFailedCount AS Failed,'
            '  CurrentRetryCount AS Retries'
            ('FROM [{0}].[{1}]' -f (Escape-SqlIdentifier $JobTable.SchemaName), (Escape-SqlIdentifier $JobTable.TableName))
            'WHERE JobId LIKE ''FlowTriggerJob%'''
            'ORDER BY LastExecutionTime DESC'
        ) -join "`n"
    }
    else {
        'SELECT ''Job definition table not found'' AS [Info]'
    }

    $workflowErrorsQuery = New-DynamicFlowRunsQuery -QueryBody @'
SELECT TOP 50
  FlowName AS Workflow,
  FlowRunSequenceId AS RunId,
  Status,
  Code,
  TriggerName,
  CreatedTime,
  EndTime,
  DATEDIFF(MILLISECOND, CreatedTime, EndTime) AS Duration_ms
FROM runs
WHERE Status = 'Failed' $workflowFilterClause
ORDER BY CreatedTime DESC
'@

    $escapedSqlServer = Escape-SqlString $SqlServer
    $escapedNamespace = Escape-SqlString $Namespace
    $volumeTableRows = New-Object System.Collections.Generic.List[string]
    $volumeTableRows.Add(("SELECT 'workflows-root' AS [Volume], '/home/site/wwwroot' AS [Mount Path], '\\{0}\storage' AS [SMB Server\Share], 'ReadWrite' AS [Access], '{1}' AS [Namespace]" -f $escapedSqlServer, $escapedNamespace))
    foreach ($mapping in ($WorkflowMappings | Sort-Object WorkflowName -Unique)) {
        $workflowName = Escape-SqlString $mapping.WorkflowName
        $volumeTableRows.Add(("SELECT '{0}' AS [Volume], '/home/site/wwwroot/{0}' AS [Mount Path], '\\{1}\storage\{0}' AS [SMB Server\Share], 'ReadWrite' AS [Access], '{2}' AS [Namespace]" -f $workflowName, $escapedSqlServer, $escapedNamespace))
    }
    $volumeTableQuery = $volumeTableRows -join "`nUNION ALL`n"

    $allExecutionTargets = @()
    $targetRefIndex = 0
    foreach ($mapping in $WorkflowMappings) {
        $targetRefIndex++
        $refId = [char](64 + [Math]::Min($targetRefIndex, 26))
        $allExecutionTargets += New-SqlTarget -RefId $refId -Format 'time_series' -RawSql (New-DynamicFlowRunsQuery -WorkflowName $mapping.WorkflowName -QueryBody ('SELECT CreatedTime AS time, DATEDIFF(MILLISECOND, CreatedTime, EndTime) AS [{0}] FROM runs WHERE EndTime IS NOT NULL AND EndTime > CreatedTime ORDER BY time' -f (Escape-SqlIdentifier $mapping.WorkflowName)))
    }

    $totalRunsQuery = New-DynamicFlowRunsQuery -QueryBody @'
SELECT $__timeGroupAlias(CreatedTime, $__interval), COUNT(*) AS [Total Runs]
FROM runs
WHERE 1 = 1 $workflowFilterClause
GROUP BY $__timeGroup(CreatedTime, $__interval)
ORDER BY 1
'@
    $succeededQuery = New-DynamicFlowRunsQuery -QueryBody @'
SELECT $__timeGroupAlias(CreatedTime, $__interval), COUNT(*) AS [Succeeded]
FROM runs
WHERE Status = ''Succeeded'' $workflowFilterClause
GROUP BY $__timeGroup(CreatedTime, $__interval)
ORDER BY 1
'@
    $failedQuery = New-DynamicFlowRunsQuery -QueryBody @'
SELECT $__timeGroupAlias(CreatedTime, $__interval), COUNT(*) AS [Failed]
FROM runs
WHERE Status = ''Failed'' $workflowFilterClause
GROUP BY $__timeGroup(CreatedTime, $__interval)
ORDER BY 1
'@
    $avgDurationQuery = New-DynamicFlowRunsQuery -QueryBody @'
SELECT $__timeGroupAlias(CreatedTime, $__interval), CAST(AVG(DATEDIFF(MILLISECOND, CreatedTime, EndTime)) / 1000.0 AS DECIMAL(10,2)) AS [Avg Duration]
FROM runs
WHERE EndTime IS NOT NULL AND EndTime > CreatedTime $workflowFilterClause
GROUP BY $__timeGroup(CreatedTime, $__interval)
ORDER BY 1
'@
    $successRateQuery = New-DynamicFlowRunsQuery -QueryBody @'
SELECT CAST(ISNULL(SUM(CASE WHEN Status = ''Succeeded'' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 0) AS DECIMAL(5,1)) AS success_rate
FROM runs
WHERE 1 = 1 $workflowFilterClause
'@
    # Single query returns all three status categories as fixed rows (so zero-count
    # states still render) for the donut. A one-frame [metric, value] result is the
    # canonical piechart input with reduceOptions.values=true; the previous 3-target +
    # merge shape did not render reliably on Grafana 13.
    $statusDistributionQuery = New-DynamicFlowRunsQuery -QueryBody @'
SELECT 'Succeeded' AS metric, SUM(CASE WHEN Status = 'Succeeded' THEN 1 ELSE 0 END) AS value FROM runs WHERE 1 = 1 $workflowFilterClause
UNION ALL
SELECT 'Failed' AS metric, SUM(CASE WHEN Status = 'Failed' THEN 1 ELSE 0 END) AS value FROM runs WHERE 1 = 1 $workflowFilterClause
UNION ALL
SELECT 'Running' AS metric, SUM(CASE WHEN Status = 'Running' THEN 1 ELSE 0 END) AS value FROM runs WHERE 1 = 1 $workflowFilterClause
'@

    # Overview KPI trend stats (Total Runs / Succeeded / Failed) query the durable SQL
    # run-history tables over the dashboard time range so the stat value AND its sparkline
    # reflect all runs, not the ~40/workflow cap of the live management KPI API.
    # NOTE(psrivas): the time bucket is built with DATEADD/DATEDIFF anchored at @from and
    # is deliberately quote-free. The $__timeGroup macro expands to a date string literal
    # ('1970-01-01') whose single quotes terminate the dynamic @sql N'...' literal early,
    # yielding "Must declare the scalar variable @sql". Any Status filter must therefore use
    # doubled quotes (''Succeeded'') so it survives one level of dynamic-SQL parsing.
    $kpiTrendTemplate = @'
SET NOCOUNT ON;
DECLARE @from DATETIME = $__timeFrom();
DECLARE @to   DATETIME = $__timeTo();
DECLARE @bmin INT = CASE WHEN DATEDIFF(MINUTE,@from,@to)<=0 THEN 1 ELSE (DATEDIFF(MINUTE,@from,@to)/120)+1 END;
DECLARE @union NVARCHAR(MAX)=N'';
SELECT @union = @union + CASE WHEN @union=N'' THEN N'' ELSE N' UNION ALL ' END +
   N'SELECT CreatedTime, Status FROM [dt].'+QUOTENAME(t.name)
FROM sys.tables t JOIN sys.schemas s ON t.schema_id=s.schema_id
WHERE s.name='dt' AND t.name LIKE 'flow%runs';
IF @union=N'' SET @union=N'SELECT CAST(NULL AS DATETIME) AS CreatedTime, CAST(NULL AS NVARCHAR(64)) AS Status WHERE 1=0';
DECLARE @sql NVARCHAR(MAX)=
  N'SELECT DATEADD(MINUTE,(DATEDIFF(MINUTE,@from,CreatedTime)/@bmin)*@bmin,@from) AS time, COUNT(*) AS [__VALUECOL__]
    FROM ('+@union+N') x WHERE CreatedTime>=@from AND CreatedTime<@to __STATUSFILTER__
    GROUP BY DATEADD(MINUTE,(DATEDIFF(MINUTE,@from,CreatedTime)/@bmin)*@bmin,@from) ORDER BY 1';
EXEC sp_executesql @sql, N'@from DATETIME,@to DATETIME,@bmin INT',@from,@to,@bmin;
'@
    $statTotalRunsQuery = $kpiTrendTemplate.Replace('__VALUECOL__', 'Runs').Replace('__STATUSFILTER__', '')
    $statSucceededQuery = $kpiTrendTemplate.Replace('__VALUECOL__', 'Succeeded').Replace('__STATUSFILTER__', "AND Status=''Succeeded''")
    $statFailedQuery    = $kpiTrendTemplate.Replace('__VALUECOL__', 'Failed').Replace('__STATUSFILTER__', "AND Status=''Failed''")

    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Total Runs'; type = 'stat'; gridPos = (New-GridPos 5 4 0 0)
        targets = @((New-SqlTarget -RefId 'A' -Format 'time_series' -RawSql $statTotalRunsQuery))
        fieldConfig = @{ defaults = @{ noValue = '0'; color = @{ mode = 'thresholds' }; thresholds = @{ steps = @(@{ value = $null; color = 'blue' }) } } }
        options = @{ reduceOptions = @{ calcs = @('sum') }; textMode = 'value_and_name'; colorMode = 'value'; graphMode = 'area' }
    })
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Succeeded'; type = 'stat'; gridPos = (New-GridPos 5 4 4 0)
        targets = @((New-SqlTarget -RefId 'A' -Format 'time_series' -RawSql $statSucceededQuery))
        fieldConfig = @{ defaults = @{ noValue = '0'; color = @{ mode = 'thresholds' }; thresholds = @{ steps = @(@{ value = $null; color = 'green' }) } } }
        options = @{ reduceOptions = @{ calcs = @('sum') }; textMode = 'value_and_name'; colorMode = 'value'; graphMode = 'area' }
    })
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Failed'; type = 'stat'; gridPos = (New-GridPos 5 4 8 0)
        targets = @((New-SqlTarget -RefId 'A' -Format 'time_series' -RawSql $statFailedQuery))
        fieldConfig = @{ defaults = @{ noValue = '0'; color = @{ mode = 'thresholds' }; thresholds = @{ steps = @(@{ value = $null; color = 'green' }, @{ value = 1; color = 'red' }) } } }
        options = @{ reduceOptions = @{ calcs = @('sum') }; textMode = 'value_and_name'; colorMode = 'value'; graphMode = 'area' }
    })
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Avg Duration'; type = 'stat'; gridPos = (New-GridPos 5 4 12 0)
        targets = @((New-KpiApiTarget -Selector 'avgDurationSec'))
        fieldConfig = @{ defaults = @{ unit = 's'; color = @{ mode = 'thresholds' }; thresholds = @{ steps = @(@{ value = $null; color = 'purple' }) } } }
        options = @{ reduceOptions = @{ calcs = @('lastNotNull') }; textMode = 'value_and_name'; colorMode = 'value'; graphMode = 'none' }
    })
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Retry Count'; type = 'gauge'; gridPos = (New-GridPos 5 4 16 0)
        targets = @((New-SqlTarget -RefId 'A' -RawSql $retryQuery))
        fieldConfig = @{ defaults = @{ min = 0; color = @{ mode = 'thresholds' }; thresholds = @{ steps = @(@{ value = $null; color = 'orange' }, @{ value = 50; color = 'red' }) } } }
        options = @{ reduceOptions = @{ calcs = @('lastNotNull') }; showThresholdMarkers = $true; showThresholdLabels = $false }
    })
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Success Rate'; type = 'gauge'; gridPos = (New-GridPos 5 4 20 0)
        targets = @((New-KpiApiTarget -Selector 'successRate'))
        fieldConfig = @{ defaults = @{ min = 0; max = 100; unit = 'percent'; thresholds = @{ steps = @(@{ value = $null; color = 'red' }, @{ value = 80; color = 'yellow' }, @{ value = 95; color = 'green' }) } } }
        options = @{ reduceOptions = @{ calcs = @('lastNotNull') }; showThresholdMarkers = $true; showThresholdLabels = $false }
    })

    if ($HasPrometheus) {
        # Cluster Pod Health KPIs: at-a-glance cluster-wide pod counts, shown as stat
        # cards above the per-namespace breakdown table.
        $chStat = { param($id, $title, $legend, $expr, $steps)
            [ordered]@{ id = $id; title = $title; type = 'stat'; datasource = $PrometheusDatasourceName; gridPos = (New-GridPos 4 4 0 0)
                targets = @((New-PromTarget -RefId 'A' -Expr $expr -LegendFormat $legend -Instant $true))
                fieldConfig = @{ defaults = @{ thresholds = @{ mode = 'absolute'; steps = $steps }; color = @{ mode = 'thresholds' } } }
                options = @{ reduceOptions = @{ calcs = @('lastNotNull') }; colorMode = 'background'; textMode = 'value_and_name'; graphMode = 'none'; text = @{ titleSize = 12; valueSize = 22 } } }
        }
        $null = $panels.Add((& $chStat (Next-PanelId) 'Cluster Pods' 'Cluster Pods' '(count(kube_pod_status_phase{phase=~"Running|Pending|Failed"} == 1) or on() vector(0))' @(@{ value = $null; color = 'blue' })))
        $null = $panels.Add((& $chStat (Next-PanelId) 'Pods Running' 'Running' '(count(kube_pod_status_phase{phase="Running"} == 1) or on() vector(0))' @(@{ value = $null; color = 'green' })))
        $null = $panels.Add((& $chStat (Next-PanelId) 'Pods Failed' 'Failed' '(count(kube_pod_status_phase{phase="Failed"} == 1) or on() vector(0))' @(@{ value = $null; color = 'green' }, @{ value = 1; color = 'red' })))
        $null = $panels.Add((& $chStat (Next-PanelId) 'Pods CrashLooping' 'CrashLooping' '(count(kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"} == 1) or on() vector(0))' @(@{ value = $null; color = 'green' }, @{ value = 1; color = 'red' })))
        $null = $panels.Add((& $chStat (Next-PanelId) 'Pods Pending' 'Pending' '(count(kube_pod_status_phase{phase="Pending"} == 1) or on() vector(0))' @(@{ value = $null; color = 'green' }, @{ value = 1; color = 'orange' })))
        $null = $panels.Add([ordered]@{
            id = (Next-PanelId); title = 'Cluster Health Rate'; type = 'stat'; datasource = $PrometheusDatasourceName; gridPos = (New-GridPos 4 4 0 0)
            targets = @((New-PromTarget -RefId 'A' -Expr '100 * (count(kube_pod_status_phase{phase="Running"} == 1) or on() vector(0)) / clamp_min((count(kube_pod_status_phase{phase=~"Running|Pending|Failed"} == 1) or on() vector(0)),1)' -LegendFormat 'Health Rate' -Instant $true))
            fieldConfig = @{ defaults = @{ unit = 'percent'; min = 0; max = 100; thresholds = @{ mode = 'absolute'; steps = @(@{ value = $null; color = 'red' }, @{ value = 80; color = 'yellow' }, @{ value = 95; color = 'green' }) } } }
            options = @{ reduceOptions = @{ calcs = @('lastNotNull') }; colorMode = 'background'; textMode = 'value_and_name'; graphMode = 'none'; text = @{ titleSize = 12; valueSize = 22 } }
        })
        # Per-pod health table: each pod in the app namespace with Phase / Ready / Restarts.
        $null = $panels.Add([ordered]@{
            id = (Next-PanelId); title = 'Pod Health (per Pod)'; type = 'table'; datasource = $PrometheusDatasourceName; gridPos = (New-GridPos 14 24 0 0)
            targets = @(
                (New-PromTarget -RefId 'A' -Expr "kube_pod_status_phase{namespace=`"$Namespace`"} == 1" -Instant $true -Format 'table'),
                (New-PromTarget -RefId 'B' -Expr "sum by (pod) (kube_pod_container_status_restarts_total{namespace=`"$Namespace`"})" -Instant $true -Format 'table'),
                (New-PromTarget -RefId 'C' -Expr "kube_pod_status_ready{namespace=`"$Namespace`",condition=`"true`"} == 1" -Instant $true -Format 'table')
            )
            transformations = @(
                @{ id = 'joinByField'; options = @{ byField = 'pod'; mode = 'outer' } },
                @{ id = 'organize'; options = @{ excludeByName = @{ 'Time' = $true; 'Time 1' = $true; 'Time 2' = $true; 'Time 3' = $true; 'Value #A' = $true; 'condition' = $true }; indexByName = @{ 'namespace' = 0; 'pod' = 1; 'phase' = 2; 'Value #C' = 3; 'Value #B' = 4 }; renameByName = @{ 'namespace' = 'Namespace'; 'pod' = 'Pod'; 'phase' = 'Phase'; 'Value #B' = 'Restarts'; 'Value #C' = 'Ready' } } },
                @{ id = 'sortBy'; options = @{ sort = @(@{ field = 'Pod'; desc = $false }) } }
            )
            fieldConfig = @{ defaults = @{ custom = @{ align = 'left'; filterable = $true } }; overrides = @(
                @{ matcher = @{ id = 'byName'; options = 'Ready' }; properties = @(@{ id = 'mappings'; value = @(@{ type = 'value'; options = @{ '1' = @{ text = 'Ready'; color = 'green'; index = 0 } } }, @{ type = 'special'; options = @{ match = 'null'; result = @{ text = 'Not Ready'; color = 'red'; index = 1 } } }, @{ type = 'value'; options = @{ '0' = @{ text = 'Not Ready'; color = 'red'; index = 2 } } }) }, @{ id = 'custom.cellOptions'; value = @{ type = 'color-background'; mode = 'basic' } }, @{ id = 'custom.align'; value = 'center' }) },
                @{ matcher = @{ id = 'byName'; options = 'Phase' }; properties = @(@{ id = 'mappings'; value = @(@{ type = 'value'; options = @{ 'Running' = @{ color = 'green'; index = 0 }; 'Succeeded' = @{ color = 'blue'; index = 1 }; 'Pending' = @{ color = 'yellow'; index = 2 }; 'Failed' = @{ color = 'red'; index = 3 } } }) }, @{ id = 'custom.cellOptions'; value = @{ type = 'color-background'; mode = 'basic' } }, @{ id = 'custom.align'; value = 'center' }) },
                @{ matcher = @{ id = 'byName'; options = 'Restarts' }; properties = @(@{ id = 'custom.align'; value = 'center' }, @{ id = 'custom.cellOptions'; value = @{ type = 'color-background'; mode = 'gradient' } }, @{ id = 'thresholds'; value = @{ mode = 'absolute'; steps = @(@{ value = $null; color = 'green' }, @{ value = 1; color = 'red' }) } }, @{ id = 'noValue'; value = '0' }) }
            ) }
            options = @{ showHeader = $true; cellHeight = 'sm'; footer = @{ show = $false } }
        })
    }

    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Logic App Manager'; type = 'text'; gridPos = (New-GridPos 24 24 0 12)
        options = @{ mode = 'html'; content = "<iframe src='http://localhost:$AppManagerPort/?app=$grafanaAppVar&v=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())' style='width:100%;height:100%;border:none;display:block;'></iframe>" }
    })
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Workflow Manager'; type = 'text'; gridPos = (New-GridPos 22 24 0 24)
        options = @{ mode = 'html'; content = "<iframe src='http://localhost:$RunManagerPort/?app=$grafanaAppVar&v=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())' style='width:100%;height:100%;border:none;display:block;'></iframe>" }
    })
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Run Status Distribution'; type = 'piechart'; gridPos = (New-GridPos 8 8 0 36)
        targets = @(
            (New-SqlTarget -RefId 'A' -RawSql $statusDistributionQuery)
        )
        fieldConfig = @{ overrides = @(
            @{ matcher = @{ id = 'byName'; options = 'Succeeded' }; properties = @(@{ id = 'color'; value = @{ fixedColor = 'green'; mode = 'fixed' } }) },
            @{ matcher = @{ id = 'byName'; options = 'Failed' }; properties = @(@{ id = 'color'; value = @{ fixedColor = 'red'; mode = 'fixed' } }) },
            @{ matcher = @{ id = 'byName'; options = 'Running' }; properties = @(@{ id = 'color'; value = @{ fixedColor = 'yellow'; mode = 'fixed' } }) }
        ) }
        options = @{ legend = @{ displayMode = 'table'; placement = 'right'; values = @('value', 'percent') }; pieType = 'donut'; reduceOptions = @{ values = $true; calcs = @(); fields = '/.*value.*/' }; displayLabels = @('name', 'percent') }
    })
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'P50 / P95 / P99 Latency (sec)'; type = 'table'; gridPos = (New-GridPos 8 8 8 36)
        targets = @((New-SqlTarget -RefId 'A' -RawSql $latencyQuery))
        options = @{ showHeader = $true; cellHeight = 'sm' }
    })

    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Top Failed Workflows'; type = 'table'; gridPos = (New-GridPos 8 8 0 44)
        targets = @((New-SqlTarget -RefId 'A' -RawSql $topFailedQuery))
        options = @{ showHeader = $true; cellHeight = 'sm' }
    })
    # Volume Mounts sourced from run-manager /api/volumes (Infinity), full width, with live Health.
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Volume Mounts'; type = 'table'
        datasource = @{ type = 'yesoreyeram-infinity-datasource'; uid = 'logicapps-kpi-api' }
        gridPos = (New-GridPos 8 24 0 44)
        targets = @(
            @{
                refId = 'A'; type = 'json'; source = 'url'; format = 'table'; parser = 'backend'
                datasource = @{ type = 'yesoreyeram-infinity-datasource'; uid = 'logicapps-kpi-api' }
                url = 'http://host.docker.internal:3001/api/volumes?app=' + $grafanaAppVar
                url_options = @{ method = 'GET'; data = '' }
                root_selector = ''
                json_options = @{ columnar = $false; root_is_not_array = $false }
                columns = @(
                    @{ selector = 'Volume'; text = 'Workflow'; type = 'string' },
                    @{ selector = 'MountPath'; text = 'Mount Path'; type = 'string' },
                    @{ selector = 'Share'; text = 'SMB Share'; type = 'string' },
                    @{ selector = 'Access'; text = 'Access'; type = 'string' },
                    @{ selector = 'Health'; text = 'Health'; type = 'string' },
                    @{ selector = 'Detail'; text = 'Detail'; type = 'string' },
                    @{ selector = 'Files'; text = 'Files'; type = 'number' },
                    @{ selector = 'Modified'; text = 'Modified'; type = 'string' }
                )
                filters = @(); global_query_id = ''
            }
        )
        fieldConfig = @{ defaults = @{ custom = @{ align = 'left'; filterable = $true } }; overrides = @(
            @{ matcher = @{ id = 'byName'; options = 'Health' }; properties = @(@{ id = 'mappings'; value = @(@{ type = 'value'; options = @{ 'Healthy' = @{ text = 'Healthy'; color = 'green'; index = 0 }; 'Unhealthy' = @{ text = 'Unhealthy'; color = 'red'; index = 1 } } }) }, @{ id = 'custom.cellOptions'; value = @{ type = 'color-background'; mode = 'basic' } }, @{ id = 'custom.align'; value = 'center' }) },
            @{ matcher = @{ id = 'byName'; options = 'Files' }; properties = @(@{ id = 'custom.align'; value = 'right' }) }
        ) }
        options = @{ showHeader = $true; cellHeight = 'sm'; footer = @{ show = $false } }
    })

    # NOTE: $__timeGroup cannot be used inside a New-DynamicFlowRunsQuery body: the macro
    # expands to a quoted date literal that terminates the dynamic @sql N'...' string early
    # ("Must declare the scalar variable @sql"). Bucket manually with DATEADD/DATEDIFF anchored
    # at @from (a declared sp_executesql parameter) instead. Literals use single quotes because
    # New-DynamicFlowRunsQuery doubles every quote for the dynamic-SQL layer.
    $runsOverTimeQuery = New-DynamicFlowRunsQuery -QueryBody @'
SELECT DATEADD(MINUTE, (DATEDIFF(MINUTE, @from, CreatedTime) / 5) * 5, @from) AS time,
  SUM(CASE WHEN Status = 'Succeeded' THEN 1 ELSE 0 END) AS Succeeded,
  SUM(CASE WHEN Status = 'Failed' THEN 1 ELSE 0 END) AS Failed
FROM runs
WHERE 1 = 1 $workflowFilterClause
GROUP BY DATEADD(MINUTE, (DATEDIFF(MINUTE, @from, CreatedTime) / 5) * 5, @from)
ORDER BY time
'@
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Runs Over Time (All Workflows)'; type = 'timeseries'; gridPos = (New-GridPos 8 12 0 52)
        targets = @((New-SqlTarget -RefId 'A' -Format 'time_series' -RawSql $runsOverTimeQuery))
        fieldConfig = @{ defaults = @{ custom = @{ lineWidth = 2; fillOpacity = 20; spanNulls = $true } }; overrides = @(
            @{ matcher = @{ id = 'byName'; options = 'Succeeded' }; properties = @(@{ id = 'color'; value = @{ fixedColor = 'green'; mode = 'fixed' } }) },
            @{ matcher = @{ id = 'byName'; options = 'Failed' }; properties = @(@{ id = 'color'; value = @{ fixedColor = 'red'; mode = 'fixed' } }) }
        ) }
    })
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Execution Duration Over Time'; type = 'timeseries'; gridPos = (New-GridPos 8 12 12 52)
        targets = $allExecutionTargets
        fieldConfig = @{ defaults = @{ unit = 'ms'; custom = @{ lineWidth = 1; fillOpacity = 5; drawStyle = 'points'; pointSize = 4 } } }
    })

    # Total Runs / Total Action Executions trend across ALL flow tables (dynamic union),
    # placed first so they bucket at the TOP of the Resource Metrics tab.
    $totalTrendTemplate = @'
SET NOCOUNT ON;
DECLARE @from DATETIME = $__timeFrom();
DECLARE @to   DATETIME = $__timeTo();
DECLARE @bmin INT = CASE WHEN DATEDIFF(MINUTE,@from,@to)<=0 THEN 1 ELSE (DATEDIFF(MINUTE,@from,@to)/120)+1 END;
DECLARE @union NVARCHAR(MAX)=N'';
SELECT @union = @union + CASE WHEN @union=N'' THEN N'' ELSE N' UNION ALL ' END +
   N'SELECT CreatedTime FROM [dt].'+QUOTENAME(t.name)
FROM sys.tables t JOIN sys.schemas s ON t.schema_id=s.schema_id
WHERE s.name='dt' AND t.name LIKE '__LIKE__';
IF @union=N'' SET @union=N'SELECT CAST(NULL AS DATETIME) AS CreatedTime WHERE 1=0';
DECLARE @sql NVARCHAR(MAX)=
  N'SELECT DATEADD(MINUTE,(DATEDIFF(MINUTE,@from,CreatedTime)/@bmin)*@bmin,@from) AS time, COUNT(*) AS [__VALUECOL__]
    FROM ('+@union+N') x WHERE CreatedTime>=@from AND CreatedTime<@to
    GROUP BY DATEADD(MINUTE,(DATEDIFF(MINUTE,@from,CreatedTime)/@bmin)*@bmin,@from) ORDER BY 1';
EXEC sp_executesql @sql, N'@from DATETIME,@to DATETIME,@bmin INT',@from,@to,@bmin;
'@
    $totalRunsQuery = $totalTrendTemplate.Replace('__LIKE__', 'flow%runs').Replace('__VALUECOL__', 'Runs')
    $totalActionsQuery = $totalTrendTemplate.Replace('__LIKE__', 'flow%actions').Replace('__VALUECOL__', 'Actions')
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Total Runs Over Time'; type = 'timeseries'; gridPos = (New-GridPos 8 24 0 60)
        targets = @((New-SqlTarget -RefId 'A' -Format 'time_series' -RawSql $totalRunsQuery))
        fieldConfig = @{ defaults = @{ unit = 'none'; decimals = 0; color = @{ mode = 'fixed'; fixedColor = 'blue' }; custom = @{ drawStyle = 'line'; lineInterpolation = 'smooth'; lineWidth = 2; fillOpacity = 10; spanNulls = $true; showPoints = 'never' } } }
        options = @{ legend = @{ showLegend = $true; displayMode = 'list'; placement = 'bottom'; calcs = @('sum', 'max') }; tooltip = @{ mode = 'multi'; sort = 'desc' } }
    })
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Total Action Executions Over Time'; type = 'timeseries'; gridPos = (New-GridPos 8 24 0 68)
        targets = @((New-SqlTarget -RefId 'A' -Format 'time_series' -RawSql $totalActionsQuery))
        fieldConfig = @{ defaults = @{ unit = 'none'; decimals = 0; color = @{ mode = 'fixed'; fixedColor = 'purple' }; custom = @{ drawStyle = 'line'; lineInterpolation = 'smooth'; lineWidth = 2; fillOpacity = 10; spanNulls = $true; showPoints = 'never' } } }
        options = @{ legend = @{ showLegend = $true; displayMode = 'list'; placement = 'bottom'; calcs = @('sum', 'max') }; tooltip = @{ mode = 'multi'; sort = 'desc' } }
    })

    $y = 64
    if ($HasPrometheus) {
        $null = $panels.Add([ordered]@{ id = (Next-PanelId); title = 'Pod Instances'; type = 'timeseries'; datasource = $PrometheusDatasourceName; gridPos = (New-GridPos 7 8 0 $y); targets = @((New-PromTarget -RefId 'A' -Expr "count(kube_pod_info{namespace=`"$Namespace`",pod=~`"$podRegex`"})" -LegendFormat 'Running Instances')); fieldConfig = @{ defaults = @{ custom = @{ lineWidth = 2; fillOpacity = 20 }; color = @{ fixedColor = 'blue'; mode = 'fixed' }; decimals = 0 } } })
        $null = $panels.Add([ordered]@{ id = (Next-PanelId); title = 'CPU Usage (cores)'; type = 'timeseries'; datasource = $PrometheusDatasourceName; gridPos = (New-GridPos 7 8 8 $y); targets = @((New-PromTarget -RefId 'A' -Expr "sum(rate(container_cpu_usage_seconds_total{namespace=`"$Namespace`",pod=~`"$podRegex`",container=`"logicapps-container`"}[5m]))" -LegendFormat 'CPU Used'), (New-PromTarget -RefId 'B' -Expr "sum(kube_pod_container_resource_limits{namespace=`"$Namespace`",pod=~`"$podRegex`",container=`"logicapps-container`",resource=`"cpu`"})" -LegendFormat 'CPU Limit')); fieldConfig = @{ defaults = @{ unit = 'short'; custom = @{ lineWidth = 2; fillOpacity = 15 } } } })
        $null = $panels.Add([ordered]@{ id = (Next-PanelId); title = 'Memory Usage (MB)'; type = 'timeseries'; datasource = $PrometheusDatasourceName; gridPos = (New-GridPos 7 8 16 $y); targets = @((New-PromTarget -RefId 'A' -Expr "sum(container_memory_working_set_bytes{namespace=`"$Namespace`",pod=~`"$podRegex`",container=`"logicapps-container`"}) / 1024 / 1024" -LegendFormat 'Memory Used'), (New-PromTarget -RefId 'B' -Expr "sum(kube_pod_container_resource_limits{namespace=`"$Namespace`",pod=~`"$podRegex`",container=`"logicapps-container`",resource=`"memory`"}) / 1024 / 1024" -LegendFormat 'Memory Limit')); fieldConfig = @{ defaults = @{ unit = 'decmbytes'; custom = @{ lineWidth = 2; fillOpacity = 15 } } } })
        $y += 7
        $null = $panels.Add([ordered]@{ id = (Next-PanelId); title = 'CPU by Container'; type = 'timeseries'; datasource = $PrometheusDatasourceName; gridPos = (New-GridPos 7 12 0 $y); targets = @((New-PromTarget -RefId 'A' -Expr "sum(rate(container_cpu_usage_seconds_total{namespace=`"$Namespace`",pod=~`"$podRegex`",container!=`"`"}[5m])) by (container)" -LegendFormat '{{container}}')); fieldConfig = @{ defaults = @{ unit = 'short'; custom = @{ lineWidth = 1; fillOpacity = 10; stacking = @{ mode = 'normal' } } } } })
        $null = $panels.Add([ordered]@{ id = (Next-PanelId); title = 'Memory by Container (MB)'; type = 'timeseries'; datasource = $PrometheusDatasourceName; gridPos = (New-GridPos 7 12 12 $y); targets = @((New-PromTarget -RefId 'A' -Expr "sum(container_memory_working_set_bytes{namespace=`"$Namespace`",pod=~`"$podRegex`",container!=`"`"}) by (container) / 1024 / 1024" -LegendFormat '{{container}}')); fieldConfig = @{ defaults = @{ unit = 'decmbytes'; custom = @{ lineWidth = 1; fillOpacity = 10; stacking = @{ mode = 'normal' } } } } })
        $y += 7
        $null = $panels.Add([ordered]@{ id = (Next-PanelId); title = 'Network I/O'; type = 'timeseries'; datasource = $PrometheusDatasourceName; gridPos = (New-GridPos 7 12 0 $y); targets = @((New-PromTarget -RefId 'A' -Expr "sum(rate(container_network_receive_bytes_total{namespace=`"$Namespace`",pod=~`"$podRegex`"}[5m]))" -LegendFormat 'Received'), (New-PromTarget -RefId 'B' -Expr "sum(rate(container_network_transmit_bytes_total{namespace=`"$Namespace`",pod=~`"$podRegex`"}[5m]))" -LegendFormat 'Transmitted')); fieldConfig = @{ defaults = @{ unit = 'Bps'; custom = @{ lineWidth = 2; fillOpacity = 10 } } } })
        $null = $panels.Add([ordered]@{ id = (Next-PanelId); title = 'Pod Restarts'; type = 'timeseries'; datasource = $PrometheusDatasourceName; gridPos = (New-GridPos 7 12 12 $y); targets = @((New-PromTarget -RefId 'A' -Expr "sum(kube_pod_container_status_restarts_total{namespace=`"$Namespace`",pod=~`"$podRegex`"}) by (container)" -LegendFormat '{{container}}')); fieldConfig = @{ defaults = @{ custom = @{ lineWidth = 2; fillOpacity = 5 } } } })
        $y += 7
        $y += 8
        $y += 8
    }
    else {
        $null = $panels.Add([ordered]@{
            id = (Next-PanelId); title = 'Infrastructure Metrics'; type = 'text'; gridPos = (New-GridPos 6 24 0 $y)
            options = @{ mode = 'html'; content = '<div style="padding:8px;">Prometheus was not configured, so infrastructure panels were omitted.</div>' }
        })
        $y += 6
    }

    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Workflow Execution Errors (SQL)'; type = 'table'; gridPos = (New-GridPos 8 24 0 $y)
        targets = @((New-SqlTarget -RefId 'A' -RawSql $workflowErrorsQuery))
        options = @{ showHeader = $true; cellHeight = 'sm' }
    })
    $y += 8

    # Per-workflow drilldowns moved into the embedded Run Manager so the dashboard
    # stays single-page and app-selectable.

    [ordered]@{
        uid = if ($DashboardUid) { $DashboardUid } else { 'logicapps-monitor' }
        title = if ($DashboardTitle) { $DashboardTitle } else { 'Logic Apps - Workflow Hub' }
        tags = @('logicapps', 'workflows', 'monitoring')
        timezone = 'browser'
        refresh = '30s'
        editable = $true
        time = @{ from = 'now-24h'; to = 'now' }
        schemaVersion = 39
        # Bump dashboard version each run so Grafana always reloads the latest generated JSON.
        version = [int][DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        templating = @{
            list = @(
                if ($IncludeLiveAppPanels) {
                    [ordered]@{
                        name = 'app'
                        label = 'App'
                        type = 'custom'
                        query = (($DashboardAppNames | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join ',')
                        current = @{ text = $DashboardAppName; value = $DashboardAppName; selected = $true }
                        options = @(
                            $DashboardAppNames | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object {
                                @{ text = $_; value = $_; selected = ($_ -eq $DashboardAppName) }
                            }
                        )
                        refresh = 0
                        allowCustomValue = $false
                        skipUrlSync = $true
                        multi = $false
                        includeAll = $false
                        hide = 0
                    }
                    [ordered]@{
                        name = 'workflow'
                        label = 'Workflow'
                        type = 'query'
                        datasource = @{ type = 'yesoreyeram-infinity-datasource'; uid = 'logicapps-kpi-api' }
                        query = @{
                            parser = 'backend'
                            type = 'json'
                            source = 'url'
                            url = 'http://host.docker.internal:3001/api/workflows?app=' + $grafanaAppVar
                            root_selector = 'value'
                            columns = @(@{ selector = 'name'; text = 'name'; type = 'string' })
                        }
                        definition = 'http://host.docker.internal:3001/api/workflows?app=' + $grafanaAppVar
                        current = @{ text = 'All'; value = '$__all'; selected = $true }
                        options = @()
                        refresh = 2
                        allowCustomValue = $false
                        skipUrlSync = $true
                        multi = $false
                        includeAll = $true
                        allValue = '*'
                        hide = 2
                    }
                }
            ) | Where-Object { $null -ne $_ }
        }
        panels = (ConvertTo-AccordionPanels -Panels $panels)
    }
}

function Get-ComposeCommandLine([string[]]$ComposeArgs) {
    & docker compose version *> $null
    if ($LASTEXITCODE -eq 0) {
        return [pscustomobject]@{ Command = 'docker'; Args = @('compose') + $ComposeArgs }
    }
    if (Test-CommandAvailable -Name 'docker-compose') {
        return [pscustomobject]@{ Command = 'docker-compose'; Args = $ComposeArgs }
    }
    throw 'Neither docker compose nor docker-compose is available.'
}

function Invoke-Compose {
    param([string[]]$ComposeArgs)

    $cmd = Get-ComposeCommandLine -ComposeArgs $ComposeArgs
    & $cmd.Command @($cmd.Args)
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose command failed: $($cmd.Command) $($cmd.Args -join ' ')"
    }
}

function Get-DatasourceYaml {
    $sqlHost = if ($SqlServer -match ':[0-9]+$') { $SqlServer } else { "${SqlServer}:1433" }
    if ($sqlHost -match '^(localhost|127\.0\.0\.1):') {
        $sqlHost = $sqlHost -replace '^(localhost|127\.0\.0\.1):', 'host.docker.internal:'
    }
    # Credentials are NOT written into this file. Grafana interpolates ${SQL_PASSWORD}
    # from the container environment, which is populated by docker-compose env_file
    # (see Get-ComposeYaml) from the out-of-repo credentials file.
    $lines = New-Object System.Collections.Generic.List[string]
    $null = $lines.Add('apiVersion: 1')
    $null = $lines.Add('datasources:')
    $null = $lines.Add("  - name: $GrafanaDatasourceName")
    $null = $lines.Add('    type: mssql')
    $null = $lines.Add('    access: proxy')
    $null = $lines.Add("    url: $sqlHost")
    $null = $lines.Add("    database: $SqlDatabase")
    $null = $lines.Add("    user: $SqlUser")
    $null = $lines.Add('    isDefault: true')
    $null = $lines.Add('    editable: true')
    $null = $lines.Add('    jsonData:')
    $null = $lines.Add('      maxOpenConns: 5')
    $null = $lines.Add('      maxIdleConns: 2')
    $null = $lines.Add('      connMaxLifetime: 14400')
    $null = $lines.Add('      encrypt: disable')
    $null = $lines.Add('      trustServerCertificate: true')
    $null = $lines.Add('    secureJsonData:')
    $null = $lines.Add('      password: ${SQL_PASSWORD}')
    $null = $lines.Add('  - name: LogicApps-KPI-API')
    $null = $lines.Add('    uid: logicapps-kpi-api')
    $null = $lines.Add('    type: yesoreyeram-infinity-datasource')
    $null = $lines.Add('    access: proxy')
    $null = $lines.Add('    editable: true')
    $null = $lines.Add('    jsonData:')
    $null = $lines.Add('      auth_method: none')
    $null = $lines.Add('      allowedHosts:')
    $null = $lines.Add('        - http://host.docker.internal:3001')
    $null = $lines.Add('        - http://localhost:3001')

    if ($PrometheusUrl) {
        $promDsUrl = $PrometheusUrl
        if (Test-PrometheusNeedsTunnel) {
            $promUri = [uri]$PrometheusUrl
            $promDsPort = if ($promUri.IsDefaultPort) { $ThanosLocalPort } else { $promUri.Port }
            $promDsUrl = '{0}://{1}:{2}' -f $promUri.Scheme, $promUri.Host, $promDsPort
        }
        $null = $lines.Add("  - name: $PrometheusDatasourceName")
        $null = $lines.Add('    type: prometheus')
        $null = $lines.Add('    access: proxy')
        $null = $lines.Add('    editable: true')
        $null = $lines.Add("    url: $promDsUrl")
        $null = $lines.Add('    jsonData:')
        $null = $lines.Add('      tlsSkipVerify: true')
        $null = $lines.Add('      httpMethod: POST')
        $null = $lines.Add('      timeInterval: 30s')
        if ($PrometheusToken) {
            $escapedPromToken = $PrometheusToken.Replace("'", "''")
            $null = $lines.Add('      httpHeaderName1: Authorization')
            $null = $lines.Add('    secureJsonData:')
            $null = $lines.Add("      httpHeaderValue1: 'Bearer $escapedPromToken'")
        }
    }

    $lines -join "`r`n"
}

function Get-DashboardProvisioningYaml {
@"
apiVersion: 1
providers:
  - name: 'Logic Apps'
    orgId: 1
    folder: 'Logic Apps'
    type: file
    disableDeletion: false
    editable: true
    # Prevent UI-edited stale state from overriding generated dashboard content.
    allowUiUpdates: false
    updateIntervalSeconds: 10
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: false
"@
}

function Get-ComposeYaml {
    $extraHosts = New-Object System.Collections.Generic.List[string]
    # Let the Grafana container reach the Workflow Manager (KPI API) on the host
    # via host.docker.internal (used by the Infinity datasource).
    $null = $extraHosts.Add('host.docker.internal')
    if ($PrometheusUrl) {
        $promHost = ([uri]$PrometheusUrl).Host
        if ($promHost -and $promHost -notmatch '^(localhost|127\.0\.0\.1|host\.docker\.internal)$' -and $promHost -notmatch '^\d+\.\d+\.\d+\.\d+$') {
            $null = $extraHosts.Add($promHost)
            if ($promHost -like '*.apps-crc.testing') {
                foreach ($extraHostName in @('thanos-querier-openshift-monitoring.apps-crc.testing', 'prometheus-k8s-openshift-monitoring.apps-crc.testing')) {
                    if ($extraHostName -notin $extraHosts) {
                        $null = $extraHosts.Add($extraHostName)
                    }
                }
            }
        }
    }

    $hostLines = if ($extraHosts.Count -gt 0) {
        @('    extra_hosts:') + ($extraHosts | ForEach-Object { "      - ""${_}:host-gateway""" })
    }
    else {
        @()
    }

    (@(
        'services:',
        '  grafana:',
        '    image: grafana/grafana:latest',
        "    container_name: $ManagedGrafanaContainer",
        '    ports:',
        "      - ""${GrafanaPort}:3000""",
        '    environment:',
        "      GF_SECURITY_ADMIN_USER: $GrafanaAdminUser",
        '      GF_USERS_ALLOW_SIGN_UP: "false"',
        '      GF_PANELS_DISABLE_SANITIZE_HTML: "true"',
        '      GF_SECURITY_ALLOW_EMBEDDING: "true"',
        '      GF_AUTH_ANONYMOUS_ENABLED: "true"',
        '      GF_AUTH_ANONYMOUS_ORG_NAME: "Main Org."',
        '      GF_AUTH_ANONYMOUS_ORG_ROLE: "Viewer"',
        '      GF_FEATURE_TOGGLES_dashboardNewLayouts: "true"',
        '      GF_INSTALL_PLUGINS: "yesoreyeram-infinity-datasource"',
        '    # Secrets (SQL_PASSWORD, GF_SECURITY_ADMIN_PASSWORD) are injected into the',
        '    # container from the out-of-repo credentials file, never baked into this file.',
        '    env_file:',
        "      - $ComposeCredentialsRelPath"
    ) + $hostLines + @(
        '    volumes:',
        '      - ./provisioning/datasources:/etc/grafana/provisioning/datasources',
        '      - ./provisioning/dashboards:/etc/grafana/provisioning/dashboards',
        '      - ./dashboards:/var/lib/grafana/dashboards',
        '      - grafana-portal-data:/var/lib/grafana',
        '    restart: unless-stopped',
        '',
        'volumes:',
        '  grafana-portal-data:'
    )) -join "`r`n"
}

function Get-RunManagerScript {
    $ocCmd = Get-Command oc -ErrorAction SilentlyContinue
    $ocPathForRunManager = if ($ocCmd -and $ocCmd.Source) { $ocCmd.Source } else { 'oc' }
    $portalProjectRoot = ''
    try { $storageShare = Get-SmbShare -Name 'storage' -ErrorAction SilentlyContinue; if ($storageShare -and $storageShare.Path) { $portalProjectRoot = $storageShare.Path } } catch { }
    if ([string]::IsNullOrWhiteSpace($portalProjectRoot)) { $portalProjectRoot = "\\$SqlServer\storage" }
    $portalSmbHost = Get-FirstEnvironmentValue @('HOST_ACCESS_IP', 'LOGICAPPS_HOST_ACCESS_IP')
    $portalSmbUser = Get-FirstEnvironmentValue @('LOGICAPPS_SMB_USER', 'SMB_USER', 'LOGICAPPS_STORAGE_USER')
    $portalSmbPassword = Get-FirstEnvironmentValue @('LOGICAPPS_SMB_PASSWORD', 'SMB_PASSWORD', 'LOGICAPPS_STORAGE_PASSWORD')
    if ([string]::IsNullOrWhiteSpace($portalSmbHost)) {
        $portalSmbHost = Get-DefaultSwitchIPv4
        if (-not [string]::IsNullOrWhiteSpace($portalSmbHost)) {
            Write-Info "Using Hyper-V Default Switch IP '$portalSmbHost' for SMB host discovery."
        }
    }
    $configJson = [ordered]@{
        port         = $RunManagerPort
        logicAppBase = $script:EffectiveLogicAppBaseUrl
        masterKey    = $MasterKey
        apiVersion   = '2020-05-01-preview'
        namespace    = $Namespace
        appName      = $AppName
        kubeconfigPath = $KubeConfigPath
        kubeContext  = $KubeContext
        ocPath       = $ocPathForRunManager
        projectRoot  = $portalProjectRoot
        smbHost      = $portalSmbHost
        smbUser      = $portalSmbUser
        smbPassword  = $portalSmbPassword
    } | ConvertTo-Json -Compress

    $existingRunManager = Join-Path $PortalRoot 'run-manager.js'
    if (Test-Path -LiteralPath $existingRunManager) {
        $existingScript = Get-Content -LiteralPath $existingRunManager -Raw
        if ($existingScript -match 'const CONFIG = .+?;' -and $existingScript -match '/api/inventory') {
            return [regex]::Replace($existingScript, 'const CONFIG = .+?;', "const CONFIG = $configJson;", 1)
        }
    }

    $template = @'
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const path = require('path');
const fs = require('fs');

const CONFIG = __CONFIG_JSON__;
const PORT = CONFIG.port;
const SMB_AUTH_CACHE = new Set();

// Never let a transient upstream error (e.g. the 8088 tunnel dropping during a
// pod rollover) take the whole manager down — log and keep serving.
process.on('uncaughtException', (e) => { try { console.error('[uncaughtException]', (e && e.stack) || e); } catch {} });
process.on('unhandledRejection', (e) => { try { console.error('[unhandledRejection]', (e && e.stack) || e); } catch {} });

// --- Volume-mount health ---------------------------------------------------
// The Logic App pod mounts the SMB storage share at /home/site/wwwroot; every
// workflow is a subfolder there. We surface one row per subfolder (unique by
// mount path) and test health by actually listing the backing folder on the
// host (the SMB share is served locally, so this is fast and reliable).
const os = require('os');
function hostPrimaryIPv4() {
  try {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const a of ifaces[name] || []) {
        if (a.family === 'IPv4' && !a.internal) return a.address;
      }
    }
  } catch (e) { /* ignore */ }
  return '127.0.0.1';
}
let _volCache = { at: 0, data: null };
const VOL_TTL_MS = 30000;
function computeVolumes() {
  const root = CONFIG.projectRoot || 'C:\\storage';
  const shareHost = CONFIG.smbHost || hostPrimaryIPv4();
  const shareName = CONFIG.smbShare || 'storage';
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (e) {
    return [{ Volume: '(storage root)', MountPath: '/home/site/wwwroot',
      Share: `\\\\${shareHost}\\${shareName}`, Access: 'ReadWrite',
      Health: 'Unhealthy', Detail: `cannot read storage root: ${e.code || e.message}`,
      Files: 0, Modified: '' }];
  }
  const seen = new Set();
  const rows = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const name = ent.name;
    const mountPath = `/home/site/wwwroot/${name}`;
    if (seen.has(mountPath)) continue; // unique per mount path
    seen.add(mountPath);
    const full = path.join(root, name);
    let health = 'Healthy', detail = 'listed', files = 0, modified = '';
    try {
      files = fs.readdirSync(full).length;
      modified = fs.statSync(full).mtime.toISOString();
    } catch (e) {
      health = 'Unhealthy';
      detail = e.code || e.message;
    }
    rows.push({ Volume: name, MountPath: mountPath,
      Share: `\\\\${shareHost}\\${shareName}\\${name}`, Access: 'ReadWrite',
      Health: health, Detail: detail, Files: files, Modified: modified });
  }
  rows.sort((a, b) => a.Volume.localeCompare(b.Volume));
  return rows;
}
function getVolumes() {
  const now = Date.now();
  if (_volCache.data && (now - _volCache.at) < VOL_TTL_MS) return _volCache.data;
  const data = computeVolumes();
  _volCache = { at: now, data };
  return data;
}

function tryParseJson(value) {
  try {
    const text = String(value == null ? '' : value).replace(/^\uFEFF/, '');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function tryGetUncShareRoot(inputPath) {
  const p = String(inputPath || '').trim();
  const m = p.match(/^\\\\([^\\]+)\\([^\\]+)/);
  if (!m) return null;
  return `\\\\${m[1]}\\${m[2]}`;
}

async function ensureSmbSessionForPath(inputPath) {
  const user = String(CONFIG.smbUser || '').trim();
  const pass = String(CONFIG.smbPassword || '').trim();
  if (!user || !pass) return;
  const shareRoot = tryGetUncShareRoot(inputPath);
  if (!shareRoot || SMB_AUTH_CACHE.has(shareRoot)) return;
  try {
    await execFileAsync('net', ['use', shareRoot, pass, `/user:${user}`, '/persistent:no'], { windowsHide: true });
    SMB_AUTH_CACHE.add(shareRoot);
  } catch (err) {
    const msg = `${(err && err.stdout) || ''} ${(err && err.stderr) || ''}`.toLowerCase();
    if (msg.includes('successfully') || msg.includes('1219') || msg.includes('multiple connections')) {
      SMB_AUTH_CACHE.add(shareRoot);
      return;
    }
    throw new Error(`SMB authentication failed for ${shareRoot}: ${(err && err.message) || err}`);
  }
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data ? (tryParseJson(data) || {}) : {}));
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function openWorkflowInVSCode(workflow) {
  const root = CONFIG.projectRoot;
  if (!root) {
    return { ok: false, error: 'Local Logic Apps project root is not configured (CONFIG.projectRoot). Cannot open VS Code.' };
  }
  ensureSmbSessionForPath(root).catch(() => {});
  if (!workflow || /[\\/]/.test(workflow) || workflow.indexOf('..') !== -1) {
    return { ok: false, error: `Invalid workflow name '${workflow}'.` };
  }
  const workflowDir = path.join(root, workflow);
  const workflowFile = path.join(workflowDir, 'workflow.json');
  if (!fs.existsSync(workflowFile)) {
    return { ok: false, error: `workflow.json not found at ${workflowFile}. Is the SMB storage share mounted on this host?` };
  }
  try {
    // Open the project root (so the Azure Logic Apps extension activates the designer)
    // and focus the selected workflow's workflow.json.
    const child = spawn('code', ['-r', root, '-g', workflowFile], {
      cwd: root,
      shell: true,
      detached: true,
      stdio: 'ignore'
    });
    child.on('error', () => {});
    child.unref();
    return { ok: true, message: `Opening ${workflow} in local VS Code (${workflowFile}).`, path: workflowFile };
  } catch (e) {
    return { ok: false, error: `Failed to launch VS Code: ${e.message}. Ensure the 'code' CLI is on PATH.` };
  }
}

function makeRequest(method, urlOrPath, body) {
  return new Promise((resolve, reject) => {
    const target = /^https?:\/\//i.test(urlOrPath) ? new URL(urlOrPath) : new URL(urlOrPath, CONFIG.logicAppBase);
    const transport = target.protocol === 'https:' ? https : http;
    const bodyStr = body === undefined || body === null ? '' : JSON.stringify(body);
    const req = transport.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: target.pathname + target.search,
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      },
      timeout: 15000,
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data, json: tryParseJson(data) }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function makeRequestWithRetry(method, urlOrPath, body, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const result = await makeRequest(method, urlOrPath, body);
      if (result.status >= 500) {
        lastErr = new Error(`Upstream returned ${result.status}`);
      } else {
        return result;
      }
    } catch (err) {
      lastErr = err;
    }
    await new Promise(resolve => setTimeout(resolve, 600 * (i + 1)));
  }
  throw lastErr || new Error('Request failed after retries');
}

function managementPath(path) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}api-version=${encodeURIComponent(CONFIG.apiVersion)}&code=${encodeURIComponent(CONFIG.masterKey)}`;
}

async function getWorkflowDetail(name) {
  const result = await makeRequest('GET', managementPath(`/runtime/webhooks/workflow/api/management/workflows/${encodeURIComponent(name)}`));
  if (result.status >= 400) throw new Error(result.body || `Workflow detail lookup failed (${result.status})`);
  return result.json || {};
}

async function getWorkflowTriggerName(name) {
  const detail = await getWorkflowDetail(name);
  const triggers = detail.triggers || (detail.properties && detail.properties.triggers) || {};
  const names = Object.keys(triggers);
  if (!names.length) throw new Error(`No trigger definitions found for workflow '${name}'`);
  return names[0];
}

async function runOc(args) {
  const env = { ...process.env };
  if (CONFIG.kubeconfigPath) env.KUBECONFIG = CONFIG.kubeconfigPath;
  const ocArgs = CONFIG.kubeContext ? ['--context', CONFIG.kubeContext, ...args] : args;
  const result = await execFileAsync(CONFIG.ocPath || 'oc', ocArgs, { env, maxBuffer: 20 * 1024 * 1024 });
  return (result.stdout || '').trim();
}

// Find the container that carries the Logic Apps app settings (Workflows.* env vars).
function findAppContainerIndex(containers) {
  const list = Array.isArray(containers) ? containers : [];
  const idx = list.findIndex(c => Array.isArray(c && c.env) && c.env.some(e => e && (e.name === 'APP_KIND' || String(e.name || '').startsWith('Workflows.'))));
  return idx >= 0 ? idx : 0;
}

// Enable/disable a Standard workflow via the control plane: patch the
// `Workflows.<name>.FlowState` app setting on the ContainerApp resource (oc).
// This is the ARM-equivalent operation; it triggers a new revision rollover.
async function setFlowState(name, state) {
  if (!CONFIG.namespace || !CONFIG.appName) throw new Error('ContainerApp namespace/appName not configured');
  const out = await runOc(['-n', CONFIG.namespace, 'get', 'containerapp', CONFIG.appName, '-o', 'json']);
  const appJson = tryParseJson(out) || {};
  const containers = (appJson.spec && appJson.spec.template && appJson.spec.template.containers) || [];
  const cIdx = findAppContainerIndex(containers);
  const envList = (containers[cIdx] && containers[cIdx].env) || [];
  const key = `Workflows.${name}.FlowState`;
  const eIdx = envList.findIndex(e => e && e.name === key);
  const patch = eIdx >= 0
    ? [{ op: 'replace', path: `/spec/template/containers/${cIdx}/env/${eIdx}/value`, value: state }]
    : [{ op: 'add', path: `/spec/template/containers/${cIdx}/env/-`, value: { name: key, value: state } }];
  await runOc(['-n', CONFIG.namespace, 'patch', 'containerapp', CONFIG.appName, '--type=json', '-p', JSON.stringify(patch)]);
  return { workflow: name, state, revisionRollover: true };
}

function normalizeWorkflowEntryFromDefinition(name, payload) {
  const doc = payload && typeof payload === 'object' ? payload : {};
  const definition = (doc.definition && typeof doc.definition === 'object') ? doc.definition : {};
  const kind = String(doc.kind || definition.kind || '').trim();
  const triggers = (definition.triggers && typeof definition.triggers === 'object')
    ? definition.triggers
    : ((doc.triggers && typeof doc.triggers === 'object') ? doc.triggers : {});
  return { name, kind, triggers, isDisabled: false, health: { state: 'Unknown' } };
}

async function listWorkflowsFromVfs() {
  const dirResult = await makeRequestWithRetry('GET', managementPath('/admin/vfs/home/site/wwwroot/'), undefined, 2);
  const entries = Array.isArray(dirResult.json) ? dirResult.json : [];
  const names = [];
  for (const entry of entries) {
    const raw = String((entry && entry.name) || '').trim().replace(/[\\/]+$/, '');
    if (!raw || raw.startsWith('.')) continue;
    names.push(raw);
  }
  if (!names.length) return [];

  const defs = await Promise.all(names.map(async (name) => {
    try {
      const result = await makeRequestWithRetry(
        'GET',
        managementPath(`/admin/vfs/home/site/wwwroot/${encodeURIComponent(name)}/workflow.json`),
        undefined,
        2
      );
      if (result.status >= 400 || !result.json) return null;
      return normalizeWorkflowEntryFromDefinition(name, result.json);
    } catch {
      return null;
    }
  }));
  return defs.filter(Boolean);
}

function findWorkflowNamesOnDisk(root) {
  let entries = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e && e.isDirectory && e.isDirectory())
    .map((e) => e.name)
    .filter((name) => {
      try {
        return fs.existsSync(path.join(root, name, 'workflow.json'));
      } catch {
        return false;
      }
    });
}

async function listWorkflowsFromMountedStorage() {
  const root = CONFIG.projectRoot;
  if (!root) return [];
  await ensureSmbSessionForPath(root);
  const names = findWorkflowNamesOnDisk(root);
  if (!names.length) return [];

  const scoped = [];
  for (const name of names) {
    try {
      const detail = await makeRequestWithRetry(
        'GET',
        managementPath(`/runtime/webhooks/workflow/api/management/workflows/${encodeURIComponent(name)}`),
        undefined,
        1
      );
      if (detail.status >= 400 || !detail.json) continue;
      scoped.push({ ...(detail.json || {}), name });
    } catch {
      // ignore per-workflow probe failures
    }
  }
  if (scoped.length) return scoped;

  const out = [];
  for (const name of names) {
    try {
      const wfPath = path.join(root, name, 'workflow.json');
      let sourcePath = wfPath;
      if (!fs.existsSync(sourcePath)) {
        sourcePath = null;
        const stack = [root];
        while (stack.length && !sourcePath) {
          const dir = stack.pop();
          let entries = [];
          try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { entries = []; }
          for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) stack.push(full);
            if (entry.isFile() && entry.name.toLowerCase() === 'workflow.json' && path.basename(path.dirname(full)) === name) {
              sourcePath = full;
              break;
            }
          }
        }
        if (!sourcePath) continue;
      }
      const json = tryParseJson(fs.readFileSync(sourcePath, 'utf8')) || {};
      out.push(normalizeWorkflowEntryFromDefinition(name, json));
    } catch {
      // best effort per folder
    }
  }
  return out;
}

async function listWorkflowsRaw() {
  try {
    const result = await makeRequestWithRetry('GET', managementPath('/runtime/webhooks/workflow/api/management/workflows'), undefined, 3);
    const rows = (result.json && result.json.value) || (Array.isArray(result.json) ? result.json : []);
    if (rows.length) return rows;
  } catch {}
  try {
    const rows = await listWorkflowsFromMountedStorage();
    if (rows.length) return rows;
  } catch {}
  try {
    const rows = await listWorkflowsFromVfs();
    if (rows.length) return rows;
  } catch {}
  return [];
}

// Roll up run stats for the last 24h from the management runs API.
async function getRuns24h(name) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const apiPath = managementPath(`/runtime/webhooks/workflow/api/management/workflows/${encodeURIComponent(name)}/runs`) + '&$top=250';
  const result = await makeRequest('GET', apiPath);
  const runs = (result.json && result.json.value) || [];
  let total = 0, succeeded = 0, failed = 0, running = 0;
  for (const r of runs) {
    const p = r.properties || {};
    const start = p.startTime || p.createdTime || '';
    if (start && start < since) continue;
    total++;
    const s = String(p.status || '').toLowerCase();
    if (s === 'succeeded') succeeded++;
    else if (s === 'failed') failed++;
    else if (s === 'running' || s === 'waiting') running++;
  }
  const denom = succeeded + failed;
  const healthPct = denom > 0 ? Math.round((succeeded / denom) * 100) : null;
  return { total, succeeded, failed, running, healthPct };
}

// ---------------------------------------------------------------------------
// KPI aggregation (top overview KPIs sourced from the runs management API, not
// the SQL run tables which are periodically dropped/rolled and break unions).
// ---------------------------------------------------------------------------
function parseWindowMs(w) {
  if (!w) return 24 * 3600 * 1000;
  const m = String(w).trim().match(/^(\d+)\s*([smhd])$/i);
  if (!m) return 24 * 3600 * 1000;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const mult = unit === 's' ? 1000 : unit === 'm' ? 60000 : unit === 'h' ? 3600000 : 86400000;
  return n * mult;
}

// Page a single workflow's runs newer than sinceIso. Server honours
// "$filter=startTime ge <iso>"; we follow nextLink defensively with a cap.
async function fetchRunsInWindow(name, sinceIso, maxPages) {
  const runs = [];
  let apiPath = managementPath(`/runtime/webhooks/workflow/api/management/workflows/${encodeURIComponent(name)}/runs`)
    + `&$top=250&$filter=${encodeURIComponent('startTime ge ' + sinceIso)}`;
  let pages = 0;
  while (apiPath && pages < maxPages) {
    let result;
    try { result = await makeRequestWithRetry('GET', apiPath, undefined, 2); } catch { break; }
    if (!result.json) break;
    const val = result.json.value || [];
    for (const r of val) runs.push(r);
    pages++;
    const next = result.json.nextLink;
    if (!next || !val.length) break;
    try { const u = new URL(next); apiPath = u.pathname + u.search; } catch { break; }
  }
  return runs;
}

const KPI_CACHE = new Map(); // windowMs -> { ts, data, inFlight }
const KPI_CACHE_TTL_MS = 25000;       // considered fresh for 25s
const KPI_CACHE_MAX_AGE_MS = 600000;  // serve stale up to 10 min while refreshing

async function _computeKpiRaw(windowMs) {
  const t0 = Date.now();
  const now = Date.now();
  const sinceIso = new Date(now - windowMs).toISOString();
  const items = await listWorkflowsRaw();

  // Bucket the window into ~48 slots for the runs-over-time series.
  const buckets = 48;
  const bucketMs = Math.max(60000, Math.ceil(windowMs / buckets));
  const seriesMap = new Map(); // bucketStartMs -> {total, succeeded, failed}

  let total = 0, succeeded = 0, failed = 0, running = 0, cancelled = 0;
  let durationSum = 0, durationCount = 0;

  // Fetch all workflows concurrently; the runs API is the bottleneck so we want
  // as much parallelism as the app tolerates to keep the KPI refresh snappy.
  const CONCURRENCY = 16;
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const slice = items.slice(i, i + CONCURRENCY);
    const runLists = await Promise.all(slice.map(w =>
      fetchRunsInWindow(w.name, sinceIso, 40).catch(() => [])
    ));
    for (const runs of runLists) {
      for (const r of runs) {
        const p = r.properties || {};
        const start = p.startTime || p.createdTime;
        if (!start) continue;
        const startMs = Date.parse(start);
        if (isNaN(startMs) || startMs < (now - windowMs)) continue;
        total++;
        const s = String(p.status || '').toLowerCase();
        if (s === 'succeeded') succeeded++;
        else if (s === 'failed') failed++;
        else if (s === 'running' || s === 'waiting' || s === 'resuming') running++;
        else if (s === 'cancelled' || s === 'aborted') cancelled++;
        if (p.endTime && p.startTime) {
          const d = (Date.parse(p.endTime) - Date.parse(p.startTime)) / 1000;
          if (isFinite(d) && d >= 0) { durationSum += d; durationCount++; }
        }
        const bStart = now - windowMs + Math.floor((startMs - (now - windowMs)) / bucketMs) * bucketMs;
        const b = seriesMap.get(bStart) || { total: 0, succeeded: 0, failed: 0 };
        b.total++;
        if (s === 'succeeded') b.succeeded++;
        else if (s === 'failed') b.failed++;
        seriesMap.set(bStart, b);
      }
    }
  }

  const completed = succeeded + failed;
  const successRate = completed > 0 ? Math.round((succeeded / completed) * 1000) / 10 : null;
  const avgDurationSec = durationCount > 0 ? Math.round((durationSum / durationCount) * 100) / 100 : null;

  const series = Array.from(seriesMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([t, v]) => ({ time: t, total: v.total, succeeded: v.succeeded, failed: v.failed }));

  console.log(`[kpi] computed window=${windowMs}ms totalRuns=${total} in ${Date.now() - t0}ms`);
  return {
    window: windowMs,
    since: sinceIso,
    generatedAt: new Date(now).toISOString(),
    workflows: items.length,
    totalRuns: total,
    succeeded,
    failed,
    running,
    cancelled,
    successRate,
    avgDurationSec,
    series
  };
}

// Cache wrapper: single-flight + stale-while-revalidate so that the 5 KPI
// panels (all hitting this at once) never trigger overlapping full scans and
// Grafana refreshes get an instant (possibly slightly stale) response.
async function computeKpi(windowMs) {
  const entry = KPI_CACHE.get(windowMs) || {};
  const age = entry.ts ? (Date.now() - entry.ts) : Infinity;

  if (entry.data && age < KPI_CACHE_TTL_MS) return entry.data;

  const refresh = () => {
    if (entry.inFlight) return entry.inFlight;
    entry.inFlight = _computeKpiRaw(windowMs)
      .then(data => { entry.data = data; entry.ts = Date.now(); entry.inFlight = null; KPI_CACHE.set(windowMs, entry); return data; })
      .catch(err => { entry.inFlight = null; KPI_CACHE.set(windowMs, entry); throw err; });
    KPI_CACHE.set(windowMs, entry);
    return entry.inFlight;
  };

  // Have stale-but-usable data: refresh in background, return stale now.
  if (entry.data && age < KPI_CACHE_MAX_AGE_MS) {
    refresh().catch(() => {});
    return entry.data;
  }

  // No usable data yet: must wait for the computation (single-flight).
  return refresh();
}

// The dashboard KPIs are now served directly by SQL (mssql datasource with
// dynamic table discovery), so we no longer pre-warm the runs-API aggregation
// here — that full 24h scan is expensive and was adding load during load tests.
// The /api/kpi/* endpoints remain available on-demand for ad-hoc use.
const KPI_WARM_WINDOWS = [];
if (KPI_WARM_WINDOWS.length) {
  setInterval(() => {
    for (const w of KPI_WARM_WINDOWS) computeKpi(w).catch(() => {});
  }, 20000).unref();
}

async function getInventory() {
  const items = await listWorkflowsRaw();
  const rows = await Promise.all(items.map(async (w) => {
    let stats = { total: 0, succeeded: 0, failed: 0, running: 0, healthPct: null };
    try { stats = await getRuns24h(w.name); } catch { /* per-workflow best effort */ }
    const trigger = w.triggers ? Object.keys(w.triggers)[0] : null;
    const triggerType = trigger && w.triggers[trigger] ? (w.triggers[trigger].type || '') : '';
    return {
      name: w.name,
      kind: w.kind || '',
      subtitle: [w.kind, triggerType].filter(Boolean).join(' \u00b7 '),
      state: w.isDisabled ? 'Disabled' : 'Enabled',
      isDisabled: !!w.isDisabled,
      health: w.health && w.health.state ? w.health.state : '',
      healthPct: w.isDisabled ? null : stats.healthPct,
      runs24h: stats.total,
      running: stats.running,
      failed: stats.failed
    };
  }));
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

async function cancelRunningRuns(name) {
  const result = await makeRequest('GET', managementPath(`/runtime/webhooks/workflow/api/management/workflows/${encodeURIComponent(name)}/runs`) + `&$top=100&$filter=${encodeURIComponent("status eq 'Running'")}`);
  const runs = (result.json && result.json.value) || [];
  let canceled = 0;
  for (const run of runs) {
    const r = await makeRequest('POST', managementPath(`/runtime/webhooks/workflow/api/management/workflows/${encodeURIComponent(name)}/runs/${encodeURIComponent(run.name)}/cancel`));
    if (r.status >= 200 && r.status < 300) canceled++;
  }
  return { workflow: name, canceled, total: runs.length };
}

const INVENTORY_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>Workflow Manager</title><style>
*{box-sizing:border-box}
:root{--bg:#f4f5f5;--card:#fff;--border:#e2e5e9;--text:#1f1f1f;--muted:#6e6e78;--surface:#fafafa;--link:#3871dc;--bar:#f7f8fa;--on-bg:#e6f4ea;--on-fg:#1a7f4b;--off-bg:#e9eaec;--off-fg:#6e6e78;--hover:#f2f6fd}
body.dark{--bg:transparent;--card:#1f2028;--border:#30323d;--text:#d8d9e3;--muted:#9aa0ad;--surface:#191a20;--link:#6ea8fe;--bar:#191a20;--on-bg:#123524;--on-fg:#4ade80;--off-bg:#2a2c34;--off-fg:#9aa0ad;--hover:#232734}
body{margin:0;padding:12px;font:13px/1.45 Inter,Segoe UI,Arial,sans-serif;background:var(--bg);color:var(--text)}
.card{background:var(--card);border:1px solid var(--border);border-radius:8px;overflow:hidden}
.head{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--border)}
.title{font-size:15px;font-weight:600}
.alllink{margin-left:auto;color:var(--link);text-decoration:none;font-size:12px}
.search{margin-left:14px;flex:0 1 260px;font:inherit;font-size:12px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px}
.search::placeholder{color:var(--muted)}
.bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 12px;background:var(--bar);border-bottom:1px solid var(--border)}
.selcount{font-size:12px;color:var(--muted);margin-right:6px;min-width:74px}
.tb{font:inherit;font-size:12px;background:var(--card);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 10px;cursor:pointer}
.tb:hover:not(:disabled){background:var(--hover)}
.tb:disabled{opacity:.5;cursor:not-allowed}
.tb.ghost{color:var(--link)}
table{width:100%;border-collapse:collapse}
th,td{padding:9px 12px;text-align:left;border-bottom:1px solid var(--border);vertical-align:middle}
th{color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.03em}
th.cbx,td.cbx{width:34px}
.num{text-align:right}
tbody tr:hover{background:var(--hover)}
.wf{font-weight:600;color:var(--link)}
a.wf,a.rid{text-decoration:none;cursor:pointer;color:var(--link)}
a.wf:hover,a.rid:hover{text-decoration:underline}
.badge-run{background:#fff4e5;color:#b8860b}
body.dark .badge-run{background:#3a2e12;color:#facc15}
.rl{padding:14px}
.kvgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px 18px;margin-bottom:10px}
.kv{display:flex;flex-direction:column;gap:2px}
.kvk{font-size:10px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted)}
.kvv{font-size:13px}
.errbox{background:#fdecea;color:#b3261e;border:1px solid #f5c6cb;border-radius:6px;padding:8px 10px;font-size:12px;white-space:pre-wrap;margin-top:4px}
body.dark .errbox{background:#3a1d1d;color:#f8b4b4;border-color:#5b2626}
.sub{font-size:11px}
.muted{color:var(--muted)}
.badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600}
.badge-on{background:var(--on-bg);color:var(--on-fg)}
.badge-off{background:var(--off-bg);color:var(--off-fg)}
.hp{font-weight:600}
.hp.ok{color:#1a7f4b}.hp.warn{color:#b8860b}.hp.bad{color:#e02f44}
body.dark .hp.ok{color:#4ade80}body.dark .hp.warn{color:#facc15}body.dark .hp.bad{color:#f87171}
.actions a{color:var(--link);text-decoration:none;margin-right:10px;font-size:12px}
.actions a:hover{text-decoration:underline}
#status{display:none;padding:8px 14px;font-size:12px;color:var(--muted);border-top:1px solid var(--border)}
input[type=checkbox]{width:15px;height:15px;cursor:pointer}
</style></head><body>
<script>(function(){try{var p=window.parent&&window.parent.document&&window.parent.document.body;if(p&&(p.classList.contains('theme-dark')||p.getAttribute('data-theme')==='dark'))document.body.classList.add('dark')}catch(e){} if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)document.body.classList.add('dark'); if(new URLSearchParams(window.location.search).get('theme')==='dark')document.body.classList.add('dark');})();</script>
<div class="card">
  <div class="head"><div class="title">&#9776; Workflow inventory</div><input id="search" class="search" type="search" placeholder="Search workflows..." oninput="onSearch(this.value)" autocomplete="off"><a class="alllink" href="/runs" target="_blank">Run manager &#8594;</a></div>
  <div class="bar">
    <span id="selcount" class="selcount">0 selected</span>
    <button id="btnEnable" class="tb" onclick="bulk('enable')">&#10003; Enable</button>
    <button id="btnDisable" class="tb" onclick="bulk('disable')">&#10005; Disable</button>
    <button class="tb ghost" style="margin-left:auto" onclick="load()">&#8635; Refresh</button>
  </div>
  <table><thead><tr>
    <th class="cbx"><input type="checkbox" id="selall"></th>
    <th>Workflow</th><th>State</th><th>Health</th><th class="num">Runs 24h</th><th>Actions</th>
  </tr></thead><tbody id="tbody"></tbody></table>
  <div id="status"></div>
</div>
<div id="detail" class="card" style="display:none;margin-top:10px"></div>
<script>
var rows=[]; var selected=new Set(); var searchTerm='';
function currentVisible(){if(!searchTerm)return rows;return rows.filter(function(r){return String(r.name||'').toLowerCase().indexOf(searchTerm)>=0||String(r.subtitle||'').toLowerCase().indexOf(searchTerm)>=0;});}
function onSearch(v){searchTerm=String(v||'').toLowerCase();render();}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function api(path,opts){return fetch(path,opts).then(function(r){return r.json().catch(function(){return{};}).then(function(d){if(!r.ok)throw new Error(d.error||d.message||('HTTP '+r.status));return d;});});}
function setStatus(msg){var s=document.getElementById('status');s.textContent=msg||'';s.style.display=msg?'block':'none';}
function updateToolbar(){document.getElementById('selcount').textContent=selected.size+' selected';var dis=selected.size===0;['btnEnable','btnDisable'].forEach(function(id){document.getElementById(id).disabled=dis;});}
function stateBadge(st){return '<span class="badge '+(st==='Enabled'?'badge-on':'badge-off')+'">'+esc(st)+'</span>';}
function healthCell(r){if(r.isDisabled||r.healthPct==null)return '<span class="muted">&#8212;</span>';var c=r.healthPct>=95?'ok':(r.healthPct>=80?'warn':'bad');return '<span class="hp '+c+'">'+r.healthPct+'%</span>';}
function render(){
  var tb=document.getElementById('tbody');
  var vis=currentVisible();
  if(!rows.length){tb.innerHTML='<tr><td colspan="6" class="muted" style="padding:16px">No workflows found.</td></tr>';updateToolbar();return;}
  if(!vis.length){tb.innerHTML='<tr><td colspan="6" class="muted" style="padding:16px">No workflows match your search.</td></tr>';document.getElementById('selall').checked=false;updateToolbar();return;}
  var html='';
  vis.forEach(function(r){
    var enc=encodeURIComponent(r.name);
    var checked=selected.has(r.name)?' checked':'';
    var toggle=r.isDisabled
      ? '<a href="#" onclick="return rowAction(\\''+enc+'\\',\\'enable\\')">Enable</a>'
      : '<a href="#" onclick="return rowAction(\\''+enc+'\\',\\'disable\\')">Disable</a>';
    html+='<tr>'
      +'<td class="cbx"><input type="checkbox" data-name="'+esc(r.name)+'"'+checked+' onchange="toggleRow(this)"></td>'
      +'<td><a href="#" class="wf" onclick="return showRuns(\\''+enc+'\\')">'+esc(r.name)+'</a><div class="sub muted">'+esc(r.subtitle||'')+'</div></td>'
      +'<td>'+stateBadge(r.state)+'</td>'
      +'<td>'+healthCell(r)+'</td>'
      +'<td class="num">'+(r.runs24h!=null?r.runs24h:0)+'</td>'
      +'<td class="actions"><a href="#" onclick="return editWorkflow(\\''+enc+'\\')">Edit</a><a href="/api/workflows/'+enc+'/definition" target="_blank" class="muted" style="margin-left:8px">JSON</a>'+toggle+'</td>'
      +'</tr>';
  });
  tb.innerHTML=html;
  document.getElementById('selall').checked=(vis.length>0&&vis.every(function(r){return selected.has(r.name);}));
  updateToolbar();
}
function toggleRow(cb){var n=cb.getAttribute('data-name');if(cb.checked)selected.add(n);else selected.delete(n);var vis=currentVisible();document.getElementById('selall').checked=(vis.length>0&&vis.every(function(r){return selected.has(r.name);}));updateToolbar();}
function toggleAll(cb){var vis=currentVisible();if(cb.checked)vis.forEach(function(r){selected.add(r.name);});else vis.forEach(function(r){selected.delete(r.name);});Array.prototype.forEach.call(document.querySelectorAll('#tbody input[type=checkbox]'),function(c){c.checked=cb.checked;});updateToolbar();}
function load(){setStatus('Loading inventory...');return api('/api/inventory').then(function(d){rows=d.value||[];Array.from(selected).forEach(function(n){if(!rows.find(function(r){return r.name===n;}))selected.delete(n);});render();setStatus('');}).catch(function(e){setStatus('Error: '+e.message);});}
var ACTIONS={start:{ep:'trigger',verb:'Start'},stop:{ep:'cancel-running',verb:'Stop'},enable:{ep:'enable',verb:'Enable'},disable:{ep:'disable',verb:'Disable'},resubmit:{ep:'resubmit-failed',verb:'Resubmit'},cancel:{ep:'cancel-running',verb:'Cancel'}};
function callOne(name,action){var a=ACTIONS[action];return api('/api/workflows/'+encodeURIComponent(name)+'/'+a.ep,{method:'POST'});}
function bulk(action){var names=Array.from(selected);if(!names.length)return;var a=ACTIONS[action];setStatus(a.verb+' '+names.length+' workflow(s)...');var ok=0,fail=0;
  names.reduce(function(p,n){return p.then(function(){return callOne(n,action).then(function(){ok++;},function(){fail++;});});},Promise.resolve()).then(function(){var extra=(action==='enable'||action==='disable')?' \\u2014 revision rollover in progress, refresh in ~1 min':'';setStatus(a.verb+': '+ok+' ok'+(fail?(', '+fail+' failed'):'')+extra);setTimeout(load,1500);});}
function rowAction(enc,action){var name=decodeURIComponent(enc);var a=ACTIONS[action];setStatus(a.verb+' '+name+'...');callOne(name,action).then(function(d){setStatus(d.message||'Done');setTimeout(load,1500);}).catch(function(e){setStatus('Error: '+e.message);});return false;}
function editWorkflow(enc){var name=decodeURIComponent(enc);setStatus('Opening '+name+' in VS Code...');api('/api/workflows/'+encodeURIComponent(name)+'/open-vscode',{method:'POST'}).then(function(r){setStatus(r.message||('Opened '+name+' in VS Code.'));}).catch(function(e){setStatus('Edit failed: '+e.message);});return false;}
function runBadge(st){var c=st==='Succeeded'?'badge-on':(st==='Running'?'badge-run':'badge-off');return '<span class="badge '+c+'">'+esc(st||'-')+'</span>';}
function fmtDur(p){if(!p.startTime||!p.endTime)return '-';var d=(new Date(p.endTime)-new Date(p.startTime))/1000;return (d>=0?d.toFixed(1):'0.0')+'s';}
function closeRuns(){var d=document.getElementById('detail');d.style.display='none';d.innerHTML='';return false;}
function showRuns(enc){var name=decodeURIComponent(enc);var d=document.getElementById('detail');d.style.display='block';d.innerHTML='<div class="head"><div class="title">&#9737; Runs \\u2014 '+esc(name)+'</div><a class="alllink" href="#" onclick="return closeRuns()">Close &#10005;</a></div><div class="rl muted">Loading runs...</div>';d.scrollIntoView({behavior:'smooth',block:'nearest'});api('/api/workflows/'+encodeURIComponent(name)+'/runs?top=100').then(function(res){renderRuns(name,res.value||[]);}).catch(function(e){var m=d.querySelector('.rl');if(m)m.textContent='Error: '+e.message;});return false;}
function renderRuns(name,runs){var d=document.getElementById('detail');var nEnc=encodeURIComponent(name);var head='<div class="head"><div class="title">&#9737; Runs \\u2014 '+esc(name)+' <span class="muted" style="font-weight:400">('+runs.length+')</span></div><a class="alllink" href="#" onclick="return closeRuns()">Close &#10005;</a></div>';if(!runs.length){d.innerHTML=head+'<div class="rl muted">No runs found.</div>';return;}var h=head+'<table><thead><tr><th>Run ID</th><th>Status</th><th>Start</th><th class="num">Duration</th><th>Error</th><th>Actions</th></tr></thead><tbody>';runs.forEach(function(run){var p=run.properties||{};var start=(p.startTime||'').replace('T',' ').slice(0,19);var err=(p.error&&p.error.message)?p.error.message:'';var rEnc=encodeURIComponent(run.name);h+='<tr><td class="sub"><a href="#" class="rid" onclick="return showRunDetail(\\''+nEnc+'\\',\\''+rEnc+'\\')">'+esc(run.name)+'</a></td><td>'+runBadge(p.status||'')+'</td><td class="sub">'+esc(start)+'</td><td class="num sub">'+fmtDur(p)+'</td><td class="sub muted" style="max-width:280px">'+esc(err)+'</td><td class="actions"><a href="#" onclick="return resubmitRun(\\''+nEnc+'\\',\\''+rEnc+'\\')">Resubmit</a></td></tr>';});h+='</tbody></table>';d.innerHTML=h;}
function resubmitRun(nEnc,rEnc){var name=decodeURIComponent(nEnc);var rid=decodeURIComponent(rEnc);setStatus('Resubmitting '+rid+'...');api('/api/workflows/'+encodeURIComponent(name)+'/runs/'+encodeURIComponent(rid)+'/resubmit',{method:'POST'}).then(function(){setStatus('Resubmitted '+rid+'. Reloading...');setTimeout(function(){showRuns(encodeURIComponent(name));},1500);}).catch(function(e){setStatus('Error: '+e.message);});return false;}
function kv(k,v){return '<div class="kv"><span class="kvk">'+esc(k)+'</span><span class="kvv">'+v+'</span></div>';}
function showRunDetail(nEnc,rEnc){var name=decodeURIComponent(nEnc);var rid=decodeURIComponent(rEnc);var d=document.getElementById('detail');d.style.display='block';d.innerHTML='<div class="head"><div class="title">&#9737; Run detail</div><a class="alllink" href="#" onclick="return showRuns(\\''+nEnc+'\\')">&#8592; Back to runs</a></div><div class="rl muted">Loading run '+esc(rid)+'...</div>';d.scrollIntoView({behavior:'smooth',block:'nearest'});api('/api/workflows/'+encodeURIComponent(name)+'/runs/'+encodeURIComponent(rid)).then(function(res){renderRunDetail(nEnc,rid,res);}).catch(function(e){var m=d.querySelector('.rl');if(m)m.textContent='Error: '+e.message;});return false;}
function renderRunDetail(nEnc,rid,res){var d=document.getElementById('detail');var run=res.run||{};var p=run.properties||{};var actions=res.actions||[];var err=(p.error&&p.error.message)?p.error.message:'';var ctid=(p.correlation&&p.correlation.clientTrackingId)?p.correlation.clientTrackingId:'';var start=(p.startTime||'').replace('T',' ').slice(0,19);var end=(p.endTime||'').replace('T',' ').slice(0,19);var trig=(p.trigger&&p.trigger.name)?p.trigger.name:'';
  var h='<div class="head"><div class="title">&#9737; Run detail <span class="muted" style="font-weight:400">'+esc(rid)+'</span></div><a class="alllink" href="#" onclick="return showRuns(\\''+nEnc+'\\')">&#8592; Back to runs</a></div>';
  h+='<div class="rl"><div class="kvgrid">'+kv('Status',runBadge(p.status||''))+kv('Start',esc(start)||'-')+kv('End',esc(end)||'-')+kv('Duration',fmtDur(p))+kv('Code',esc(p.code||'-'))+kv('Trigger',esc(trig||'-'))+kv('Tracking ID',esc(ctid||'-'))+'</div>';
  if(err)h+='<div class="errbox">'+esc(err)+'</div>';
  h+='</div>';
  h+='<table><thead><tr><th>Action</th><th>Status</th><th>Start</th><th class="num">Duration</th><th>Code</th><th>Error</th></tr></thead><tbody>';
  if(!actions.length){h+='<tr><td colspan="6" class="muted rl">No action-level details available for this run.</td></tr>';}
  actions.forEach(function(a){var ap=a.properties||{};var aerr=(ap.error&&ap.error.message)?ap.error.message:'';var as=(ap.startTime||'').replace('T',' ').slice(0,19);h+='<tr><td class="sub">'+esc(a.name)+'</td><td>'+runBadge(ap.status||'')+'</td><td class="sub">'+esc(as)+'</td><td class="num sub">'+fmtDur(ap)+'</td><td class="sub">'+esc(ap.code||'-')+'</td><td class="sub muted" style="max-width:260px">'+esc(aerr)+'</td></tr>';});
  h+='</tbody></table>';
  d.innerHTML=h;}
document.getElementById('selall').addEventListener('change',function(){toggleAll(this);});
load();
setInterval(load,60000);
</script></body></html>`;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    // Cheap liveness probe for the watchdog — never touches upstream, so a slow
    // runs API under load can't make the manager look "down" and trigger a
    // needless restart loop.
    if (path === '/healthz' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, uptime: process.uptime() });
      return;
    }

    if (path === '/api/workflows' && req.method === 'GET') {
      const result = await makeRequest('GET', managementPath('/runtime/webhooks/workflow/api/management/workflows'));
      sendJson(res, result.status, result.json || []);
      return;
    }

    if (path === '/api/inventory' && req.method === 'GET') {
      const rows = await getInventory();
      sendJson(res, 200, { value: rows });
      return;
    }

    if (path === '/api/kpi/summary' && req.method === 'GET') {
      const windowMs = parseWindowMs(url.searchParams.get('window'));
      try {
        const k = await computeKpi(windowMs);
        sendJson(res, 200, {
          window: url.searchParams.get('window') || '24h',
          since: k.since,
          generatedAt: k.generatedAt,
          workflows: k.workflows,
          totalRuns: k.totalRuns,
          succeeded: k.succeeded,
          failed: k.failed,
          running: k.running,
          cancelled: k.cancelled,
          successRate: k.successRate,
          avgDurationSec: k.avgDurationSec
        });
      } catch (err) {
        sendJson(res, 502, { error: `KPI summary failed: ${err.message || err}` });
      }
      return;
    }

    if (path === '/api/kpi/timeseries' && req.method === 'GET') {
      const windowMs = parseWindowMs(url.searchParams.get('window'));
      try {
        const k = await computeKpi(windowMs);
        sendJson(res, 200, { window: url.searchParams.get('window') || '24h', series: k.series });
      } catch (err) {
        sendJson(res, 502, { error: `KPI timeseries failed: ${err.message || err}` });
      }
      return;
    }

    if (path === '/api/volumes' && req.method === 'GET') {
      try {
        sendJson(res, 200, getVolumes());
      } catch (err) {
        sendJson(res, 500, { error: `volumes failed: ${err.message || err}` });
      }
      return;
    }

    if (path.match(/^\/api\/workflows\/([^/]+)\/(enable|disable)$/) && req.method === 'POST') {
      const m = path.match(/^\/api\/workflows\/([^/]+)\/(enable|disable)$/);
      const workflow = decodeURIComponent(m[1]);
      const verb = m[2];
      try {
        const out = await setFlowState(workflow, verb === 'enable' ? 'Enabled' : 'Disabled');
        sendJson(res, 200, { message: `${verb === 'enable' ? 'Enabled' : 'Disabled'} ${workflow} (revision rollover in progress)`, ...out });
      } catch (err) {
        sendJson(res, 500, { error: `Failed to ${verb} ${workflow}: ${err.message || err}` });
      }
      return;
    }

    if (path.match(/^\/api\/workflows\/([^/]+)\/cancel-running$/) && req.method === 'POST') {
      const workflow = decodeURIComponent(path.match(/^\/api\/workflows\/([^/]+)\/cancel-running$/)[1]);
      const out = await cancelRunningRuns(workflow);
      sendJson(res, 200, { message: `Canceled ${out.canceled}/${out.total} running run(s) for ${workflow}`, ...out });
      return;
    }

    if (path.match(/^\/api\/workflows\/([^/]+)\/open-vscode$/) && req.method === 'POST') {
      const workflow = decodeURIComponent(path.match(/^\/api\/workflows\/([^/]+)\/open-vscode$/)[1]);
      const result = openWorkflowInVSCode(workflow);
      sendJson(res, result.ok ? 200 : 400, result);
      return;
    }

    if (path.match(/^\/api\/workflows\/([^/]+)\/definition$/) && req.method === 'GET') {
      const workflow = decodeURIComponent(path.match(/^\/api\/workflows\/([^/]+)\/definition$/)[1]);
      const result = await makeRequest('GET', managementPath(`/admin/vfs/home/site/wwwroot/${encodeURIComponent(workflow)}/workflow.json`));
      res.writeHead(result.status === 200 ? 200 : result.status, { 'Content-Type': 'application/json' });
      res.end(result.body || '{}');
      return;
    }

    if ((path === '/' || path === '/inventory') && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(INVENTORY_HTML);
      return;
    }

    if (path.match(/^\/api\/workflows\/([^/]+)\/runs$/) && req.method === 'GET') {
      const workflow = decodeURIComponent(path.match(/^\/api\/workflows\/([^/]+)\/runs$/)[1]);
      const top = url.searchParams.get('top') || '20';
      const filter = url.searchParams.get('filter');
      let apiPath = managementPath(`/runtime/webhooks/workflow/api/management/workflows/${encodeURIComponent(workflow)}/runs`) + `&$top=${encodeURIComponent(top)}`;
      if (filter) apiPath += `&$filter=${encodeURIComponent(filter)}`;
      const result = await makeRequest('GET', apiPath);
      sendJson(res, result.status, result.json || {});
      return;
    }

    if (path.match(/^\/api\/workflows\/([^/]+)\/runs\/([^/]+)$/) && req.method === 'GET') {
      const [, workflow, runId] = path.match(/^\/api\/workflows\/([^/]+)\/runs\/([^/]+)$/);
      const runResult = await makeRequest('GET', managementPath(`/runtime/webhooks/workflow/api/management/workflows/${encodeURIComponent(workflow)}/runs/${encodeURIComponent(runId)}`));
      let actions = [];
      try {
        const actResult = await makeRequest('GET', managementPath(`/runtime/webhooks/workflow/api/management/workflows/${encodeURIComponent(workflow)}/runs/${encodeURIComponent(runId)}/actions`) + `&$top=100`);
        if (actResult.json && Array.isArray(actResult.json.value)) actions = actResult.json.value;
      } catch (e) { /* actions best effort */ }
      sendJson(res, runResult.status, { run: runResult.json || {}, actions });
      return;
    }

    if (path.match(/^\/api\/workflows\/([^/]+)\/runs\/([^/]+)\/cancel$/) && req.method === 'POST') {
      const [, workflow, runId] = path.match(/^\/api\/workflows\/([^/]+)\/runs\/([^/]+)\/cancel$/);
      const result = await makeRequest('POST', managementPath(`/runtime/webhooks/workflow/api/management/workflows/${encodeURIComponent(workflow)}/runs/${encodeURIComponent(runId)}/cancel`));
      sendJson(res, result.status >= 200 && result.status < 300 ? 200 : result.status, {
        message: result.status >= 200 && result.status < 300 ? `Canceled ${runId}` : `Cancel failed (${result.status})`,
        status: result.status,
        error: result.status >= 200 && result.status < 300 ? undefined : result.body
      });
      return;
    }

    if (path.match(/^\/api\/workflows\/([^/]+)\/runs\/([^/]+)\/resubmit$/) && req.method === 'POST') {
      const [, workflow, runId] = path.match(/^\/api\/workflows\/([^/]+)\/runs\/([^/]+)\/resubmit$/);
      const runResult = await makeRequest('GET', managementPath(`/runtime/webhooks/workflow/api/management/workflows/${encodeURIComponent(workflow)}/runs/${encodeURIComponent(runId)}`));
      const run = runResult.json || {};
      const triggerName = run.properties && run.properties.trigger && run.properties.trigger.name ? run.properties.trigger.name : await getWorkflowTriggerName(workflow);
      const result = await makeRequest('POST', managementPath(`/runtime/webhooks/workflow/api/management/workflows/${encodeURIComponent(workflow)}/triggers/${encodeURIComponent(triggerName)}/histories/${encodeURIComponent(runId)}/resubmit`));
      sendJson(res, result.status === 202 ? 200 : result.status, {
        message: result.status === 202 ? `Resubmitted ${runId} via trigger '${triggerName}'` : `Resubmit failed (${result.status})`,
        status: result.status,
        trigger: triggerName,
        error: result.status === 202 ? undefined : result.body
      });
      return;
    }

    if (path.match(/^\/api\/workflows\/([^/]+)\/resubmit-failed$/) && req.method === 'POST') {
      const workflow = decodeURIComponent(path.match(/^\/api\/workflows\/([^/]+)\/resubmit-failed$/)[1]);
      const runsResult = await makeRequest('GET', managementPath(`/runtime/webhooks/workflow/api/management/workflows/${encodeURIComponent(workflow)}/runs`) + `&$top=250&$filter=${encodeURIComponent("status eq 'Failed'")}`);
      const runs = (runsResult.json && runsResult.json.value) || [];
      const results = [];
      for (const run of runs) {
        const triggerName = run.properties && run.properties.trigger && run.properties.trigger.name ? run.properties.trigger.name : await getWorkflowTriggerName(workflow);
        const result = await makeRequest('POST', managementPath(`/runtime/webhooks/workflow/api/management/workflows/${encodeURIComponent(workflow)}/triggers/${encodeURIComponent(triggerName)}/histories/${encodeURIComponent(run.name)}/resubmit`));
        results.push({ runId: run.name, trigger: triggerName, status: result.status, ok: result.status === 202 });
      }
      sendJson(res, 200, { message: `Resubmitted ${results.filter(r => r.ok).length}/${results.length} failed runs`, results });
      return;
    }

    if (path.match(/^\/api\/workflows\/([^/]+)\/trigger$/) && req.method === 'POST') {
      const workflow = decodeURIComponent(path.match(/^\/api\/workflows\/([^/]+)\/trigger$/)[1]);
      const triggerName = await getWorkflowTriggerName(workflow);
      const result = await makeRequest('POST', managementPath(`/runtime/webhooks/workflow/api/management/workflows/${encodeURIComponent(workflow)}/triggers/${encodeURIComponent(triggerName)}/run`));
      sendJson(res, result.status === 200 || result.status === 202 ? 200 : result.status, { message: result.status < 300 ? `Triggered ${workflow}` : `Trigger failed (${result.status})`, trigger: triggerName, status: result.status, error: result.status >= 400 ? result.body : undefined });
      return;
    }

    if (path.match(/^\/api\/workflows\/([^/]+)\/callback-url$/) && req.method === 'GET') {
      const workflow = decodeURIComponent(path.match(/^\/api\/workflows\/([^/]+)\/callback-url$/)[1]);
      const triggerName = await getWorkflowTriggerName(workflow);
      const result = await makeRequest('POST', managementPath(`/runtime/webhooks/workflow/api/management/workflows/${encodeURIComponent(workflow)}/triggers/${encodeURIComponent(triggerName)}/listCallbackUrl`));
      sendJson(res, result.status, { workflow, trigger: triggerName, callbackUrl: result.json || result.body });
      return;
    }

    if (path.match(/^\/api\/workflows\/([^/]+)\/trigger-remote$/) && req.method === 'POST') {
      const workflow = decodeURIComponent(path.match(/^\/api\/workflows\/([^/]+)\/trigger-remote$/)[1]);
      const triggerName = await getWorkflowTriggerName(workflow);
      const callbackResult = await makeRequest('POST', managementPath(`/runtime/webhooks/workflow/api/management/workflows/${encodeURIComponent(workflow)}/triggers/${encodeURIComponent(triggerName)}/listCallbackUrl`));
      const callbackBody = callbackResult.json || {};
      const callbackUrl = callbackBody.value || callbackBody.url;
      if (!callbackUrl) throw new Error('Callback URL was not returned by listCallbackUrl');
      const payload = await readJsonBody(req);
      const triggerResult = await makeRequest(callbackBody.method || 'POST', callbackUrl, payload);
      sendJson(res, triggerResult.status >= 200 && triggerResult.status < 300 ? 200 : triggerResult.status, { message: `Remote trigger sent for ${workflow}`, trigger: triggerName, callbackUrl, status: triggerResult.status, response: triggerResult.json || triggerResult.body });
      return;
    }

    if (path === '/runs' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Logic Apps Run Manager</title><style>*{box-sizing:border-box} :root{--bg:#f4f5f5;--card:#fff;--border:#dfe2e5;--text:#1f1f1f;--muted:#6e6e78;--btn:#3871dc;--danger:#e02f44;--success:#1a7f4b;--accent:#6f42c1;--surface:#fafafa} body.dark{--bg:transparent;--card:#1f2028;--border:#30323d;--text:#d8d9e3;--muted:#a7a9b7;--surface:#111218} body{margin:0;padding:12px;font:13px/1.45 Inter,Arial,sans-serif;background:var(--bg);color:var(--text)} h1{margin:0 0 12px;font-size:16px}.card{background:var(--card);border:1px solid var(--border);border-radius:4px;padding:12px;margin-bottom:10px}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center} button,select,textarea{font:inherit} button{border:none;border-radius:4px;color:#fff;padding:6px 10px;cursor:pointer}.primary{background:var(--btn)}.danger{background:var(--danger)}.success{background:var(--success)}.accent{background:var(--accent)} select,textarea{width:100%;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:4px;padding:6px 8px} textarea{min-height:80px} table{width:100%;border-collapse:collapse;margin-top:10px} th,td{padding:6px 8px;border-bottom:1px solid var(--border);text-align:left} th{color:var(--muted);font-weight:600}.muted{color:var(--muted)} #output{white-space:pre-wrap;background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:8px;display:none}</style></head><body><script>(function(){try{const p=window.parent&&window.parent.document&&window.parent.document.body;if(p&&(p.classList.contains('theme-dark')||p.getAttribute('data-theme')==='dark'))document.body.classList.add('dark')}catch{} if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)document.body.classList.add('dark'); if(new URLSearchParams(window.location.search).get('theme')==='dark')document.body.classList.add('dark');})();</script><h1>⚡ Logic Apps Run Manager</h1><div class="card"><div class="row"><div style="min-width:220px;flex:1 1 220px;"><label class="muted">Workflow</label><select id="workflow"></select></div><div class="row" style="align-self:flex-end;"><button class="primary" onclick="listRuns()">List Runs</button><button class="danger" onclick="listFailedRuns()">Failed Runs</button><button class="danger" onclick="resubmitFailed()">Retry All Failed</button><button class="success" onclick="triggerWorkflow()">Trigger</button><button class="success" onclick="triggerRemote()">Remote Trigger</button><button class="accent" onclick="getRemoteTriggerUrl()">Remote URL</button></div></div></div><div class="card"><label class="muted">Remote trigger payload (JSON)</label><textarea id="payload">{}</textarea></div><div id="output"></div><div id="results"></div><script>const workflowEl=document.getElementById('workflow'); const outputEl=document.getElementById('output'); const resultsEl=document.getElementById('results'); function showOutput(v){outputEl.style.display='block'; outputEl.textContent=typeof v==='string'?v:JSON.stringify(v,null,2)} function selectedWorkflow(){return workflowEl.value} async function api(path,options){const response=await fetch(path,options); const data=await response.json().catch(()=>({})); if(!response.ok) throw new Error(data.error||data.message||\`Request failed (\${response.status})\`); return data} async function refreshWorkflows(){const data=await api('/api/workflows'); const items=Array.isArray(data.value)?data.value:(Array.isArray(data)?data:[]); workflowEl.innerHTML=''; items.forEach(item=>{const option=document.createElement('option'); option.value=item.name; option.textContent=item.name; workflowEl.appendChild(option);});} function renderRuns(runs,failedOnly=false){if(!runs.length){resultsEl.innerHTML='<div class="card">No runs found.</div>'; return;} let html='<div class="card"><table><tr><th>Run ID</th><th>Status</th><th>Start</th><th>Duration</th><th>Action</th></tr>'; runs.forEach(run=>{const p=run.properties||{}; const start=(p.startTime||'').replace('T',' ').slice(0,19); const duration=p.endTime&&p.startTime?\`\${((new Date(p.endTime)-new Date(p.startTime))/1000).toFixed(1)}s\`:'-'; html+=\`<tr><td>\${run.name}</td><td>\${p.status||''}</td><td>\${start}</td><td>\${duration}</td><td><button class="primary" onclick="resubmitRun('\${run.name}')">Resubmit</button></td></tr>\`;}); html+='</table></div>'; resultsEl.innerHTML=html; if(failedOnly) showOutput(\`Loaded \${runs.length} failed run(s).\`); else outputEl.style.display='none';}       async function listRuns(){showOutput('Loading runs...'); const data=await api(\`/api/workflows/\${encodeURIComponent(selectedWorkflow())}/runs?top=1000\`); renderRuns(data.value||[]);} async function listFailedRuns(){showOutput('Loading failed runs...'); const data=await api(\`/api/workflows/\${encodeURIComponent(selectedWorkflow())}/runs?top=1000&filter=\${encodeURIComponent(\"status eq 'Failed'\")}\`); renderRuns(data.value||[],true);} async function resubmitRun(runId){showOutput(\`Resubmitting \${runId}...\`); const data=await api(\`/api/workflows/\${encodeURIComponent(selectedWorkflow())}/runs/\${encodeURIComponent(runId)}/resubmit\`,{method:'POST'}); showOutput(data); setTimeout(listRuns,1500);} async function resubmitFailed(){showOutput('Retrying failed runs...'); const data=await api(\`/api/workflows/\${encodeURIComponent(selectedWorkflow())}/resubmit-failed\`,{method:'POST'}); showOutput(data); setTimeout(listRuns,2000);} async function triggerWorkflow(){showOutput(\`Triggering \${selectedWorkflow()}...\`); const data=await api(\`/api/workflows/\${encodeURIComponent(selectedWorkflow())}/trigger\`,{method:'POST'}); showOutput(data); setTimeout(listRuns,2000);} async function triggerRemote(){showOutput(\`Sending remote trigger for \${selectedWorkflow()}...\`); let payload={}; try{payload=JSON.parse(document.getElementById('payload').value||'{}')}catch{throw new Error('Payload must be valid JSON')} const data=await api(\`/api/workflows/\${encodeURIComponent(selectedWorkflow())}/trigger-remote\`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); showOutput(data); setTimeout(listRuns,2000);} async function getRemoteTriggerUrl(){showOutput(\`Loading callback URL for \${selectedWorkflow()}...\`); const data=await api(\`/api/workflows/\${encodeURIComponent(selectedWorkflow())}/callback-url\`); const callback=data.callbackUrl&&data.callbackUrl.value?data.callbackUrl.value:JSON.stringify(data.callbackUrl||{},null,2); resultsEl.innerHTML=\`<div class="card"><div class="muted">Trigger: \${data.trigger||''}</div><textarea readonly>\${callback}</textarea></div>\`; showOutput('Callback URL loaded.');} refreshWorkflows().catch(err=>showOutput(err.message));</script></body></html>`); 
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(res, 500, { error: error.message || String(error) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Logic Apps Run Manager listening on http://localhost:${PORT}`);
  console.log(`Using Logic Apps base URL ${CONFIG.logicAppBase}`);
});



'@

    $template.Replace('__CONFIG_JSON__', $configJson)
}

function Get-AppManagerScript {
    $ocCmd = Get-Command oc -ErrorAction SilentlyContinue
    $ocPathForAppManager = if ($ocCmd -and $ocCmd.Source) { $ocCmd.Source } else { 'oc' }
    $configJson = [ordered]@{
        port           = $AppManagerPort
        namespace      = $Namespace
        appName        = $AppName
        kubeconfigPath = $KubeConfigPath
        kubeContext    = $KubeContext
        ocPath         = $ocPathForAppManager
        loginRefreshSeconds = 240
        logContainer   = 'logicapps-container'
    } | ConvertTo-Json -Compress

    $existingAppManager = Join-Path $PortalRoot 'app-manager.js'
    if (Test-Path -LiteralPath $existingAppManager) {
        $existingScript = Get-Content -LiteralPath $existingAppManager -Raw
        if ($existingScript -match 'const CONFIG = .+?;' -and $existingScript -match 'api/logs/stream') {
            return [regex]::Replace($existingScript, 'const CONFIG = .+?;', "const CONFIG = $configJson;", 1)
        }
    }

@'
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const http = require('http');
const fs = require('fs');

const CONFIG = __CONFIG_JSON__;
const execFileAsync = promisify(execFile);
const PORT = CONFIG.port;

function tryParseJson(value) {
  try { return JSON.parse(value); } catch { return null; }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function runOc(args) {
  const env = { ...process.env };
  if (CONFIG.kubeconfigPath) env.KUBECONFIG = CONFIG.kubeconfigPath;
  const ocArgs = CONFIG.kubeContext ? ['--context', CONFIG.kubeContext, ...args] : args;
  const result = await execFileAsync(CONFIG.ocPath, ocArgs, { env, maxBuffer: 20 * 1024 * 1024 });
  return (result.stdout || '').trim();
}

function deriveRevisionName(podName, labels) {
  return (labels && labels['containerapps.io/revision-name']) || (String(podName || '').match(/--([^-]+)-/) || [])[1] || 'unknown';
}

function extractEnv(container) {
  const envs = Array.isArray(container && container.env) ? container.env : [];
  return envs.map((entry) => {
    if (entry.valueFrom) {
      const src = entry.valueFrom.secretKeyRef ? `secret:${entry.valueFrom.secretKeyRef.name}/${entry.valueFrom.secretKeyRef.key}` :
        entry.valueFrom.configMapKeyRef ? `configmap:${entry.valueFrom.configMapKeyRef.name}/${entry.valueFrom.configMapKeyRef.key}` :
        entry.valueFrom.fieldRef ? `field:${entry.valueFrom.fieldRef.fieldPath}` :
        entry.valueFrom.resourceFieldRef ? `resource:${entry.valueFrom.resourceFieldRef.resource}` : 'valueFrom';
      return { name: entry.name, value: src, source: 'reference' };
    }
    return { name: entry.name, value: entry.value ?? '', source: 'literal' };
  });
}

function selectAppContainer(containers) {
  const list = Array.isArray(containers) ? containers : [];
  return list.find((container) => {
    const name = String(container && container.name || '');
    const image = String(container && container.image || '');
    return !/(^|[-_/])(envoy|proxy)([-_/]|$)/i.test(name) && !/(envoy|proxy)/i.test(image);
  }) || list[0] || null;
}

async function getAppState() {
  const out = await runOc(['-n', CONFIG.namespace, 'get', 'pods', '-l', `containerapps.io/app-name=${CONFIG.appName}`, '-o', 'json']);
  const payload = tryParseJson(out) || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  const revisions = new Map();
  const replicas = [];

  for (const pod of items) {
    const meta = pod.metadata || {};
    const status = pod.status || {};
    const spec = pod.spec || {};
    const labels = meta.labels || {};
    const podName = meta.name || '';
    const revision = deriveRevisionName(podName, labels);
    const container = Array.isArray(spec.containers) ? spec.containers[0] : null;
    const containerStatuses = Array.isArray(status.containerStatuses) ? status.containerStatuses : [];
    const ready = containerStatuses.some((c) => c && c.ready);
    const restartCount = containerStatuses.reduce((sum, c) => sum + (c && c.restartCount ? c.restartCount : 0), 0);
    const row = revisions.get(revision) || { revision, replicas: 0, readyReplicas: 0, restartCount: 0, pods: [] };
    row.replicas += 1;
    row.readyReplicas += ready ? 1 : 0;
    row.restartCount += restartCount;
    row.pods.push(podName);
    revisions.set(revision, row);

    replicas.push({
      pod: podName,
      revision,
      phase: status.phase || '',
      ready,
      restarts: restartCount,
      node: status.nodeName || '',
      age: meta.creationTimestamp || ''
    });
  }

  const revisionRows = Array.from(revisions.values()).map((row) => ({
    ...row,
    health: row.readyReplicas === row.replicas && row.replicas > 0 ? 'Healthy' : (row.readyReplicas > 0 ? 'Degraded' : 'Unhealthy')
  })).sort((a, b) => a.revision.localeCompare(b.revision));

  const appInfo = items[0] || {};
  const container = selectAppContainer((appInfo.spec || {}).containers);
  const env = extractEnv(container);

  return {
    namespace: CONFIG.namespace,
    appName: CONFIG.appName,
    image: container ? container.image || '' : '',
    command: container ? (container.command || []).join(' ') : '',
    args: container ? (container.args || []).join(' ') : '',
    env,
    revisions: revisionRows,
    replicas
  };
}

function revisionSortKey(rev) {
  const m = String(rev || '').match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : -1;
}

// Recent errors for the LATEST revision's pods: container waiting/terminated
// error reasons, non-ready containers, plus recent Warning events (FailedMount,
// BackOff, Unhealthy, etc.). Used to highlight problems in the App Manager.
async function getAppErrors() {
  const podsOut = await runOc(['-n', CONFIG.namespace, 'get', 'pods', '-l', `containerapps.io/app-name=${CONFIG.appName}`, '-o', 'json']);
  const podsPayload = tryParseJson(podsOut) || {};
  const items = Array.isArray(podsPayload.items) ? podsPayload.items : [];
  if (!items.length) return { latestRevision: null, pods: [], problems: [] };

  let latestRevision = null;
  let latestKey = -Infinity;
  for (const pod of items) {
    const rev = deriveRevisionName(pod.metadata && pod.metadata.name, (pod.metadata || {}).labels);
    const key = revisionSortKey(rev);
    if (key > latestKey) { latestKey = key; latestRevision = rev; }
  }

  const latestPods = items.filter((pod) => deriveRevisionName(pod.metadata && pod.metadata.name, (pod.metadata || {}).labels) === latestRevision);
  const podNames = new Set(latestPods.map((p) => (p.metadata || {}).name));
  const problems = [];

  for (const pod of latestPods) {
    const podName = (pod.metadata || {}).name || '';
    const status = pod.status || {};
    const statuses = [...(status.containerStatuses || []), ...(status.initContainerStatuses || [])];
    for (const cs of statuses) {
      const w = cs.state && cs.state.waiting;
      const t = cs.state && cs.state.terminated;
      if (w && (POD_HEALTH_WAIT.has(w.reason) || /err|invalid|backoff|crash/i.test(w.reason || ''))) {
        problems.push({ severity: 'error', pod: podName, container: cs.name, reason: w.reason, message: (w.message || '').trim(), source: 'container' });
      } else if (t && t.exitCode !== 0) {
        problems.push({ severity: 'error', pod: podName, container: cs.name, reason: t.reason || ('Exit ' + t.exitCode), message: (t.message || '').trim(), source: 'container' });
      } else if (cs.restartCount && cs.restartCount > 0 && !cs.ready) {
        problems.push({ severity: 'warning', pod: podName, container: cs.name, reason: 'Restarting (' + cs.restartCount + ')', message: '', source: 'container' });
      }
    }
    // pods stuck not-ready (e.g. ContainerCreating due to mount failures)
    const phase = status.phase || '';
    const anyReady = (status.containerStatuses || []).some((c) => c && c.ready);
    if (phase !== 'Succeeded' && phase !== 'Running' && !anyReady) {
      problems.push({ severity: 'warning', pod: podName, container: '', reason: phase || 'NotReady', message: '', source: 'phase' });
    }
  }

  // Recent Warning events for the latest-revision pods.
  try {
    const evOut = await runOc(['-n', CONFIG.namespace, 'get', 'events', '--field-selector', 'type=Warning', '-o', 'json']);
    const evPayload = tryParseJson(evOut) || {};
    const events = Array.isArray(evPayload.items) ? evPayload.items : [];
    events
      .filter((e) => e.involvedObject && e.involvedObject.kind === 'Pod' && podNames.has(e.involvedObject.name))
      .sort((a, b) => new Date(b.lastTimestamp || b.eventTime || 0) - new Date(a.lastTimestamp || a.eventTime || 0))
      .slice(0, 15)
      .forEach((e) => {
        problems.push({
          severity: 'error',
          pod: e.involvedObject.name,
          container: '',
          reason: e.reason || 'Warning',
          message: (e.message || '').trim(),
          count: e.count || 1,
          lastSeen: e.lastTimestamp || e.eventTime || '',
          source: 'event'
        });
      });
  } catch (_) { /* events best-effort */ }

  return {
    latestRevision,
    pods: latestPods.map((p) => (p.metadata || {}).name),
    problems
  };
}

// ---------------------------------------------------------------------------
// Top errors extracted from the Logic Apps pod LOGS (runtime log content, not
// k8s events). We run `oc logs --tail=N` against the latest revision's pods,
// keep only lines that look like errors, de-duplicate them by a normalized
// signature (timestamps / GUIDs / numbers stripped), and return a static,
// frequency-ranked snapshot. The result is meant to be captured once and shown
// as a fixed list ("recent errors") rather than a live stream.
const TS_RE = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?/;

function normalizeLogSignature(line) {
  return String(line)
    .replace(new RegExp(TS_RE.source, 'g'), '<ts>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<guid>')
    .replace(/\b\d+\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

const LEVEL_ERROR = new Set(['error', 'critical', 'fatal']);
const LEVEL_WARNING = new Set(['warning', 'warn']);
// Workflow lifecycle "end" events (trigger/action/run/request end) report a
// status such as Failed/NotFound but are informational — they merely fired and
// are logged at Information level. They must NOT be treated as runtime errors.
const NON_ERROR_EVENTS = /(workflow(trigger|action|run)(start|end)|request(start|end)|httpincoming|httpoutgoing|jobdebug|batchflow)/i;

function pickField(obj, names) {
  for (const n of names) {
    if (obj[n] !== undefined && obj[n] !== null && obj[n] !== '') return obj[n];
  }
  return '';
}

// Decide whether a single log line represents a real error/warning. Structured
// JSON logs are judged by their logLevel / Level field (not by substrings);
// plain-text lines fall back to stack-trace / exception heuristics.
function extractLogError(line) {
  const trimmed = String(line).trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    let obj = null;
    try { obj = JSON.parse(trimmed); } catch (_) { obj = null; }
    if (obj && typeof obj === 'object') {
      const lvlStr = String(pickField(obj, ['logLevel', 'LogLevel', 'level'])).toLowerCase();
      let sev = LEVEL_ERROR.has(lvlStr) ? 'error' : (LEVEL_WARNING.has(lvlStr) ? 'warning' : null);
      if (!sev && typeof obj.Level === 'number') {
        // ETW severity: 0=LogAlways, 1=Critical, 2=Error, 3=Warning, 4=Info, 5=Verbose.
        if (obj.Level === 1 || obj.Level === 2) sev = 'error';
        else if (obj.Level === 3) sev = 'warning';
      }
      if (!sev) return null;
      const evName = String(pickField(obj, ['eventName', 'EventName']));
      if (NON_ERROR_EVENTS.test(evName)) return null;
      const time = String(pickField(obj, ['time', 'Time', 'timestamp', 'Timestamp', 'EventTime', 'eventTime']));
      const op = String(pickField(obj, ['operationName', 'OperationName']));
      const msg = String(pickField(obj, ['message', 'Message', 'exceptionMessage', 'Summary', 'summary']));
      const exc = String(pickField(obj, ['exception', 'Exception', 'Details', 'details']));
      const parts = [];
      if (evName && !/^error$/i.test(evName)) parts.push(evName);
      if (op) parts.push(op);
      if (msg) parts.push(msg);
      if (exc && exc !== msg) parts.push(exc);
      const text = parts.filter(Boolean).join(' | ') || trimmed;
      return { severity: sev, message: text.slice(0, 600), time };
    }
  }
  // Plain-text (non-JSON): flag ONLY when the line carries an explicit level
  // marker. Logic Apps also emits human-readable duplicates such as
  // "Workflow trigger ends ... status='Failed'" with NO level — those merely
  // echo lifecycle events and must not be treated as errors.
  // 1) ILogger short prefixes: "fail:", "crit:", "warn:", "info:", "dbug:", "trce:".
  let lm = trimmed.match(/^(fail|crit|error|critical|fatal|warn|warning|info|information|dbug|debug|trce|trace|verbose)\s*:/i);
  if (lm) {
    const lv = lm[1].toLowerCase();
    if (/^(fail|crit|error|critical|fatal)$/.test(lv)) return { severity: 'error', message: trimmed.slice(0, 600), time: (trimmed.match(TS_RE) || [])[0] || '' };
    if (/^(warn|warning)$/.test(lv)) return { severity: 'warning', message: trimmed.slice(0, 600), time: (trimmed.match(TS_RE) || [])[0] || '' };
    return null; // info / debug / trace
  }
  // 2) Bracketed level tokens: [Error] [Critical] [Fatal] [Warning] ...
  lm = trimmed.match(/\[(error|critical|fatal|warning|warn|information|informational|info|debug|trace|verbose)\]/i);
  if (lm) {
    const lv = lm[1].toLowerCase();
    if (/error|critical|fatal/.test(lv)) return { severity: 'error', message: trimmed.slice(0, 600), time: (trimmed.match(TS_RE) || [])[0] || '' };
    if (/warn/.test(lv)) return { severity: 'warning', message: trimmed.slice(0, 600), time: (trimmed.match(TS_RE) || [])[0] || '' };
    return null;
  }
  // 3) Unhandled exceptions / .NET stack traces are error-level by nature.
  if (/(unhandled exception|^\s*at\s+[\w.<>]+\s*\(|^[\w.]+(\.[\w.]+)*Exception[:\s])/i.test(trimmed)) {
    return { severity: 'error', message: trimmed.slice(0, 600), time: (trimmed.match(TS_RE) || [])[0] || '' };
  }
  // No level information -> not classified as an error.
  return null;
}

async function getPodLogErrors(options) {
  const tailReq = parseInt((options && options.tail), 10);
  const tail = Math.min(Math.max(Number.isFinite(tailReq) ? tailReq : 500, 50), 5000);
  const maxErrors = Math.min(Math.max(parseInt((options && options.max), 10) || 25, 1), 100);
  const container = CONFIG.logContainer || 'logicapps-container';
  const state = await getAppState();

  let latestRevision = null;
  let latestKey = -Infinity;
  for (const r of state.replicas) {
    const k = revisionSortKey(r.revision);
    if (k > latestKey) { latestKey = k; latestRevision = r.revision; }
  }
  const running = state.replicas.filter((r) => r.revision === latestRevision && r.phase === 'Running');
  const targets = running.length ? running : state.replicas.filter((r) => r.revision === latestRevision);

  const groups = new Map();
  const scannedPods = [];
  let linesScanned = 0;
  for (const p of targets) {
    let out = '';
    try {
      out = await runOc(['-n', CONFIG.namespace, 'logs', '--tail', String(tail), p.pod, '-c', container]);
    } catch (_) { continue; }
    scannedPods.push(p.pod);
    for (const raw of out.split(/\r?\n/)) {
      const line = raw.replace(/\r$/, '').trim();
      if (!line) continue;
      linesScanned++;
      const det = extractLogError(line);
      if (!det) continue;
      const sig = normalizeLogSignature(det.message);
      if (!sig) continue;
      const g = groups.get(sig) || { signature: sig, count: 0, severity: det.severity, sample: '', pods: new Set(), lastSeen: '' };
      g.count += 1;
      if (det.severity === 'error') g.severity = 'error';
      g.pods.add(p.pod);
      g.sample = det.message;
      const ts = det.time || (line.match(TS_RE) || [])[0] || '';
      if (ts && ts > g.lastSeen) g.lastSeen = ts;
      groups.set(sig, g);
    }
  }

  const errors = Array.from(groups.values())
    .map((g) => ({ severity: g.severity, count: g.count, sample: g.sample, pods: Array.from(g.pods), lastSeen: g.lastSeen }))
    .sort((a, b) => (b.count - a.count) || String(b.lastSeen).localeCompare(String(a.lastSeen)))
    .slice(0, maxErrors);

  return {
    revision: latestRevision,
    container,
    tail,
    podsScanned: scannedPods,
    linesScanned,
    uniqueErrors: groups.size,
    capturedAt: new Date().toISOString(),
    errors
  };
}

// Cluster-wide pod health, matching the Grafana "Cluster Pod Health" panel.
// Returns phase counts plus a small list of pods currently in an error or
// warning state (CrashLoopBackOff, image errors, OOMKilled, etc.).
const POD_HEALTH_WAIT = new Set(['CrashLoopBackOff', 'ImagePullBackOff', 'ErrImagePull', 'CreateContainerError', 'CreateContainerConfigError', 'InvalidImageName', 'RunContainerError']);
const POD_HEALTH_TERM = new Set(['Error', 'OOMKilled', 'ContainerCannotRun', 'StartError', 'DeadlineExceeded', 'Evicted', 'ContainerStatusUnknown']);

async function getPodHealth() {
  const out = await runOc(['get', 'pods', '--all-namespaces', '-o', 'json']);
  const payload = tryParseJson(out) || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  let total = 0, running = 0, pending = 0, failed = 0, succeeded = 0, crashlooping = 0;
  const problems = [];
  for (const pod of items) {
    total++;
    const phase = (pod.status && pod.status.phase) || '';
    if (phase === 'Running') running++;
    else if (phase === 'Pending') pending++;
    else if (phase === 'Failed') failed++;
    else if (phase === 'Succeeded') succeeded++;
    const ns = (pod.metadata && pod.metadata.namespace) || '';
    const name = (pod.metadata && pod.metadata.name) || '';
    const statuses = (pod.status && pod.status.containerStatuses) || [];
    let hadProblem = false;
    for (const c of statuses) {
      const w = c.state && c.state.waiting;
      const t = c.state && c.state.terminated;
      if (w && POD_HEALTH_WAIT.has(w.reason)) {
        if (w.reason === 'CrashLoopBackOff') crashlooping++;
        problems.push({ namespace: ns, pod: name, container: c.name, reason: w.reason, type: 'Warning', restarts: c.restartCount || 0 });
        hadProblem = true;
      } else if (t && POD_HEALTH_TERM.has(t.reason)) {
        problems.push({ namespace: ns, pod: name, container: c.name, reason: t.reason, type: 'Error', restarts: c.restartCount || 0 });
        hadProblem = true;
      }
    }
    if (!hadProblem && (phase === 'Failed' || phase === 'Unknown')) {
      problems.push({ namespace: ns, pod: name, container: '', reason: (pod.status && pod.status.reason) || phase, type: 'Error', restarts: 0 });
    }
  }
  problems.sort((a, b) => (a.type === b.type ? (b.restarts - a.restarts) : (a.type === 'Error' ? -1 : 1)));
  return { total, running, pending, failed, succeeded, crashlooping, problems: problems.slice(0, 8) };
}

// Cluster login status, refreshed by a background keepalive job. The token
// value from `oc whoami -t` is intentionally never stored or exposed; only a
// boolean flag is kept so the dashboard can show whether a token is available.
let clusterLoginState = {
  status: 'Unknown',
  loggedIn: false,
  user: '',
  server: '',
  hasToken: false,
  lastChecked: '',
  lastSuccess: '',
  message: 'Login not checked yet.'
};

async function refreshClusterLogin() {
  const checkedAt = new Date().toISOString();
  try {
    const user = await runOc(['whoami']);
    const server = await runOc(['whoami', '--show-server']).catch(() => '');
    let hasToken = false;
    try {
      const token = await runOc(['whoami', '-t']);
      hasToken = Boolean(token && token.trim());
    } catch { hasToken = false; }
    clusterLoginState = {
      status: 'LoggedIn',
      loggedIn: true,
      user,
      server,
      hasToken,
      lastChecked: checkedAt,
      lastSuccess: checkedAt,
      message: 'Authenticated as ' + user
    };
  } catch (error) {
    const detail = (error && (error.stderr || error.message)) ? String(error.stderr || error.message).trim() : 'oc whoami failed';
    clusterLoginState = {
      status: 'LoggedOut',
      loggedIn: false,
      user: clusterLoginState.user,
      server: clusterLoginState.server,
      hasToken: false,
      lastChecked: checkedAt,
      lastSuccess: clusterLoginState.lastSuccess,
      message: detail
    };
  }
  return clusterLoginState;
}

const loginRefreshMs = Math.max(30, Number(CONFIG.loginRefreshSeconds) || 240) * 1000;
refreshClusterLogin().catch(() => {});
setInterval(() => { refreshClusterLogin().catch(() => {}); }, loginRefreshMs);

// Prometheus datasource token keepalive. `oc create token` mints short-lived
// (e.g. 24h) tokens, so Grafana's Prometheus datasource would otherwise stop
// authenticating (502/401) once it expires. This background job periodically
// mints a fresh token and pushes it into Grafana via the API, and also rewrites
// the provisioning file so the token survives a container restart.
let prometheusTokenState = {
  status: 'Unknown',
  lastChecked: '',
  lastSuccess: '',
  message: 'Token not refreshed yet.'
};

function grafanaRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    let base;
    try { base = new URL(CONFIG.grafanaUrl); } catch (e) { reject(e); return; }
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const auth = Buffer.from(CONFIG.grafanaUser + ':' + CONFIG.grafanaPassword).toString('base64');
    const req = http.request({
      hostname: base.hostname,
      port: base.port || 80,
      path,
      method,
      headers: Object.assign({
        'Authorization': 'Basic ' + auth,
        'Accept': 'application/json'
      }, payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {})
    }, (resp) => {
      let data = '';
      resp.on('data', (c) => { data += c; });
      resp.on('end', () => {
        if (resp.statusCode >= 200 && resp.statusCode < 300) { resolve(tryParseJson(data) || {}); }
        else { reject(new Error('Grafana API ' + method + ' ' + path + ' -> ' + resp.statusCode + ' ' + data)); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function writeDatasourceToken(token) {
  const file = CONFIG.datasourcesFilePath;
  if (!file || !fs.existsSync(file)) return;
  const raw = fs.readFileSync(file, 'utf8');
  const next = raw.replace(/httpHeaderValue1:\s*'[^']*'?/, "httpHeaderValue1: 'Bearer " + token + "'");
  if (next !== raw) fs.writeFileSync(file, next);
}

async function refreshPrometheusToken() {
  const checkedAt = new Date().toISOString();
  try {
    const dur = (Number(CONFIG.prometheusTokenDurationHours) || 24) + 'h';
    const token = (await runOc(['create', 'token', CONFIG.prometheusTokenServiceAccount, '-n', CONFIG.prometheusTokenNamespace, '--duration', dur])).trim();
    if (!token) throw new Error('empty token from oc create token');
    const ds = await grafanaRequest('GET', '/api/datasources/name/' + encodeURIComponent(CONFIG.prometheusDatasourceName));
    if (!ds || !ds.uid) throw new Error('datasource ' + CONFIG.prometheusDatasourceName + ' not found');
    ds.secureJsonData = Object.assign({}, ds.secureJsonData, { httpHeaderValue1: 'Bearer ' + token });
    await grafanaRequest('PUT', '/api/datasources/uid/' + ds.uid, ds);
    try { writeDatasourceToken(token); } catch (e) { /* provisioning file is best-effort */ }
    prometheusTokenState = { status: 'OK', lastChecked: checkedAt, lastSuccess: checkedAt, message: 'Prometheus token refreshed (' + dur + ').' };
  } catch (error) {
    const detail = (error && (error.stderr || error.message)) ? String(error.stderr || error.message).trim() : 'token refresh failed';
    prometheusTokenState = { status: 'Error', lastChecked: checkedAt, lastSuccess: prometheusTokenState.lastSuccess, message: detail };
  }
  return prometheusTokenState;
}

const promTokenRefreshMs = Math.max(300, Number(CONFIG.prometheusTokenRefreshSeconds) || 39600) * 1000;
setTimeout(() => { refreshPrometheusToken().catch(() => {}); }, 8000);
setInterval(() => { refreshPrometheusToken().catch(() => {}); }, promTokenRefreshMs);

// Live log streaming from the Logic Apps pods via Server-Sent Events (SSE).
// Each connection spawns `oc logs -f` for a pod/container and forwards output.
function sseWrite(res, event, data) {
  if (event) res.write('event: ' + event + '\n');
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  for (const line of String(payload).split(/\r?\n/)) {
    res.write('data: ' + line + '\n');
  }
  res.write('\n');
}

async function resolveLogTarget(url) {
  let pod = (url.searchParams.get('pod') || '').trim();
  let container = (url.searchParams.get('container') || '').trim();
  if (!pod) {
    const state = await getAppState();
    const running = state.replicas.find((r) => r.phase === 'Running') || state.replicas[0];
    if (!running) throw new Error('No pods found for app ' + CONFIG.appName + ' in namespace ' + CONFIG.namespace + '.');
    pod = running.pod;
  }
  if (!container) container = CONFIG.logContainer || 'logicapps-container';
  return { pod, container };
}

async function streamPodLogs(req, res, url) {
  let target;
  try {
    target = await resolveLogTarget(url);
  } catch (error) {
    sendJson(res, 400, { error: error.message || String(error) });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  sseWrite(res, 'status', { message: 'Streaming logs from ' + target.pod + ' (' + target.container + ')', pod: target.pod, container: target.container });

  const tailRaw = parseInt(url.searchParams.get('tail'), 10);
  const tail = Number.isFinite(tailRaw) && tailRaw >= 0 ? String(tailRaw) : '200';

  const env = { ...process.env };
  if (CONFIG.kubeconfigPath) env.KUBECONFIG = CONFIG.kubeconfigPath;
  const args = [];
  if (CONFIG.kubeContext) args.push('--context', CONFIG.kubeContext);
  args.push('-n', CONFIG.namespace, 'logs', '-f', '--tail', tail, target.pod, '-c', target.container);

  let child;
  try {
    child = spawn(CONFIG.ocPath, args, { env });
  } catch (error) {
    sseWrite(res, 'error', { message: error.message || String(error) });
    try { res.end(); } catch {}
    return;
  }

  let buffer = '';
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).replace(/\r$/, '');
      buffer = buffer.slice(idx + 1);
      sseWrite(res, 'log', line);
    }
  });
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString().trim();
    if (text) sseWrite(res, 'log', text);
  });
  child.on('error', (err) => { sseWrite(res, 'error', { message: err.message || String(err) }); try { res.end(); } catch {} });
  child.on('close', (code) => { if (buffer.trim()) sseWrite(res, 'log', buffer.replace(/\r$/, '')); sseWrite(res, 'end', { code }); try { res.end(); } catch {} });

  const heartbeat = setInterval(() => { try { res.write(': keepalive\n\n'); } catch {} }, 15000);
  const cleanup = () => { clearInterval(heartbeat); try { child.kill('SIGTERM'); } catch {} };
  req.on('close', cleanup);
  req.on('aborted', cleanup);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    if (path === '/api/app' && req.method === 'GET') {
      sendJson(res, 200, await getAppState());
      return;
    }

    if (path === '/api/pod-health' && req.method === 'GET') {
      sendJson(res, 200, await getPodHealth());
      return;
    }

    if (path === '/api/log-errors' && req.method === 'GET') {
      sendJson(res, 200, await getPodLogErrors({ tail: url.searchParams.get('tail'), max: url.searchParams.get('max') }));
      return;
    }

    if (path === '/api/cluster-login' && req.method === 'GET') {
      sendJson(res, 200, clusterLoginState);
      return;
    }

    if (path === '/api/cluster-login/refresh' && req.method === 'POST') {
      sendJson(res, 200, await refreshClusterLogin());
      return;
    }

    if (path === '/api/logs/stream' && req.method === 'GET') {
      await streamPodLogs(req, res, url);
      return;
    }

    if (path === '/api/app/restart' && req.method === 'POST') {
      const state = await getAppState();
      const deleted = [];
      for (const replica of state.replicas) {
        await runOc(['-n', CONFIG.namespace, 'delete', 'pod', replica.pod]);
        deleted.push(replica.pod);
      }
      sendJson(res, 200, { message: `Restarted app by deleting ${deleted.length} pod(s).`, deletedPods: deleted });
      return;
    }

    if (path.match(/^\/api\/revisions\/([^/]+)\/restart$/) && req.method === 'POST') {
      const revision = decodeURIComponent(path.match(/^\/api\/revisions\/([^/]+)\/restart$/)[1]);
      const state = await getAppState();
      const target = state.revisions.find((r) => r.revision === revision);
      if (!target) {
        sendJson(res, 404, { error: `Revision '${revision}' not found.` });
        return;
      }
      const deleted = [];
      for (const pod of target.pods) {
        await runOc(['-n', CONFIG.namespace, 'delete', 'pod', pod]);
        deleted.push(pod);
      }
      sendJson(res, 200, { message: `Restarted revision '${revision}' by deleting ${deleted.length} pod(s).`, revision, deletedPods: deleted });
      return;
    }

    if (path.match(/^\/api\/pods\/([^/]+)\/restart$/) && req.method === 'POST') {
      const pod = decodeURIComponent(path.match(/^\/api\/pods\/([^/]+)\/restart$/)[1]);
      await runOc(['-n', CONFIG.namespace, 'delete', 'pod', pod]);
      sendJson(res, 200, { message: `Restarted replica '${pod}'.`, pod });
      return;
    }

    if (path === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Logic App Manager</title>
  <style>
    *{box-sizing:border-box}
    :root{--bg:#f4f5f5;--card:#fff;--border:#dfe2e5;--text:#1f1f1f;--muted:#6e6e78;--btn:#3871dc;--danger:#e02f44;--success:#1a7f4b;--accent:#6f42c1;--surface:#fafafa}
    body.dark{--bg:transparent;--card:#1f2028;--border:#30323d;--text:#d8d9e3;--muted:#a7a9b7;--surface:#111218}
    body{margin:0;padding:12px;font:13px/1.45 Inter,Arial,sans-serif;background:var(--bg);color:var(--text)}
    h1{margin:0 0 12px;font-size:16px}.card{background:var(--card);border:1px solid var(--border);border-radius:4px;padding:12px;margin-bottom:10px}
    .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    button{border:none;border-radius:4px;color:#fff;padding:6px 10px;cursor:pointer;font:inherit}
    .primary{background:var(--btn)}.danger{background:var(--danger)}.success{background:var(--success)}.accent{background:var(--accent)}
    table{width:100%;border-collapse:collapse;margin-top:10px} th,td{padding:6px 8px;border-bottom:1px solid var(--border);text-align:left} th{color:var(--muted);font-weight:600}
    .muted{color:var(--muted)} .pill{display:inline-block;padding:2px 6px;border-radius:999px;background:var(--surface);border:1px solid var(--border)}
    #maxHint{display:none;margin:2px 0 8px;font-size:12px}
    body.compact h1{font-size:14px;margin:0 0 6px}
    body.compact .detail{display:none !important}
    body.compact #app,body.compact #revisions,body.compact #replicas{display:none !important}
    body.compact #maxHint{display:block}
    #podHealth,#appPods{font-size:14px}
    #podHealth strong,#appPods strong{font-size:15px}
    #podHealth .pill,#appPods .pill{font-size:13px;padding:3px 8px}
    #podHealth table,#appPods table{font-size:13.5px}
    #podHealth th,#podHealth td,#appPods th,#appPods td{padding:5px 8px}
  </style>
</head>
<body>
  <script>(function(){try{const p=window.parent&&window.parent.document&&window.parent.document.body;if(p&&(p.classList.contains('theme-dark')||p.getAttribute('data-theme')==='dark'))document.body.classList.add('dark')}catch{} if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)document.body.classList.add('dark');})();</script>
  <h1>Logic App Manager</h1>
  <div id="maxHint" class="muted">Compact view - press <strong>v</strong> or maximize this panel for Live Stream, config &amp; actions.</div>
  <div class="card">
    <div class="row">
      <button class="primary" onclick="refresh()">Refresh</button>
      <button class="danger" onclick="restartApp()">App Restart</button>
    </div>
    <div id="summary" class="muted" style="margin-top:8px;"></div>
    <div id="appPods" style="margin-top:10px;"></div>
    <div id="podHealth" style="margin-top:10px;"></div>
  </div>
  <div id="revisions"></div>
  <div id="replicas"></div>
  <div class="card">
    <div class="row" style="justify-content:space-between;align-items:center;">
      <h3 style="margin:0;">Top Errors from Pod Logs</h3>
      <div class="row">
        <input id="logErrTail" type="number" min="50" max="5000" value="500" title="Lines of log history to scan per pod" style="width:90px;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:4px;padding:6px;" />
        <button class="primary" onclick="loadLogErrors()">Scan Recent Logs</button>
      </div>
    </div>
    <div id="logErrorsMeta" class="muted" style="margin-top:6px;">Scanning recent pod logs...</div>
    <div id="logErrors" style="margin-top:8px;"></div>
  </div>
  <div class="card">
    <div class="row" style="justify-content:space-between;">
      <h3 style="margin:0;">Cluster Login</h3>
      <button class="primary" onclick="recheckClusterLogin()">Re-check Login</button>
    </div>
    <div id="clusterLogin" class="muted" style="margin-top:8px;">Loading...</div>
  </div>
  <div class="card detail">
    <div class="row" style="justify-content:space-between;">
      <h3 style="margin:0;">Live Stream (Logic Apps Pods)</h3>
      <div class="row">
        <select id="logPod" style="min-width:240px;"></select>
        <input id="logTail" type="number" min="0" value="200" title="Lines of history" style="width:80px;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:4px;padding:6px;" />
        <button class="success" onclick="startLogStream()">Start</button>
        <button class="danger" onclick="stopLogStream()">Stop</button>
        <button class="accent" onclick="clearLogs()">Clear</button>
      </div>
    </div>
    <div id="logStatus" class="muted" style="margin-top:6px;">Idle. Select a pod and press Start.</div>
    <pre id="logConsole" style="margin-top:8px;max-height:340px;overflow:auto;background:#000;color:#f1f1f1;border:1px solid var(--border);border-radius:4px;padding:8px;white-space:pre-wrap;word-break:break-all;font:12px/1.45 Consolas,Menlo,monospace;"></pre>
  </div>
  <div id="app"></div>
  <script>
    const summaryEl = document.getElementById('summary');
    const appEl = document.getElementById('app');
    const clusterLoginEl = document.getElementById('clusterLogin');
    const logPodEl = document.getElementById('logPod');
    const logTailEl = document.getElementById('logTail');
    const logConsoleEl = document.getElementById('logConsole');
    const logStatusEl = document.getElementById('logStatus');
    let logSource = null;
    function populateLogPods(replicas){
      const current = logPodEl.value;
      logPodEl.innerHTML = '';
      const auto = document.createElement('option');
      auto.value = ''; auto.textContent = '(auto: first running pod)';
      logPodEl.appendChild(auto);
      (replicas || []).forEach(r => {
        const o = document.createElement('option');
        o.value = r.pod; o.textContent = r.pod + ' [' + r.phase + ']';
        logPodEl.appendChild(o);
      });
      if (current) logPodEl.value = current;
    }
    async function loadLogPods(){
      try {
        const data = await api('/api/app');
        populateLogPods(data.replicas);
        if (!data.replicas || !data.replicas.length) {
          logStatusEl.textContent = 'No pods found for app "' + (data.appName || '') + '" in namespace "' + (data.namespace || '') + '".';
        } else if (/^(Idle|No pods|Pod list)/.test(logStatusEl.textContent)) {
          logStatusEl.textContent = data.replicas.length + ' pod(s) available. Select one and press Start.';
        }
      } catch (err) {
        logStatusEl.textContent = 'Could not load pod list: ' + err.message;
      }
    }
    function appendLog(line){
      const atBottom = logConsoleEl.scrollHeight - logConsoleEl.scrollTop - logConsoleEl.clientHeight < 40;
      logConsoleEl.textContent += line + '\\n';
      if (atBottom) logConsoleEl.scrollTop = logConsoleEl.scrollHeight;
    }
    function clearLogs(){ logConsoleEl.textContent = ''; }
    function stopLogStream(){ if (logSource){ logSource.close(); logSource = null; logStatusEl.textContent = 'Stopped.'; } }
    function startLogStream(){
      stopLogStream();
      const pod = logPodEl.value;
      const tail = logTailEl.value || '200';
      const params = new URLSearchParams();
      if (pod) params.set('pod', pod);
      params.set('tail', tail);
      logStatusEl.textContent = 'Connecting...';
      const es = new EventSource('/api/logs/stream?' + params.toString());
      logSource = es;
      es.addEventListener('status', e => { try { logStatusEl.textContent = JSON.parse(e.data).message || 'Streaming...'; } catch { logStatusEl.textContent = 'Streaming...'; } });
      es.addEventListener('log', e => appendLog(e.data));
      es.addEventListener('error', e => { let m = 'stream error'; try { m = JSON.parse(e.data).message || m; } catch {} appendLog('[error] ' + m); });
      es.addEventListener('end', e => { let c = ''; try { c = JSON.parse(e.data).code; } catch {} logStatusEl.textContent = 'Stream ended (exit ' + c + '). Press Start to reconnect.'; stopLogStream(); });
      es.onerror = () => { if (logSource) logStatusEl.textContent = 'Connection interrupted, retrying...'; };
    }
    const revisionsEl = document.getElementById('revisions');
    const replicasEl = document.getElementById('replicas');
    async function api(path, options){ const response = await fetch(path, options); const data = await response.json().catch(()=>({})); if(!response.ok) throw new Error(data.error || data.message || ('Request failed (' + response.status + ')')); return data; }
    function renderApp(data){
      summaryEl.textContent = 'Namespace: ' + data.namespace + ' | App: ' + data.appName + ' | Image: ' + (data.image || '-');
      let appHtml = '<div class="card"><h3 style="margin-top:0;">App Configuration</h3><div><span class="pill">Image: ' + (data.image || '-') + '</span></div><div class="muted" style="margin-top:6px;">Command: ' + (data.command || '-') + '</div><div class="muted">Args: ' + (data.args || '-') + '</div><div style="margin-top:10px;"><strong>Environment Settings</strong><table><tr><th>Name</th><th>Value / Source</th><th>Type</th></tr>';
      (data.env || []).forEach(e => { appHtml += '<tr><td>' + e.name + '</td><td>' + (e.value || '-') + '</td><td>' + e.source + '</td></tr>'; });
      appHtml += '</table></div></div>';
      appEl.innerHTML = appHtml;
      let revHtml = '<div class="card"><h3 style="margin-top:0;">Revisions / Replicas / Health</h3><table><tr><th>Revision</th><th>Replicas</th><th>Ready</th><th>Health</th><th>Restarts</th><th>Pods</th><th>Action</th></tr>';
      (data.revisions || []).forEach(r => { revHtml += '<tr><td>' + r.revision + '</td><td>' + r.replicas + '</td><td>' + r.readyReplicas + '</td><td>' + r.health + '</td><td>' + r.restartCount + '</td><td>' + (r.pods || []).join('<br/>') + '</td><td><button class="danger" onclick="restartRevision(\\'' + r.revision + '\\')">Restart Revision</button></td></tr>'; });
      revisionsEl.innerHTML = revHtml + '</table></div>';
      let repHtml = '<div class="card"><h3 style="margin-top:0;">Replicas</h3><table><tr><th>Pod</th><th>Revision</th><th>Phase</th><th>Ready</th><th>Restarts</th><th>Node</th><th>Action</th></tr>';
      (data.replicas || []).forEach(r => { repHtml += '<tr><td>' + r.pod + '</td><td>' + r.revision + '</td><td>' + r.phase + '</td><td>' + (r.ready ? 'Yes' : 'No') + '</td><td>' + r.restarts + '</td><td>' + (r.node || '-') + '</td><td><button class="danger" onclick="restartReplica(\\'' + r.pod + '\\')">Restart Replica</button></td></tr>'; });
      replicasEl.innerHTML = repHtml + '</table></div>';
      populateLogPods(data.replicas);
      renderAppPods(data);
    }
    function renderClusterLogin(data){
      const ok = !!data.loggedIn;
      const color = ok ? 'var(--success)' : 'var(--danger)';
      const dot = '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + color + ';margin-right:6px;vertical-align:middle;"></span>';
      let html = dot + '<strong style="color:' + color + ';">' + (ok ? 'Logged In' : 'Logged Out') + '</strong>';
      if (data.status) html += ' <span class="pill">Status: ' + data.status + '</span>';
      if (data.user) html += ' &nbsp;<span class="pill">User: ' + data.user + '</span>';
      if (data.server) html += ' <span class="pill">Server: ' + data.server + '</span>';
      html += ' <span class="pill">Token: ' + (data.hasToken ? 'present' : 'none') + '</span>';
      const meta = [];
      if (data.lastChecked) meta.push('Last checked: ' + data.lastChecked);
      if (data.message) meta.push(data.message);
      if (meta.length) html += '<div class="muted" style="margin-top:6px;">' + meta.join(' - ') + '</div>';
      clusterLoginEl.innerHTML = html;
    }
    async function loadClusterLogin(){ try { renderClusterLogin(await api('/api/cluster-login')); } catch(err){ clusterLoginEl.textContent = err.message; } }
    async function recheckClusterLogin(){ clusterLoginEl.textContent = 'Re-checking login...'; try { renderClusterLogin(await api('/api/cluster-login/refresh', { method:'POST' })); } catch(err){ clusterLoginEl.textContent = err.message; } }
    async function refresh(){ summaryEl.textContent = 'Loading...'; const data = await api('/api/app'); renderApp(data); }
    async function restartApp(){ if(!confirm('Restart the entire app?')) return; await api('/api/app/restart', { method:'POST' }); await refresh(); }
    async function restartRevision(revision){ if(!confirm('Restart revision ' + revision + '?')) return; await api('/api/revisions/' + encodeURIComponent(revision) + '/restart', { method:'POST' }); await refresh(); }
    async function restartReplica(pod){ if(!confirm('Restart replica ' + pod + '?')) return; await api('/api/pods/' + encodeURIComponent(pod) + '/restart', { method:'POST' }); await refresh(); }
    refresh().catch(err => { summaryEl.textContent = err.message; });
    const podHealthEl = document.getElementById('podHealth');
    const appPodsEl = document.getElementById('appPods');
    function renderAppPods(data){
      if(!data){ appPodsEl.textContent = ''; return; }
      var pods = data.replicas || [];
      var ready = pods.filter(function(p){ return p.ready; }).length;
      var restarts = pods.reduce(function(a,p){ return a + (Number(p.restarts)||0); }, 0);
      var allReady = pods.length > 0 && ready === pods.length;
      var icon = allReady ? 'OK' : (pods.length ? 'X' : '-');
      var iconColor = allReady ? 'var(--success)' : 'var(--danger)';
      var html = '<div style="margin-bottom:6px;"><strong>App Pods</strong> '
        + '<span style="color:' + iconColor + ';font-weight:600;">' + icon + '</span> '
        + '<span class="muted">(' + data.appName + ')</span></div>';
      html += '<span class="pill" style="margin-right:6px;">Pods: ' + pods.length + '</span>';
      html += '<span class="pill" style="margin-right:6px;' + (allReady ? '' : 'color:var(--danger);border-color:var(--danger);') + '">Ready: ' + ready + '/' + pods.length + '</span>';
      html += '<span class="pill" style="margin-right:6px;' + (restarts > 0 ? 'color:var(--danger);border-color:var(--danger);' : '') + '">Restarts: ' + restarts + '</span>';
      if(pods.length){
        html += '<table style="margin-top:8px;"><tr><th>Status</th><th>Pod</th><th>Phase</th><th>Restarts</th></tr>';
        pods.forEach(function(p){
          var ok = !!p.ready && String(p.phase).toLowerCase() === 'running';
          var st = ok ? '<span style="color:var(--success);font-weight:600;">OK</span>' : '<span style="color:var(--danger);font-weight:600;">X</span>';
          html += '<tr><td style="text-align:center;">' + st + '</td><td>' + p.pod + '</td><td>' + p.phase + '</td><td>' + p.restarts + '</td></tr>';
        });
        html += '</table>';
      }
      appPodsEl.innerHTML = html;
    }
    function healthChip(label, val, bad){ return '<span class="pill" style="margin-right:6px;' + (bad && val > 0 ? 'color:var(--danger);border-color:var(--danger);font-weight:600;' : '') + '">' + label + ': ' + val + '</span>'; }
    function renderPodHealth(d){
      if(!d){ podHealthEl.textContent = ''; return; }
      var html = '<div style="margin-bottom:6px;"><strong>Cluster Pod Health</strong> <span class="muted">(all namespaces)</span></div>';
      html += healthChip('Total', d.total, false) + healthChip('Running', d.running, false) + healthChip('Pending', d.pending, true) + healthChip('Failed', d.failed, true) + healthChip('CrashLoop', d.crashlooping, true);
      if(d.problems && d.problems.length){
        html += '<table style="margin-top:8px;"><tr><th>Type</th><th>Namespace</th><th>Pod / Container</th><th>Reason</th><th>Restarts</th></tr>';
        d.problems.forEach(function(p){
          var color = p.type === 'Error' ? 'var(--danger)' : 'var(--accent)';
          var podcol = p.pod + (p.container ? (' / ' + p.container) : '');
          html += '<tr><td style="color:' + color + ';font-weight:600;">' + p.type + '</td><td>' + p.namespace + '</td><td>' + podcol + '</td><td>' + p.reason + '</td><td>' + p.restarts + '</td></tr>';
        });
        html += '</table>';
      } else {
        html += '<div class="muted" style="margin-top:6px;">No pod errors or warnings.</div>';
      }
      podHealthEl.innerHTML = html;
    }
    async function loadPodHealth(){ try { renderPodHealth(await api('/api/pod-health')); } catch(err){ podHealthEl.textContent = 'Pod health: ' + err.message; } }
    const logErrorsEl = document.getElementById('logErrors');
    const logErrorsMetaEl = document.getElementById('logErrorsMeta');
    const logErrTailEl = document.getElementById('logErrTail');
    function escapeHtml(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function renderLogErrors(d){
      if(!d){ logErrorsEl.textContent = ''; logErrorsMetaEl.textContent = ''; return; }
      var errs = d.errors || [];
      var when = d.capturedAt ? new Date(d.capturedAt).toLocaleString() : '';
      logErrorsMetaEl.innerHTML = 'Revision <strong>' + escapeHtml(d.revision || '-') + '</strong> &nbsp;|&nbsp; '
        + (d.podsScanned || []).length + ' pod(s), ' + (d.linesScanned || 0) + ' lines scanned, tail=' + (d.tail || 0)
        + ' &nbsp;|&nbsp; ' + errs.length + ' distinct error group(s)'
        + (when ? (' &nbsp;|&nbsp; captured ' + escapeHtml(when)) : '');
      if(!errs.length){
        logErrorsEl.innerHTML = '<div class="pill" style="color:var(--success);border-color:var(--success);font-weight:600;">No errors found in recent logs.</div>';
        return;
      }
      var html = '<table style="table-layout:fixed;width:100%;"><tr>'
        + '<th style="width:70px;">Severity</th><th style="width:56px;">Count</th><th>Recent error line</th><th style="width:150px;">Last seen</th></tr>';
      errs.forEach(function(e){
        var color = e.severity === 'error' ? 'var(--danger)' : 'var(--accent)';
        var tag = e.severity === 'error' ? 'Error' : 'Warn';
        html += '<tr>'
          + '<td style="color:' + color + ';font-weight:600;white-space:nowrap;">' + tag + '</td>'
          + '<td style="text-align:center;font-weight:600;">' + e.count + '</td>'
          + '<td style="font-family:Consolas,Menlo,monospace;font-size:12px;white-space:pre-wrap;word-break:break-all;">' + escapeHtml(e.sample) + '</td>'
          + '<td class="muted" style="font-size:12px;white-space:nowrap;">' + escapeHtml(e.lastSeen || '-') + '</td>'
          + '</tr>';
      });
      logErrorsEl.innerHTML = html + '</table>';
    }
    async function loadLogErrors(){
      logErrorsMetaEl.textContent = 'Scanning recent pod logs...';
      var tail = (logErrTailEl && logErrTailEl.value) || '500';
      try { renderLogErrors(await api('/api/log-errors?tail=' + encodeURIComponent(tail))); }
      catch(err){ logErrorsMetaEl.textContent = 'Could not scan logs: ' + err.message; logErrorsEl.textContent = ''; }
    }
    loadPodHealth();
    setInterval(loadPodHealth, 30000);
    loadLogErrors();
    loadLogPods();
    setInterval(loadLogPods, 30000);
    loadClusterLogin();
    setInterval(loadClusterLogin, 30000);
    function applyCompact(){ document.body.classList.toggle('compact', window.innerHeight < 380); }
    applyCompact();
    window.addEventListener('resize', applyCompact);
  </script>
</body>
</html>`);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    if (!res.headersSent) {
      sendJson(res, 500, { error: error.message || String(error) });
    } else {
      try { res.end(); } catch {}
    }
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Logic App Manager listening on http://localhost:${PORT}`);
});















'@.Replace('__CONFIG_JSON__', $configJson)
}

function Write-PortalFiles {
    param([object[]]$Dashboards)

    Write-Step 'Generating Grafana portal files'
    Ensure-PortalDirectories
    Set-Content -LiteralPath $ComposeFile -Value (Get-ComposeYaml) -Encoding UTF8
    Set-Content -LiteralPath $DatasourceFile -Value (Get-DatasourceYaml) -Encoding UTF8
    # Dashboards are published via the Grafana API (as DB-managed native-tab dashboards)
    # after Grafana is healthy, so file-based provisioning is intentionally disabled here.
    Remove-Item -LiteralPath $DashboardProvisioningFile -Force -ErrorAction SilentlyContinue
    Remove-Item -Path (Join-Path $DashboardRoot '*.json') -Force -ErrorAction SilentlyContinue

    if (-not $Dashboards -or $Dashboards.Count -eq 0) {
        throw 'No dashboard definitions were generated.'
    }

    foreach ($dashboard in $Dashboards) {
        $fileName = [string]$dashboard.FileName
        if ([string]::IsNullOrWhiteSpace($fileName)) {
            continue
        }
        $filePath = Join-Path $DashboardRoot $fileName
        Set-Content -LiteralPath $filePath -Value ($dashboard.Object | ConvertTo-Json -Depth 100) -Encoding UTF8
    }

    Set-Content -LiteralPath $RunManagerFile -Value (Get-RunManagerScript) -Encoding UTF8
    Set-Content -LiteralPath $WorkflowManagerFile -Value "require('./run-manager.js');`r`n" -Encoding UTF8
    Set-Content -LiteralPath $AppManagerFile -Value (Get-AppManagerScript) -Encoding UTF8
}

function Wait-GrafanaHealthy {
    param([int]$TimeoutSeconds = 120)

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $health = Invoke-RestMethod -Uri "http://localhost:$GrafanaPort/api/health" -TimeoutSec 5 -ErrorAction Stop
            if ($health.database -eq 'ok') {
                return
            }
        }
        catch {
            Start-Sleep -Seconds 2
        }
    }

    throw 'Grafana did not become healthy before the timeout elapsed.'
}

function Invoke-GrafanaApi {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body
    )
    $auth = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${GrafanaAdminUser}:${GrafanaAdminPassword}"))
    $params = @{
        Method  = $Method
        Uri     = "http://localhost:$GrafanaPort$Path"
        Headers = @{ Authorization = $auth }
        TimeoutSec = 30
    }
    if ($null -ne $Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 100 -Compress)
        $params.ContentType = 'application/json'
    }
    Invoke-RestMethod @params
}

# Publish each generated (classic, accordion-row) dashboard as a DB-managed dashboard, then
# upgrade it to Grafana's native TabsLayout via the dashboard.grafana.app apiserver. The
# generator already groups panels into exactly the four target rows, so each row maps 1:1
# to a tab. The first dashboard is set as the org home dashboard.
function Publish-TabbedDashboards {
    param([object[]]$Dashboards)

    Write-Step 'Publishing dashboards with native tabs'
    $homeUid = $null
    foreach ($def in $Dashboards) {
        $uid = [string]$def.Uid
        try {
            $null = Invoke-GrafanaApi -Method 'POST' -Path '/api/dashboards/db' -Body @{ dashboard = $def.Object; overwrite = $true; folderUid = '' }
        }
        catch {
            Write-Warning "Failed to import dashboard '$uid': $($_.Exception.Message)"
            continue
        }

        $v2Path = "/apis/dashboard.grafana.app/v2beta1/namespaces/default/dashboards/$uid"
        $v2 = $null
        for ($i = 0; $i -lt 12; $i++) {
            try { $v2 = Invoke-GrafanaApi -Method 'GET' -Path $v2Path; if ($v2 -and $v2.spec) { break } }
            catch { Start-Sleep -Milliseconds 500 }
        }
        if (-not $v2 -or -not $v2.spec) {
            Write-Warning "Could not read dashboard '$uid' as v2; left as classic rows."
            if (-not $homeUid) { $homeUid = $uid }
            continue
        }

        if ($v2.spec.layout.kind -eq 'RowsLayout') {
            $tabs = @()
            foreach ($row in $v2.spec.layout.spec.rows) {
                $tabs += [ordered]@{ kind = 'TabsLayoutTab'; spec = [ordered]@{ title = $row.spec.title; layout = $row.spec.layout } }
            }
            $v2.spec.layout = [ordered]@{ kind = 'TabsLayout'; spec = [ordered]@{ tabs = $tabs } }
            try {
                $null = Invoke-GrafanaApi -Method 'PUT' -Path $v2Path -Body $v2
                Write-Info "Dashboard '$uid' converted to $($tabs.Count) native tabs."
            }
            catch {
                Write-Warning "Failed to convert dashboard '$uid' to tabs: $($_.Exception.Message)"
            }
        }
        else {
            Write-Info "Dashboard '$uid' already uses layout '$($v2.spec.layout.kind)'."
        }

        if (-not $homeUid) { $homeUid = $uid }
    }

    if ($homeUid) {
        try {
            $null = Invoke-GrafanaApi -Method 'PUT' -Path '/api/org/preferences' -Body @{ homeDashboardUID = $homeUid }
            Write-Info "Home dashboard set to '$homeUid'."
        }
        catch {
            Write-Warning "Could not set home dashboard: $($_.Exception.Message)"
        }
    }
}

Write-Step 'Resolving parameters'
$openShiftUsernameWasExplicit = $PSBoundParameters.ContainsKey('OpenShiftUsername')
$SqlServer = if (-not [string]::IsNullOrWhiteSpace($SqlServer)) { $SqlServer } else { Get-FirstEnvironmentValue @('SQL_SERVER', 'LOGICAPPS_SQL_SERVER') }
$SqlDatabase = if (-not [string]::IsNullOrWhiteSpace($SqlDatabase)) { $SqlDatabase } else { Get-FirstEnvironmentValue @('SQL_DATABASE', 'LOGICAPPS_SQL_DATABASE') }
$SqlUser = if (-not [string]::IsNullOrWhiteSpace($SqlUser)) { $SqlUser } else { Get-FirstEnvironmentValue @('SQL_USER', 'LOGICAPPS_SQL_USER') }
$SqlPassword = if (-not [string]::IsNullOrWhiteSpace($SqlPassword)) { $SqlPassword } else { Get-FirstEnvironmentValue @('SQL_PASSWORD', 'LOGICAPPS_SQL_PASSWORD') }
$MasterKey = if (-not [string]::IsNullOrWhiteSpace($MasterKey)) { $MasterKey } else { Get-FirstEnvironmentValue @('LOGICAPPS_MASTER_KEY', 'MASTER_KEY') }
$MasterKey = if (-not [string]::IsNullOrWhiteSpace($MasterKey)) { $MasterKey } else { Try-ResolveMasterKeyFromHostSecrets }
$LogicAppBaseUrl = if (-not [string]::IsNullOrWhiteSpace($LogicAppBaseUrl)) { $LogicAppBaseUrl } else { Get-FirstEnvironmentValue @('LOGICAPPS_BASE_URL', 'LOGIC_APP_BASE_URL') }
$PrometheusUrl = if (-not [string]::IsNullOrWhiteSpace($PrometheusUrl)) { $PrometheusUrl } else { Get-FirstEnvironmentValue @('PROMETHEUS_URL') }
$PrometheusToken = if (-not [string]::IsNullOrWhiteSpace($PrometheusToken)) { $PrometheusToken } else { Get-FirstEnvironmentValue @('PROMETHEUS_TOKEN') }
$Namespace = if (-not [string]::IsNullOrWhiteSpace($Namespace)) { $Namespace } else { Get-FirstEnvironmentValue @('LOGICAPPS_NAMESPACE', 'NAMESPACE') }
$AppName = if (-not [string]::IsNullOrWhiteSpace($AppName)) { $AppName } else { Get-FirstEnvironmentValue @('LOGICAPPS_APP_NAME', 'APP_NAME') }
$ResourceGroup = if (-not [string]::IsNullOrWhiteSpace($ResourceGroup)) { $ResourceGroup } else { Get-FirstEnvironmentValue @('LOGICAPPS_RESOURCE_GROUP', 'RESOURCE_GROUP') }
$KubeConfigPath = if (-not [string]::IsNullOrWhiteSpace($KubeConfigPath)) { $KubeConfigPath } else { Get-FirstEnvironmentValue @('KUBECONFIG', 'KUBE_CONFIG_PATH') }
$KubeContext = if (-not [string]::IsNullOrWhiteSpace($KubeContext)) { $KubeContext } else { Get-FirstEnvironmentValue @('KUBE_CONTEXT', 'KUBECONTEXT') }
$OpenShiftUsername = if ($openShiftUsernameWasExplicit) { $OpenShiftUsername } else { (Get-FirstEnvironmentValue @('OPENSHIFT_USERNAME', 'KUBE_USERNAME', 'OC_USERNAME')) }
$OpenShiftUsername = if (-not [string]::IsNullOrWhiteSpace($OpenShiftUsername)) { $OpenShiftUsername } else { 'kubeadmin' }
$OpenShiftPassword = if (-not [string]::IsNullOrWhiteSpace($OpenShiftPassword)) { $OpenShiftPassword } else { Get-FirstEnvironmentValue @('OPENSHIFT_PASSWORD') }
$OpenShiftToken = if (-not [string]::IsNullOrWhiteSpace($OpenShiftToken)) { $OpenShiftToken } else { Get-FirstEnvironmentValue @('OPENSHIFT_TOKEN') }

if ([string]::IsNullOrWhiteSpace($KubeConfigPath)) {
    $defaultKubeConfig = Join-Path $env:USERPROFILE '.kube\config'
    if (Test-Path -LiteralPath $defaultKubeConfig) {
        $KubeConfigPath = $defaultKubeConfig
        Write-Info "Kubeconfig not provided; defaulting to '$KubeConfigPath'."
    }
}

if ([string]::IsNullOrWhiteSpace($KubeContext) -and (Test-CommandAvailable -Name 'oc')) {
    $contextArgs = @()
    if (-not [string]::IsNullOrWhiteSpace($KubeConfigPath) -and (Test-Path -LiteralPath $KubeConfigPath)) {
        $contextArgs += @('--kubeconfig', $KubeConfigPath)
    }
    $detectedContext = ([string](& oc @contextArgs config current-context 2>$null)).Trim()
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($detectedContext)) {
        $KubeContext = $detectedContext
        Write-Info "Kube context not provided; using current context '$KubeContext'."
    }
}

Ensure-OcCli

if ([string]::IsNullOrWhiteSpace($Namespace)) {
    $resolvedScope = Try-ResolveLogicAppsScope
    if ($resolvedScope) {
        if (-not [string]::IsNullOrWhiteSpace($resolvedScope.Namespace)) {
            $Namespace = $resolvedScope.Namespace
        }
        if (-not [string]::IsNullOrWhiteSpace($resolvedScope.PrimaryAppName)) {
            $script:PrimaryLogicAppName = $resolvedScope.PrimaryAppName
        }
    }
}

$script:PrimaryLogicAppName = if (-not [string]::IsNullOrWhiteSpace($AppName)) { $AppName } elseif (-not [string]::IsNullOrWhiteSpace($script:PrimaryLogicAppName)) { $script:PrimaryLogicAppName } else { '' }
if ([string]::IsNullOrWhiteSpace($script:PrimaryLogicAppName) -and -not [string]::IsNullOrWhiteSpace($Namespace)) {
    $discoveredApps = @(Get-LogicAppNamesFromNamespace)
    if ($discoveredApps.Count -gt 0) {
        $script:PrimaryLogicAppName = [string]$discoveredApps[0]
        Write-Info "Using '$script:PrimaryLogicAppName' as the primary Logic App for secret/resource discovery."
    }
}

if ([string]::IsNullOrWhiteSpace($MasterKey)) {
    $MasterKey = Try-ResolveMasterKeyFromPodSecrets
}

if ([string]::IsNullOrWhiteSpace($SqlServer) -or
    [string]::IsNullOrWhiteSpace($SqlDatabase) -or
    [string]::IsNullOrWhiteSpace($SqlUser) -or
    [string]::IsNullOrWhiteSpace($SqlPassword)) {
    $resolvedSql = Try-ResolveSqlSettingsFromContainerAppSecret
    if (-not $resolvedSql) {
        $resolvedSql = Try-ResolveSqlSettingsFromPod
    }
    if ($resolvedSql) {
        if ([string]::IsNullOrWhiteSpace($SqlServer) -and -not [string]::IsNullOrWhiteSpace($resolvedSql.Server)) { $SqlServer = $resolvedSql.Server }
        if ([string]::IsNullOrWhiteSpace($SqlDatabase) -and -not [string]::IsNullOrWhiteSpace($resolvedSql.Database)) { $SqlDatabase = $resolvedSql.Database }
        if ([string]::IsNullOrWhiteSpace($SqlUser) -and -not [string]::IsNullOrWhiteSpace($resolvedSql.User)) { $SqlUser = $resolvedSql.User }
        if ([string]::IsNullOrWhiteSpace($SqlPassword) -and -not [string]::IsNullOrWhiteSpace($resolvedSql.Password)) { $SqlPassword = $resolvedSql.Password }
    }
}

if ([string]::IsNullOrWhiteSpace($SqlServer)) {
    $SqlServer = 'localhost'
    Write-Info "SQL Server not provided; defaulting to '$SqlServer'."
}

if ($UsePortForward) {
    if ([string]::IsNullOrWhiteSpace($LogicAppBaseUrl)) {
        $LogicAppBaseUrl = "http://127.0.0.1:$LocalLogicAppPort"
        Write-Info "Logic Apps base URL not provided; defaulting to port-forward URL '$LogicAppBaseUrl'."
    }
}
elseif ([string]::IsNullOrWhiteSpace($LogicAppBaseUrl)) {
    $LogicAppBaseUrl = Try-ResolveLogicAppBaseUrlFromContainerApp
}

if ([string]::IsNullOrWhiteSpace($PrometheusUrl) -or [string]::IsNullOrWhiteSpace($PrometheusToken)) {
    $resolvedProm = Try-ResolvePrometheusSettingsFromOpenShift
    if ($resolvedProm) {
        if ([string]::IsNullOrWhiteSpace($PrometheusUrl) -and -not [string]::IsNullOrWhiteSpace($resolvedProm.Url)) {
            $PrometheusUrl = $resolvedProm.Url
        }
        if ([string]::IsNullOrWhiteSpace($PrometheusToken) -and -not [string]::IsNullOrWhiteSpace($resolvedProm.Token)) {
            $PrometheusToken = $resolvedProm.Token
        }
    }
}

$SqlServer = Resolve-InputValue -Name 'SqlServer' -CurrentValue $SqlServer -Prompt 'SQL Server host/IP' -Required
$SqlDatabase = Resolve-InputValue -Name 'SqlDatabase' -CurrentValue $SqlDatabase -Prompt 'SQL Database' -DefaultValue 'logicapp' -Required
$SqlUser = Resolve-InputValue -Name 'SqlUser' -CurrentValue $SqlUser -Prompt 'SQL username' -Required
$SqlPassword = Resolve-InputValue -Name 'SqlPassword' -CurrentValue $SqlPassword -Prompt 'SQL password' -Secret -Required
$MasterKey = Resolve-InputValue -Name 'MasterKey' -CurrentValue $MasterKey -Prompt 'Logic Apps master key' -Secret -Required
if (-not $UsePortForward) {
    $LogicAppBaseUrl = Resolve-InputValue -Name 'LogicAppBaseUrl' -CurrentValue $LogicAppBaseUrl -Prompt 'Logic Apps base URL' -Required
}
if ($PrometheusUrl) {
    $PrometheusToken = Resolve-InputValue -Name 'PrometheusToken' -CurrentValue $PrometheusToken -Prompt 'Prometheus bearer token (optional)' -Secret
}
$Namespace = Resolve-InputValue -Name 'Namespace' -CurrentValue $Namespace -Prompt 'Kubernetes namespace' -DefaultValue 'logicapps-aca-ns' -Required

# Persist secrets to the out-of-repo credentials file (loaded by docker-compose
# env_file). Generated artifacts only reference ${SQL_PASSWORD} / GF_* env vars.
Update-CredentialsFile -Path $CredentialsFile -Values @{
    SQL_SERVER                 = $SqlServer
    SQL_DATABASE               = $SqlDatabase
    SQL_USER                   = $SqlUser
    SQL_PASSWORD               = $SqlPassword
    GF_SECURITY_ADMIN_USER     = $GrafanaAdminUser
    GF_SECURITY_ADMIN_PASSWORD = $GrafanaAdminPassword
}
Write-Info "Secrets written to $CredentialsFile (referenced by docker-compose env_file; not baked into generated artifacts)."

Ensure-PortalDirectories
Ensure-DockerReady
Ensure-NodeJs
Ensure-OcCli
Initialize-KubeConfig

$allAppNames = @()
$hasLiveAppPanels = $true
if (-not [string]::IsNullOrWhiteSpace($AppName)) {
    $allAppNames = @($AppName)
}
else {
    $allAppNames = @(Get-LogicAppNamesFromNamespace)
    if ($allAppNames.Count -eq 0) {
        $hasLiveAppPanels = $false
        Write-Warning "No Logic Apps were discovered in namespace '$Namespace'. Continuing in SQL-only mode."
        $AppName = ''
    }
    Write-Info "Discovered $($allAppNames.Count) app(s) for dashboard generation: $($allAppNames -join ', ')"
    if ($allAppNames.Count -gt 0) {
        $AppName = $allAppNames[0]
        Write-Info "Using '$AppName' for Workflow/App Manager and port-forward."
    }
}

Ensure-PortAvailability -PreserveManagedProcesses ([bool]$SkipStart)

$script:EffectiveLogicAppBaseUrl = if ($UsePortForward) { "http://127.0.0.1:$LocalLogicAppPort" } else { $LogicAppBaseUrl.TrimEnd('/') }
if ($hasLiveAppPanels) {
    $podResource = Resolve-PodResource
    $portForwardStatus = Start-LogicAppPortForward -PodResource $podResource
    $script:EffectiveLogicAppBaseUrl = $portForwardStatus.BaseUrl
}

$workflows = if ($hasLiveAppPanels) { Get-WorkflowMetadata } else { @() }
$sqlMetadata = Get-SqlMetadata
$workflowMappings = Get-WorkflowTableMapping -Workflows $workflows -Tables $sqlMetadata.Tables
# Defensive: only keep mappings whose run table still exists in SQL. Logic Apps drops/recreates
# per-workflow flow<hash>runs tables across redeploys; a stale mapping to a missing table would
# break every UNION-based KPI query (one Invalid object name aborts the whole statement).
$existingTableKeys = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($t in $sqlMetadata.Tables) { $null = $existingTableKeys.Add(("{0}.{1}" -f $t.SchemaName, $t.TableName)) }
$workflowMappings = @($workflowMappings | Where-Object { $existingTableKeys.Contains(("{0}.{1}" -f $_.SchemaName, $_.TableName)) })
$dashboardUid = 'logicapps-monitor'
$dashboardTitle = 'Logic Apps - Workflow Hub'
$dashboardObject = New-DashboardObject -WorkflowMappings $workflowMappings -JobTable $sqlMetadata.JobTable -HasPrometheus ([bool]$PrometheusUrl) -DashboardAppName $AppName -DashboardAppNames $allAppNames -DashboardUid $dashboardUid -DashboardTitle $dashboardTitle -IncludeLiveAppPanels $hasLiveAppPanels
$dashboardDefinitions = @([pscustomobject]@{
    AppName  = $AppName
    FileName = 'logicapps-workflow-hub.json'
    Uid      = $dashboardUid
    Object   = $dashboardObject
})
$script:DefaultDashboardFileName = 'logicapps-workflow-hub.json'
$script:DefaultDashboardUid = $dashboardUid
Write-PortalFiles -Dashboards $dashboardDefinitions

if (-not $SkipStart) {
    Start-ThanosTunnel

    Write-Step 'Starting Grafana'
    Invoke-Compose -ComposeArgs @('-f', $ComposeFile, 'up', '-d', '--force-recreate')

    if ($hasLiveAppPanels) {
        Write-Step 'Starting Workflow Manager'
        Stop-ProcessOnPort -Port $RunManagerPort -Name 'Workflow Manager'
        $null = Start-ManagedProcess -Name 'workflow-manager' -FilePath 'node' -ArgumentList @('workflow-manager.js') -WorkingDirectory $PortalRoot -PidFile $RunManagerPidFile -StdOutLog $RunManagerOutLog -StdErrLog $RunManagerErrLog
        Wait-PortListening -Port $RunManagerPort -TimeoutSeconds 20 -Description 'Workflow Manager'

        Write-Step 'Starting Logic App Manager'
        Stop-ProcessOnPort -Port $AppManagerPort -Name 'Logic App Manager'
        $null = Start-ManagedProcess -Name 'app-manager' -FilePath 'node' -ArgumentList @('app-manager.js') -WorkingDirectory $PortalRoot -PidFile $AppManagerPidFile -StdOutLog $AppManagerOutLog -StdErrLog $AppManagerErrLog
        Wait-PortListening -Port $AppManagerPort -TimeoutSeconds 20 -Description 'Logic App Manager'
    }
    else {
        Write-Info 'SQL-only mode active; skipping Workflow/App Manager startup.'
    }

    Write-Step 'Waiting for Grafana health check'
    Wait-GrafanaHealthy -TimeoutSeconds 120

    Publish-TabbedDashboards -Dashboards $dashboardDefinitions
}

$grafanaUrl = "http://localhost:$GrafanaPort/d/$script:DefaultDashboardUid"
$runManagerUrl = "http://localhost:$RunManagerPort"
$appManagerUrl = "http://localhost:$AppManagerPort"

if (-not $SkipStart -and -not $NoBrowser) {
    Write-Step 'Opening browser'
    Start-Process $grafanaUrl | Out-Null
}

Write-Step 'Setup complete'
Write-Host "Grafana URL      : $grafanaUrl"
Write-Host "Grafana creds    : $GrafanaAdminUser / $GrafanaAdminPassword"
Write-Host "Workflow Manager URL  : $runManagerUrl"
Write-Host "App Manager URL  : $appManagerUrl"
Write-Host "Workflow map     : $WorkflowMapFile"
Write-Host "Port-forward     : $(if ($UsePortForward) { $script:EffectiveLogicAppBaseUrl } else { 'disabled' })"
Write-Host "Stop Grafana     : docker compose -f `"$ComposeFile`" down"
Write-Host "Stop Workflow Manager : if (Test-Path '$RunManagerPidFile') { Stop-Process -Id ([int](Get-Content '$RunManagerPidFile')) -Force }"
if ($UsePortForward) {
    Write-Host "Stop PortForward : if (Test-Path '$PortForwardPidFile') { Stop-Process -Id ([int](Get-Content '$PortForwardPidFile')) -Force }"
}
Write-Host "Logs             : $LogRoot"
