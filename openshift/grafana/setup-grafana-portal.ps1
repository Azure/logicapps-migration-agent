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
$LocalLogicAppPort = 8088
$RemoteLogicAppPort = 80
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

    $rg = (& az resource list --name $targetAppName --resource-type Microsoft.App/containerApps --query "[0].resourceGroup" -o tsv 2>$null).Trim()
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

    $podName = (& oc -n $Namespace get pods -l "containerapps.io/app-name=$AppName" -o jsonpath='{.items[0].metadata.name}' 2>$null).Trim()
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

    $currentNamespace = (& oc @baseArgs config view --minify --output 'jsonpath={..namespace}' 2>$null).Trim()
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

function Get-ActiveTcpPorts {
    [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners().Port
}

function Test-PortListening([int]$Port) {
    (Get-ActiveTcpPorts) -contains $Port
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
                Stop-Process -Id ([int]$pidValue) -Force -ErrorAction Stop
            }
        }
    }
    finally {
        Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
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

    if (Test-CommandAvailable -Name 'oc') {
        Write-Info "oc detected."
        return
    }

    $fallbackOc = Join-Path (Split-Path -Parent $ScriptRoot) 'openshift-tools\oc.exe'
    if (Test-Path -LiteralPath $fallbackOc) {
        $fallbackDir = Split-Path -Parent $fallbackOc
        $env:Path = "$fallbackDir;$env:Path"
        if (Test-CommandAvailable -Name 'oc') {
            Write-Info "oc detected via fallback path: $fallbackOc"
            return
        }
    }

    if ($UsePortForward) {
        throw 'The oc CLI is required when -UsePortForward is true. Install oc and ensure it is available in PATH.'
    }

    Write-Warning 'oc CLI is not available. Continuing because -UsePortForward is false.'
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

    try {
        Invoke-RestMethod @params
    }
    catch {
        throw "Logic Apps API request failed ($Method $uri): $($_.Exception.Message)"
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
            $podName = (& oc -n $Namespace get pods -l $PodSelector -o jsonpath='{.items[0].metadata.name}' 2>$null).Trim()
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

        $labelMatch = (& oc -n $Namespace get pods -l "containerapps.io/app-name=$AppName" -o jsonpath='{.items[0].metadata.name}' 2>$null).Trim()
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
    $workflowItems = if ($response.PSObject.Properties.Name -contains 'value') { @($response.value) } else { @($response) }
    if (-not $workflowItems -or $workflowItems.Count -eq 0) {
        Write-Warn 'No workflows were returned by the Logic Apps management API. Continuing with SQL table-only mapping.'
        return @()
    }

    $workflows = foreach ($workflow in $workflowItems) {
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

    $workflowNames = @(
        $workflows |
        Where-Object { $_ -and $_.PSObject.Properties.Name -contains 'Name' -and -not [string]::IsNullOrWhiteSpace([string]$_.Name) } |
        ForEach-Object { [string]$_.Name }
    )
    Write-Info "Discovered $($workflows.Count) workflow(s): $($workflowNames -join ', ')"
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

    if (-not $Workflows -or $Workflows.Count -eq 0) {
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

    foreach ($workflow in $Workflows) {
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

    foreach ($workflow in $Workflows | Where-Object { $_.Name -notin (Get-MappedWorkflowNames) }) {
        $triggerCandidates = @()
        foreach ($trigger in $workflow.Triggers) {
            $triggerCandidates += $Tables | Where-Object { -not $usedTables.Contains($_.TableName) -and ($_.Triggers -contains $trigger) }
        }
        $triggerCandidates = @($triggerCandidates | Sort-Object TableName -Unique)
        if ($triggerCandidates.Count -eq 1) {
            Add-MappingResult -Mappings $mappings -UsedTables $usedTables -Workflow $workflow -Table $triggerCandidates[0] -Method 'trigger-name-match'
        }
    }

    foreach ($workflow in $Workflows | Where-Object { $_.Name -notin (Get-MappedWorkflowNames) }) {
        $nameCandidates = @($Tables | Where-Object {
            -not $usedTables.Contains($_.TableName) -and $_.TableName.ToLowerInvariant().Contains($workflow.Normalized)
        })
        if ($nameCandidates.Count -eq 1) {
            Add-MappingResult -Mappings $mappings -UsedTables $usedTables -Workflow $workflow -Table $nameCandidates[0] -Method 'name-match'
        }
    }

    $remainingWorkflows = @($Workflows | Where-Object { $_.Name -notin (Get-MappedWorkflowNames) } | Sort-Object Name)
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

function New-DashboardObject {
    param(
        [object[]]$WorkflowMappings,
        [object]$JobTable,
        [bool]$HasPrometheus,
        [string]$DashboardAppName,
        [string]$DashboardUid,
        [string]$DashboardTitle
    )

    $panels = New-Object System.Collections.ArrayList
    $script:PanelCounter = 0
    $effectiveAppName = if ($DashboardAppName) { $DashboardAppName } else { $AppName }
    $podRegex = (($effectiveAppName -replace '([.^$|?*+(){}\[\]\\])', '\\$1') + '.*')

    function Next-PanelId {
        $script:PanelCounter++
        $script:PanelCounter
    }

    function New-SqlTarget([string]$RefId, [string]$RawSql, [string]$Format = 'table') {
        [ordered]@{ refId = $RefId; rawSql = $RawSql; format = $Format }
    }

    function New-PromTarget([string]$RefId, [string]$Expr, [string]$LegendFormat, [bool]$Instant = $false, [string]$Format = $null) {
        $target = [ordered]@{ refId = $RefId; expr = $Expr; legendFormat = $LegendFormat }
        if ($Instant) { $target.instant = $true }
        if ($Format) { $target.format = $Format }
        $target
    }

    $allCreatedUnion = ($WorkflowMappings | ForEach-Object {
        'SELECT CreatedTime FROM [{0}].[{1}] WHERE $__timeFilter(CreatedTime)' -f (Escape-SqlIdentifier $_.SchemaName), (Escape-SqlIdentifier $_.TableName)
    }) -join "`nUNION ALL`n"
    $allStatusUnion = ($WorkflowMappings | ForEach-Object {
        'SELECT CreatedTime, Status FROM [{0}].[{1}] WHERE $__timeFilter(CreatedTime)' -f (Escape-SqlIdentifier $_.SchemaName), (Escape-SqlIdentifier $_.TableName)
    }) -join "`nUNION ALL`n"
    $allSucceededUnion = ($WorkflowMappings | ForEach-Object {
        'SELECT Status FROM [{0}].[{1}] WHERE $__timeFilter(CreatedTime) AND Status=''Succeeded''' -f (Escape-SqlIdentifier $_.SchemaName), (Escape-SqlIdentifier $_.TableName)
    }) -join "`nUNION ALL`n"
    $allFailedUnion = ($WorkflowMappings | ForEach-Object {
        'SELECT Status FROM [{0}].[{1}] WHERE $__timeFilter(CreatedTime) AND Status=''Failed''' -f (Escape-SqlIdentifier $_.SchemaName), (Escape-SqlIdentifier $_.TableName)
    }) -join "`nUNION ALL`n"
    $allRunningUnion = ($WorkflowMappings | ForEach-Object {
        'SELECT Status FROM [{0}].[{1}] WHERE $__timeFilter(CreatedTime) AND Status=''Running''' -f (Escape-SqlIdentifier $_.SchemaName), (Escape-SqlIdentifier $_.TableName)
    }) -join "`nUNION ALL`n"
    $allDurationUnion = ($WorkflowMappings | ForEach-Object {
        'SELECT CreatedTime, EndTime FROM [{0}].[{1}] WHERE $__timeFilter(CreatedTime) AND EndTime IS NOT NULL AND EndTime > CreatedTime' -f (Escape-SqlIdentifier $_.SchemaName), (Escape-SqlIdentifier $_.TableName)
    }) -join "`nUNION ALL`n"

    $inventoryQuery = @(
        'SELECT * FROM ('
        (($WorkflowMappings | ForEach-Object {
            $name = Escape-SqlString $_.WorkflowName
            'SELECT ''{0}'' AS [Workflow],
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
FROM [{1}].[{2}]' -f $name, (Escape-SqlIdentifier $_.SchemaName), (Escape-SqlIdentifier $_.TableName)
       }) -join "`nUNION ALL`n")
       ') summary'
       'ORDER BY [Failed] DESC, [Total Runs] DESC'
   ) -join "`n"

    $latencyQuery = (($WorkflowMappings | ForEach-Object {
        $name = Escape-SqlString $_.WorkflowName
        'SELECT Workflow,
  CAST(P50 / 1000.0 AS DECIMAL(10,3)) AS P50,
  CAST(P95 / 1000.0 AS DECIMAL(10,3)) AS P95,
  CAST(P99 / 1000.0 AS DECIMAL(10,3)) AS P99,
  Runs
FROM (
  SELECT ''{0}'' AS Workflow,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY DATEDIFF(MILLISECOND, CreatedTime, EndTime)) OVER() AS P50,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY DATEDIFF(MILLISECOND, CreatedTime, EndTime)) OVER() AS P95,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY DATEDIFF(MILLISECOND, CreatedTime, EndTime)) OVER() AS P99,
    COUNT(*) OVER() AS Runs,
    ROW_NUMBER() OVER (ORDER BY CreatedTime) AS rn
  FROM [{1}].[{2}]
  WHERE $__timeFilter(CreatedTime) AND EndTime IS NOT NULL AND EndTime > CreatedTime
) t WHERE rn = 1' -f $name, (Escape-SqlIdentifier $_.SchemaName), (Escape-SqlIdentifier $_.TableName)
    }) -join "`nUNION ALL`n") + "`nORDER BY Runs DESC"

    $topFailedQuery = @(
        'SELECT * FROM ('
        (($WorkflowMappings | ForEach-Object {
            $name = Escape-SqlString $_.WorkflowName
            'SELECT ''{0}'' AS Workflow,
  SUM(CASE WHEN Status=''Failed'' THEN 1 ELSE 0 END) AS [Failed],
  CAST(SUM(CASE WHEN Status=''Failed'' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0) AS DECIMAL(5,1)) AS [Failure%]
FROM [{1}].[{2}] WHERE $__timeFilter(CreatedTime)' -f $name, (Escape-SqlIdentifier $_.SchemaName), (Escape-SqlIdentifier $_.TableName)
        }) -join "`nUNION ALL`n")
        ') failures'
        'ORDER BY [Failed] DESC, [Failure%] DESC'
    ) -join "`n"

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

    $workflowErrorsQuery = @(
        'SELECT TOP 50 * FROM ('
        (($WorkflowMappings | ForEach-Object {
            $name = Escape-SqlString $_.WorkflowName
            'SELECT TOP 20 ''{0}'' AS Workflow,
  FlowRunSequenceId AS RunId,
  Status,
  Code,
  TriggerName,
  CreatedTime,
  EndTime,
  DATEDIFF(MILLISECOND, CreatedTime, EndTime) AS Duration_ms
FROM [{1}].[{2}]
WHERE $__timeFilter(CreatedTime) AND Status = ''Failed''' -f $name, (Escape-SqlIdentifier $_.SchemaName), (Escape-SqlIdentifier $_.TableName)
        }) -join "`nUNION ALL`n")
        ') errors'
        'ORDER BY CreatedTime DESC'
    ) -join "`n"

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
        $allExecutionTargets += New-SqlTarget -RefId $refId -Format 'time_series' -RawSql ('SELECT CreatedTime AS time, DATEDIFF(MILLISECOND, CreatedTime, EndTime) AS [{0}] FROM [{1}].[{2}] WHERE $__timeFilter(CreatedTime) AND EndTime IS NOT NULL AND EndTime > CreatedTime ORDER BY time' -f (Escape-SqlIdentifier $mapping.WorkflowName), (Escape-SqlIdentifier $mapping.SchemaName), (Escape-SqlIdentifier $mapping.TableName))
    }

    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Total Runs'; type = 'stat'; gridPos = (New-GridPos 4 4 0 0)
        targets = @((New-SqlTarget -RefId 'A' -RawSql ("SELECT COUNT(*) AS total FROM (`n{0}`n) t" -f $allCreatedUnion)))
        fieldConfig = @{ defaults = @{ color = @{ mode = 'thresholds' }; thresholds = @{ steps = @(@{ value = $null; color = 'blue' }) } } }
        options = @{ reduceOptions = @{ calcs = @('lastNotNull') }; textMode = 'value_and_name'; colorMode = 'value' }
    })
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Succeeded'; type = 'stat'; gridPos = (New-GridPos 4 4 4 0)
        targets = @((New-SqlTarget -RefId 'A' -RawSql ("SELECT COUNT(*) AS succeeded FROM (`n{0}`n) t" -f $allSucceededUnion)))
        fieldConfig = @{ defaults = @{ color = @{ mode = 'thresholds' }; thresholds = @{ steps = @(@{ value = $null; color = 'green' }) } } }
        options = @{ reduceOptions = @{ calcs = @('lastNotNull') }; textMode = 'value_and_name'; colorMode = 'value' }
    })
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Failed'; type = 'stat'; gridPos = (New-GridPos 4 4 8 0)
        targets = @((New-SqlTarget -RefId 'A' -RawSql ("SELECT COUNT(*) AS failed FROM (`n{0}`n) t" -f $allFailedUnion)))
        fieldConfig = @{ defaults = @{ color = @{ mode = 'thresholds' }; thresholds = @{ steps = @(@{ value = $null; color = 'green' }, @{ value = 1; color = 'red' }) } } }
        options = @{ reduceOptions = @{ calcs = @('lastNotNull') }; textMode = 'value_and_name'; colorMode = 'value' }
    })
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Avg Duration'; type = 'stat'; gridPos = (New-GridPos 4 4 12 0)
        targets = @((New-SqlTarget -RefId 'A' -RawSql ("SELECT CAST(AVG(DATEDIFF(MILLISECOND, CreatedTime, EndTime)) / 1000.0 AS DECIMAL(10,2)) AS avg_sec FROM (`n{0}`n) t" -f $allDurationUnion)))
        fieldConfig = @{ defaults = @{ unit = 's'; color = @{ mode = 'thresholds' }; thresholds = @{ steps = @(@{ value = $null; color = 'purple' }) } } }
        options = @{ reduceOptions = @{ calcs = @('lastNotNull') }; textMode = 'value_and_name'; colorMode = 'value' }
    })
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Retry Count'; type = 'stat'; gridPos = (New-GridPos 4 4 16 0)
        targets = @((New-SqlTarget -RefId 'A' -RawSql $retryQuery))
        fieldConfig = @{ defaults = @{ color = @{ mode = 'thresholds' }; thresholds = @{ steps = @(@{ value = $null; color = 'orange' }, @{ value = 50; color = 'red' }) } } }
        options = @{ reduceOptions = @{ calcs = @('lastNotNull') }; textMode = 'value_and_name'; colorMode = 'value' }
    })
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Success Rate'; type = 'gauge'; gridPos = (New-GridPos 4 4 20 0)
        targets = @((New-SqlTarget -RefId 'A' -RawSql ("SELECT CAST(ISNULL(SUM(CASE WHEN Status = 'Succeeded' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 0) AS DECIMAL(5,1)) AS success_rate FROM (`n{0}`n) t" -f $allStatusUnion)))
        fieldConfig = @{ defaults = @{ min = 0; max = 100; unit = 'percent'; thresholds = @{ steps = @(@{ value = $null; color = 'red' }, @{ value = 80; color = 'yellow' }, @{ value = 95; color = 'green' }) } } }
        options = @{ reduceOptions = @{ calcs = @('lastNotNull') } }
    })

    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Workflow Inventory'; type = 'table'; gridPos = (New-GridPos 8 24 0 4)
        targets = @((New-SqlTarget -RefId 'A' -RawSql $inventoryQuery))
        options = @{ showHeader = $true; cellHeight = 'sm'; footer = @{ show = $true; reducer = @('sum'); fields = @('Total Runs', 'Succeeded', 'Failed') } }
    })
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Logic App Manager'; type = 'text'; gridPos = (New-GridPos 12 24 0 12)
        options = @{ mode = 'html'; content = "<iframe src='http://localhost:$AppManagerPort/?v=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())' style='width:100%;height:100%;border:none;min-height:720px;'></iframe>" }
    })
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Workflow Manager'; type = 'text'; gridPos = (New-GridPos 12 24 0 24)
        options = @{ mode = 'html'; content = "<iframe src='http://localhost:$RunManagerPort/?v=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())' style='width:100%;height:100%;border:none;min-height:520px;'></iframe>" }
    })
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Run Status Distribution'; type = 'piechart'; gridPos = (New-GridPos 8 8 0 36)
        targets = @(
            (New-SqlTarget -RefId 'A' -RawSql ("SELECT 'Succeeded' AS metric, COUNT(*) AS value FROM (`n{0}`n) t" -f $allSucceededUnion)),
            (New-SqlTarget -RefId 'B' -RawSql ("SELECT 'Failed' AS metric, COUNT(*) AS value FROM (`n{0}`n) t" -f $allFailedUnion)),
            (New-SqlTarget -RefId 'C' -RawSql ("SELECT 'Running' AS metric, COUNT(*) AS value FROM (`n{0}`n) t" -f $allRunningUnion))
        )
        transformations = @(@{ id = 'merge'; options = @{} })
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
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Volume Mounts'; type = 'table'; gridPos = (New-GridPos 8 8 8 44)
        targets = @((New-SqlTarget -RefId 'A' -RawSql $volumeTableQuery))
        options = @{ showHeader = $true; cellHeight = 'sm' }
    })
    $null = $panels.Add([ordered]@{
        id = (Next-PanelId); title = 'Trigger Jobs Status'; type = 'table'; gridPos = (New-GridPos 8 8 16 44)
        targets = @((New-SqlTarget -RefId 'A' -RawSql $triggerJobsQuery))
        options = @{ showHeader = $true; cellHeight = 'sm' }
    })

    $runsOverTimeQuery = "SELECT `$__timeGroup(CreatedTime,'5m') AS time, SUM(CASE WHEN Status = 'Succeeded' THEN 1 ELSE 0 END) AS Succeeded, SUM(CASE WHEN Status = 'Failed' THEN 1 ELSE 0 END) AS Failed FROM ({0}{1}{0}) t GROUP BY `$__timeGroup(CreatedTime,'5m') ORDER BY time" -f [Environment]::NewLine, $allStatusUnion
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
        $null = $panels.Add([ordered]@{ id = (Next-PanelId); title = 'K8s Warning Events'; type = 'table'; datasource = $PrometheusDatasourceName; gridPos = (New-GridPos 8 24 0 $y); targets = @((New-PromTarget -RefId 'A' -Expr "topk(20, kube_event_count{namespace=`"$Namespace`",type=`"Warning`",involved_object_kind=~`"Pod|ContainerApp`"})" -LegendFormat '{{reason}} - {{involved_object_name}}' -Instant $true -Format 'table')); transformations = @(@{ id = 'organize'; options = @{ excludeByName = @{ Time = $true; '__name__' = $true; container = $true; endpoint = $true; instance = $true; job = $true; namespace = $true; prometheus = $true; service = $true; uid = $true; type = $true }; renameByName = @{ involved_object_kind = 'Kind'; involved_object_name = 'Object'; reason = 'Reason'; Value = 'Count' } } }); options = @{ showHeader = $true; cellHeight = 'sm'; sortBy = @(@{ displayName = 'Count'; desc = $true }) } })
        $y += 8
        $null = $panels.Add([ordered]@{ id = (Next-PanelId); title = 'Top Errors / Warnings Summary'; type = 'table'; datasource = $PrometheusDatasourceName; gridPos = (New-GridPos 8 12 0 $y); targets = @((New-PromTarget -RefId 'A' -Expr "topk(10, sum(kube_event_count{namespace=`"$Namespace`",type=`"Warning`"}) by (reason))" -LegendFormat '{{reason}}' -Instant $true -Format 'table')); transformations = @(@{ id = 'organize'; options = @{ excludeByName = @{ Time = $true }; renameByName = @{ reason = 'Warning Reason'; Value = 'Total Occurrences' } } }); options = @{ showHeader = $true; cellHeight = 'sm'; sortBy = @(@{ displayName = 'Total Occurrences'; desc = $true }) } })
        $null = $panels.Add([ordered]@{ id = (Next-PanelId); title = 'Warning Events Over Time'; type = 'timeseries'; datasource = $PrometheusDatasourceName; gridPos = (New-GridPos 8 12 12 $y); targets = @((New-PromTarget -RefId 'A' -Expr "(sum(increase(kube_event_count{namespace=`"$Namespace`",type=`"Warning`",reason=`"Unhealthy`"}[5m])) or on() vector(0))" -LegendFormat 'Unhealthy'), (New-PromTarget -RefId 'B' -Expr "(sum(increase(kube_event_count{namespace=`"$Namespace`",type=`"Warning`",reason=`"Failed`"}[5m])) or on() vector(0))" -LegendFormat 'Failed'), (New-PromTarget -RefId 'C' -Expr "(sum(increase(kube_event_count{namespace=`"$Namespace`",type=`"Warning`",reason=`"FailedMount`"}[5m])) or on() vector(0))" -LegendFormat 'FailedMount'), (New-PromTarget -RefId 'D' -Expr "(sum(increase(kube_event_count{namespace=`"$Namespace`",type=`"Warning`",reason=`"ContainerAppFailure`"}[5m])) or on() vector(0))" -LegendFormat 'ContainerAppFailure'), (New-PromTarget -RefId 'E' -Expr "(sum(increase(kube_event_count{namespace=`"$Namespace`",type=`"Warning`",reason=`"RevisionFailure`"}[5m])) or on() vector(0))" -LegendFormat 'RevisionFailure')); fieldConfig = @{ defaults = @{ custom = @{ lineWidth = 2; fillOpacity = 10 } } } })
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

    foreach ($mapping in $WorkflowMappings) {
        $null = $panels.Add([ordered]@{
            id = (Next-PanelId); title = "$($mapping.WorkflowName) - Runs Over Time"; type = 'timeseries'; gridPos = (New-GridPos 7 12 0 $y)
            targets = @((New-SqlTarget -RefId 'A' -Format 'time_series' -RawSql ('SELECT $__timeGroup(CreatedTime,''5m'') AS time, SUM(CASE WHEN Status = ''Succeeded'' THEN 1 ELSE 0 END) AS Succeeded, SUM(CASE WHEN Status = ''Failed'' THEN 1 ELSE 0 END) AS Failed FROM [{0}].[{1}] WHERE $__timeFilter(CreatedTime) GROUP BY $__timeGroup(CreatedTime,''5m'') ORDER BY time' -f (Escape-SqlIdentifier $mapping.SchemaName), (Escape-SqlIdentifier $mapping.TableName))))
            fieldConfig = @{ defaults = @{ custom = @{ lineWidth = 2; fillOpacity = 10 } } }
        })
        $null = $panels.Add([ordered]@{
            id = (Next-PanelId); title = "$($mapping.WorkflowName) - Recent Runs"; type = 'table'; gridPos = (New-GridPos 7 12 12 $y)
            targets = @((New-SqlTarget -RefId 'A' -RawSql ('SELECT TOP 20 FlowRunSequenceId AS RunId, Status, TriggerName, CreatedTime, EndTime, DATEDIFF(MILLISECOND, CreatedTime, EndTime) AS Duration_ms FROM [{0}].[{1}] WHERE $__timeFilter(CreatedTime) ORDER BY CreatedTime DESC' -f (Escape-SqlIdentifier $mapping.SchemaName), (Escape-SqlIdentifier $mapping.TableName))))
            options = @{ showHeader = $true; cellHeight = 'sm' }
        })
        $y += 7
    }

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
        panels = $panels
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
    $escapedSqlPassword = $SqlPassword.Replace("'", "''")
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
    $null = $lines.Add("      password: '$escapedSqlPassword'")

    if ($PrometheusUrl) {
        $null = $lines.Add("  - name: $PrometheusDatasourceName")
        $null = $lines.Add('    type: prometheus')
        $null = $lines.Add('    access: proxy')
        $null = $lines.Add('    editable: true')
        $null = $lines.Add("    url: $PrometheusUrl")
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
        @('    extra_hosts:') + ($extraHosts | ForEach-Object { "      - ""$_:host-gateway""" })
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
        "      GF_SECURITY_ADMIN_PASSWORD: $GrafanaAdminPassword",
        '      GF_USERS_ALLOW_SIGN_UP: "false"',
        '      GF_PANELS_DISABLE_SANITIZE_HTML: "true"',
        '      GF_SECURITY_ALLOW_EMBEDDING: "true"',
        "      GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH: /var/lib/grafana/dashboards/$script:DefaultDashboardFileName"
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
    } | ConvertTo-Json -Compress

    $existingRunManager = Join-Path $PortalRoot 'run-manager.js'
    if (Test-Path -LiteralPath $existingRunManager) {
        $existingScript = Get-Content -LiteralPath $existingRunManager -Raw
        if ($existingScript -match 'const CONFIG = .+?;') {
            return [regex]::Replace($existingScript, 'const CONFIG = .+?;', "const CONFIG = $configJson;", 1)
        }
    }

    $template = @'
const http = require('http');
const https = require('https');
const { URL } = require('url');

const CONFIG = __CONFIG_JSON__;
const PORT = CONFIG.port;

function tryParseJson(value) {
  try { return JSON.parse(value); } catch { return null; }
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

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    if (path === '/api/workflows' && req.method === 'GET') {
      const result = await makeRequest('GET', managementPath('/runtime/webhooks/workflow/api/management/workflows'));
      sendJson(res, result.status, result.json || []);
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

    if (path === '/' && req.method === 'GET') {
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
    } | ConvertTo-Json -Compress

    $existingAppManager = Join-Path $PortalRoot 'app-manager.js'
    if (Test-Path -LiteralPath $existingAppManager) {
        $existingScript = Get-Content -LiteralPath $existingAppManager -Raw
        if ($existingScript -match 'const CONFIG = .+?;') {
            return [regex]::Replace($existingScript, 'const CONFIG = .+?;', "const CONFIG = $configJson;", 1)
        }
    }

@'
const { execFile } = require('child_process');
const { promisify } = require('util');
const http = require('http');

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
  </style>
</head>
<body>
  <script>(function(){try{const p=window.parent&&window.parent.document&&window.parent.document.body;if(p&&(p.classList.contains('theme-dark')||p.getAttribute('data-theme')==='dark'))document.body.classList.add('dark')}catch{} if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)document.body.classList.add('dark');})();</script>
  <h1>⚡ Logic App Manager</h1>
  <div class="card">
    <div class="row">
      <button class="primary" onclick="refresh()">Refresh</button>
      <button class="danger" onclick="restartApp()">App Restart</button>
    </div>
    <div id="summary" class="muted" style="margin-top:8px;"></div>
  </div>
  <div id="app"></div>
  <div id="revisions"></div>
  <div id="replicas"></div>
  <script>
    const summaryEl = document.getElementById('summary');
    const appEl = document.getElementById('app');
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
    }
    async function refresh(){ summaryEl.textContent = 'Loading...'; const data = await api('/api/app'); renderApp(data); }
    async function restartApp(){ if(!confirm('Restart the entire app?')) return; await api('/api/app/restart', { method:'POST' }); await refresh(); }
    async function restartRevision(revision){ if(!confirm('Restart revision ' + revision + '?')) return; await api('/api/revisions/' + encodeURIComponent(revision) + '/restart', { method:'POST' }); await refresh(); }
    async function restartReplica(pod){ if(!confirm('Restart replica ' + pod + '?')) return; await api('/api/pods/' + encodeURIComponent(pod) + '/restart', { method:'POST' }); await refresh(); }
    refresh().catch(err => { summaryEl.textContent = err.message; });
  </script>
</body>
</html>`);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(res, 500, { error: error.message || String(error) });
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
    Set-Content -LiteralPath $DashboardProvisioningFile -Value (Get-DashboardProvisioningYaml) -Encoding UTF8
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

Write-Step 'Resolving parameters'
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
    $detectedContext = (& oc @contextArgs config current-context 2>$null).Trim()
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

Ensure-PortalDirectories
Ensure-DockerReady
Ensure-NodeJs
Ensure-OcCli
Initialize-KubeConfig

$allAppNames = @()
if (-not [string]::IsNullOrWhiteSpace($AppName)) {
    $allAppNames = @($AppName)
}
else {
    $allAppNames = @(Get-LogicAppNamesFromNamespace)
    if ($allAppNames.Count -eq 0) {
        throw "No Logic Apps were discovered in namespace '$Namespace'. Provide -AppName or deploy at least one app."
    }
    Write-Info "Discovered $($allAppNames.Count) app(s) for dashboard generation: $($allAppNames -join ', ')"
    $AppName = $allAppNames[0]
    Write-Info "Using '$AppName' for Workflow/App Manager and port-forward."
}

Ensure-PortAvailability -PreserveManagedProcesses ([bool]$SkipStart)

$script:EffectiveLogicAppBaseUrl = if ($UsePortForward) { "http://127.0.0.1:$LocalLogicAppPort" } else { $LogicAppBaseUrl.TrimEnd('/') }
$podResource = Resolve-PodResource
$portForwardStatus = Start-LogicAppPortForward -PodResource $podResource
$script:EffectiveLogicAppBaseUrl = $portForwardStatus.BaseUrl

$workflows = Get-WorkflowMetadata
$sqlMetadata = Get-SqlMetadata
$workflowMappings = Get-WorkflowTableMapping -Workflows $workflows -Tables $sqlMetadata.Tables
$dashboardDefinitions = New-Object System.Collections.Generic.List[object]
foreach ($dashboardAppName in $allAppNames) {
    $slug = Get-SafeDashboardSlug -Value $dashboardAppName
    $dashboardUid = if ($slug -eq 'default') { 'logicapps-monitor-default' } else { "logicapps-monitor-$slug" }
    $dashboardTitle = "Logic Apps - Workflow Hub ($dashboardAppName)"
    $dashboardObject = New-DashboardObject -WorkflowMappings $workflowMappings -JobTable $sqlMetadata.JobTable -HasPrometheus ([bool]$PrometheusUrl) -DashboardAppName $dashboardAppName -DashboardUid $dashboardUid -DashboardTitle $dashboardTitle
    $dashboardDefinitions.Add([pscustomobject]@{
        AppName  = $dashboardAppName
        FileName = "logicapps-workflow-hub-$slug.json"
        Uid      = $dashboardUid
        Object   = $dashboardObject
    })
}

$firstDashboard = $dashboardDefinitions | Select-Object -First 1
$script:DefaultDashboardFileName = $firstDashboard.FileName
$script:DefaultDashboardUid = $firstDashboard.Uid
Write-PortalFiles -Dashboards @($dashboardDefinitions)

if (-not $SkipStart) {
    Write-Step 'Starting Grafana'
    Invoke-Compose -ComposeArgs @('-f', $ComposeFile, 'up', '-d')

    Write-Step 'Starting Workflow Manager'
    $null = Start-ManagedProcess -Name 'workflow-manager' -FilePath 'node' -ArgumentList @('workflow-manager.js') -WorkingDirectory $PortalRoot -PidFile $RunManagerPidFile -StdOutLog $RunManagerOutLog -StdErrLog $RunManagerErrLog
    Wait-PortListening -Port $RunManagerPort -TimeoutSeconds 20 -Description 'Workflow Manager'

    Write-Step 'Starting Logic App Manager'
    $null = Start-ManagedProcess -Name 'app-manager' -FilePath 'node' -ArgumentList @('app-manager.js') -WorkingDirectory $PortalRoot -PidFile $AppManagerPidFile -StdOutLog $AppManagerOutLog -StdErrLog $AppManagerErrLog
    Wait-PortListening -Port $AppManagerPort -TimeoutSeconds 20 -Description 'Logic App Manager'

    Write-Step 'Waiting for Grafana health check'
    Wait-GrafanaHealthy -TimeoutSeconds 120
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
