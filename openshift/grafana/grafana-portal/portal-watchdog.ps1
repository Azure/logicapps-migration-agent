# Watchdog: keeps the 8088 Logic Apps port-forward tunnel and the run-manager
# (3001) alive. The tunnel dies whenever the Container App pod rolls over (KEDA
# scaling / revision rollover), which repeatedly broke the Workflow inventory
# and (previously) the dashboard KPIs. This restarts whatever is down.
param(
    [int]$IntervalSeconds = 20
)

$ErrorActionPreference = 'SilentlyContinue'
$g   = 'C:\src\logicapps-migration-agent\openshift\grafana\grafana-portal'
$oc  = 'C:\src\logicapps-migration-agent\openshift\openshift-tools\oc.exe'
$env:KUBECONFIG = 'C:\Users\psrivas\Downloads\kubeconfig'
$ns  = 'logicapps-aca-ns'
$app = 'psrivas-la1001'
$logDir = Join-Path $g 'logs'
$stateDir = Join-Path $g 'state'
New-Item -ItemType Directory -Path $logDir, $stateDir -Force | Out-Null

function Write-Log($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
    Add-Content -Path (Join-Path $logDir 'watchdog.log') -Value $line
}

function Test-Http($url, $timeoutSec = 8) {
    try { $null = Invoke-WebRequest -Uri $url -TimeoutSec $timeoutSec -UseBasicParsing; return $true }
    catch { return $false }
}

function Restart-Tunnel {
    $pf = Join-Path $stateDir 'port-forward.pid'
    if (Test-Path $pf) { $old = Get-Content $pf; try { Stop-Process -Id $old -Force -ErrorAction Stop } catch {} }
    $pod = (& $oc -n $ns get pods -l "containerapps.io/app-name=$app" --field-selector=status.phase=Running -o name 2>$null | Select-Object -First 1)
    if (-not $pod) { Write-Log "tunnel: no running pod found"; return }
    $tp = Start-Process $oc -ArgumentList "-n", $ns, "port-forward", $pod, "8088:80", "--address", "127.0.0.1" `
        -RedirectStandardOutput (Join-Path $logDir 'port-forward.out.log') `
        -RedirectStandardError  (Join-Path $logDir 'port-forward.err.log') -PassThru
    $tp.Id | Set-Content $pf
    Write-Log "tunnel: restarted -> pid=$($tp.Id) pod=$pod"
    Start-Sleep -Seconds 4
}

function Restart-RunManager {
    $rp = Join-Path $stateDir 'run-manager.pid'
    if (Test-Path $rp) { $old = Get-Content $rp; try { Stop-Process -Id $old -Force -ErrorAction Stop } catch {} }
    $p = Start-Process node -ArgumentList 'run-manager.js' -WorkingDirectory $g `
        -RedirectStandardOutput (Join-Path $logDir 'run-manager.out.log') `
        -RedirectStandardError  (Join-Path $logDir 'run-manager.err.log') -PassThru
    $p.Id | Set-Content $rp
    Write-Log "run-manager: restarted -> pid=$($p.Id)"
    Start-Sleep -Seconds 3
}

Write-Log "watchdog started (interval ${IntervalSeconds}s)"
while ($true) {
    # 1) Tunnel first (run-manager depends on it).
    if (-not (Test-Http 'http://127.0.0.1:8088/')) {
        Write-Log "tunnel: 8088 down -> restarting"
        Restart-Tunnel
    }
    # 2) Run-manager — cheap liveness probe (does not touch the slow runs API).
    if (-not (Test-Http 'http://127.0.0.1:3001/healthz' 8)) {
        Write-Log "run-manager: /healthz not responding -> restarting"
        Restart-RunManager
    }
    Start-Sleep -Seconds $IntervalSeconds
}
