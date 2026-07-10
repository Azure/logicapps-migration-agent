#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Complete setup script for Azure Logic Apps Standard on Single Node OpenShift (SNO).
    
.DESCRIPTION
    This script prepares Single Node OpenShift (SNO) Assisted Installer inputs on Windows and
    sets up a fully working Logic Apps Standard environment on an existing SNO cluster including:
    - OpenShift CLI bootstrap
    - SNO Assisted Installer input generation
    - OpenShift cluster access validation
    - Azure Arc connected cluster
    - MetalLB for LoadBalancer support
    - SMB CSI driver for workflow storage
    - ACA (Azure Container Apps) k8s-extension
    - CoreDNS fix for k4apps domain resolution
    - Connected environment and custom location
    - SQL Server database for Logic Apps runtime
    - Sample workflow deployment
    
.PARAMETER Index
    Mandatory. The index number used to generate unique resource names (e.g., resource group, cluster name).

.PARAMETER Clean
    Optional switch. When specified, removes all previous deployments (Azure resources, namespaces, CRDs) before setup.

.PARAMETER Phase
    Optional. One or more phase numbers to execute. If omitted, all phases run sequentially.
    Valid phases: 0, 0.5, 0.8, 0.9, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12.5, 13

.PARAMETER Prefix
    Optional. Name prefix for resource naming (resource group, cluster, logic app). Default: "psrivas".

.PARAMETER TenantId
    Optional. Azure AD tenant ID to login to. Default: Microsoft tenant (72f988bf-...).

.PARAMETER SubscriptionName
    Optional. Azure subscription name or ID to use. Default: "BTS2".

.PARAMETER KubeConfigPath
    Optional. Path to the kubeconfig file for the target SNO cluster.
    Default: "$HOME\.kube\config"

.PARAMETER OpenShiftApiUrl
    Optional. OpenShift API server URL. Required when using OpenShiftPassword or OpenShiftToken.
    When used with -KubeConfigPath, overrides the kubeconfig server endpoint so the script can
    connect by IP or alternate hostname without editing the original kubeconfig file.

.PARAMETER OpenShiftUsername
    Optional. OpenShift username for oc login when OpenShiftPassword is provided.
    Default: "kubeadmin"

.PARAMETER OpenShiftPassword
    Optional. OpenShift password used with OpenShiftUsername for oc login.

.PARAMETER OpenShiftToken
    Optional. OpenShift bearer token used for oc login. Takes precedence over OpenShiftPassword.

.PARAMETER SkipTlsVerify
    Optional. Whether oc login should skip TLS verification. Default: $true.

.PARAMETER MetalLbIpStart
    Optional. First IP in the MetalLB address pool reserved for the SNO cluster.
    If omitted (with MetalLbIpEnd), the script auto-selects a local /24 range.

.PARAMETER MetalLbIpEnd
    Optional. Last IP in the MetalLB address pool reserved for the SNO cluster.
    If omitted (with MetalLbIpStart), the script auto-selects a local /24 range.

.PARAMETER HostAccessIp
    Optional. Windows host IP address reachable from the SNO cluster for SQL Server and SMB access.
    If omitted, the script auto-detects a suitable local host IP.

.PARAMETER OpenShiftSourceCidr
    Optional. Source CIDR allowed through the Windows firewall for SMB and SQL access from OpenShift.
    Default: "Any"

.PARAMETER OpenShiftVersionChannel
    Optional. OpenShift client channel used to download oc.exe.
    Default: "stable"

.PARAMETER OpenShiftToolsDir
    Optional. Directory where oc.exe will be installed if missing.
    Default: "<script folder>\openshift-tools"

.PARAMETER PullSecretPath
    Optional. Path to the Red Hat pull secret file used to prepare SNO Assisted Installer inputs.
    Default: "<script folder>\pull-secret.txt"

.PARAMETER SnoInstallerAssetsDir
    Optional. Directory where the SNO Assisted Installer input files will be generated.
    Default: "<script folder>\sno-installer-assets"

.PARAMETER SnoBaseDomain
    Optional. Base domain written into the generated Assisted Installer input summary.

.PARAMETER SshPublicKeyPath
    Optional. SSH public key file captured in the generated Assisted Installer input summary.
    Default: "$HOME\.ssh\id_rsa.pub"

.PARAMETER SnoMachineNetworkCidr
    Optional. Machine network CIDR captured in the generated Assisted Installer input summary.

.PARAMETER SnoApiVip
    Optional. API VIP captured in the generated Assisted Installer input summary.

.PARAMETER SnoIngressVip
    Optional. Ingress VIP captured in the generated Assisted Installer input summary.

.PARAMETER SnoInstallationDisk
    Optional. Installation disk path captured in the generated Assisted Installer input summary.

.PARAMETER HyperVVmName
    Optional. Hyper-V VM name for the SNO host. Default: "<cluster-name>-vm"

.PARAMETER HyperVSwitchName
    Optional. Hyper-V virtual switch name used by the SNO VM.

.PARAMETER HyperVVmPath
    Optional. Directory where the Hyper-V VM files and VHDX will be created.
    Default: "C:\Users\Public\Documents\Hyper-V\<cluster-name>"

.PARAMETER HyperVDiskSizeGB
    Optional. Hyper-V OS disk size in GB. Default: 120

.PARAMETER HyperVMemoryStartupGB
    Optional. Hyper-V startup memory in GB. Default: 64

.PARAMETER HyperVProcessorCount
    Optional. Hyper-V virtual processor count. Default: 16

.PARAMETER DiscoveryIsoPath
    Optional. Local path to the SNO Assisted Installer discovery ISO downloaded from console.redhat.com.

.EXAMPLE
    .\setup-logicapps-sno-complete.ps1 -Index 3

.EXAMPLE
    .\setup-logicapps-sno-complete.ps1 -Index 3 -Clean

.EXAMPLE
    .\setup-logicapps-sno-complete.ps1 -Index 3 -Phase 9

.EXAMPLE
    .\setup-logicapps-sno-complete.ps1 -Index 3 -Phase 9,10,11

.EXAMPLE
    .\setup-logicapps-sno-complete.ps1 -Index 1 -Prefix "myteam" -TenantId "your-tenant-id" -SubscriptionName "MySubscription"

.EXAMPLE
    .\setup-logicapps-sno-complete.ps1 -Index 1 -OpenShiftApiUrl "https://api.sno.example.com:6443" -OpenShiftToken "<token>" -MetalLbIpStart "192.168.10.220" -MetalLbIpEnd "192.168.10.230"

.EXAMPLE
    .\setup-logicapps-sno-complete.ps1 -Index 1 -Phase 0,0.8 -PullSecretPath "C:\src\pull-secret.txt" -SnoBaseDomain "lab.example.com" -SnoMachineNetworkCidr "192.168.128.0/24"

.EXAMPLE
    .\setup-logicapps-sno-complete.ps1 -Index 1 -Phase 0.9 -HyperVSwitchName "ExternalSwitch" -DiscoveryIsoPath "C:\isos\sno-discovery.iso"

.NOTES
    Author: psrivas
    Date: 2026-06-05
    Prerequisites: 
      - Azure CLI installed
      - Helm installed
      - Red Hat pull secret for SNO Assisted Installer setup
      - SQL Server instance running on host (or accessible)
      - Network connectivity from the SNO cluster to the Windows host for SMB and SQL Server
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Index,

    [Parameter(Mandatory = $false)]
    [switch]$Clean,

    [Parameter(Mandatory = $false)]
    [string[]]$Phase,

    [Parameter(Mandatory = $false)]
    [string]$Prefix = "psrivas",

    [Parameter(Mandatory = $false)]
    [string]$TenantId = "",

    [Parameter(Mandatory = $false)]
    [string]$SubscriptionName = "",

    [Parameter(Mandatory = $false)]
    [string]$KubeConfigPath = "$env:USERPROFILE\.kube\config",

    [Parameter(Mandatory = $false)]
    [string]$OpenShiftApiUrl = "",

    [Parameter(Mandatory = $false)]
    [string]$OpenShiftUsername = "kubeadmin",

    [Parameter(Mandatory = $false)]
    [string]$OpenShiftPassword = "",

    [Parameter(Mandatory = $false)]
    [string]$OpenShiftToken = "",

    [Parameter(Mandatory = $false)]
    [bool]$SkipTlsVerify = $true,

    [Parameter(Mandatory = $false)]
    [string]$MetalLbIpStart = "",

    [Parameter(Mandatory = $false)]
    [string]$MetalLbIpEnd = "",

    [Parameter(Mandatory = $false)]
    [string]$HostAccessIp = "",

    [Parameter(Mandatory = $false)]
    [string]$SqlServer = "",

    [Parameter(Mandatory = $false)]
    [string]$SqlDatabase = "",

    [Parameter(Mandatory = $false)]
    [string]$SqlUser = "",

    [Parameter(Mandatory = $false)]
    [string]$SqlPassword = "",

    [Parameter(Mandatory = $false)]
    [string]$OpenShiftSourceCidr = "Any",

    [Parameter(Mandatory = $false)]
    [string]$OpenShiftVersionChannel = "stable",

    [Parameter(Mandatory = $false)]
    [string]$OpenShiftToolsDir = "$PSScriptRoot\openshift-tools",

    [Parameter(Mandatory = $false)]
    [string]$PullSecretPath = "$PSScriptRoot\pull-secret.txt",

    [Parameter(Mandatory = $false)]
    [string]$SnoInstallerAssetsDir = "$PSScriptRoot\sno-installer-assets",

    [Parameter(Mandatory = $false)]
    [string]$SnoBaseDomain = "",

    [Parameter(Mandatory = $false)]
    [string]$SshPublicKeyPath = "$env:USERPROFILE\.ssh\id_rsa.pub",

    [Parameter(Mandatory = $false)]
    [string]$SnoMachineNetworkCidr = "",

    [Parameter(Mandatory = $false)]
    [string]$SnoApiVip = "",

    [Parameter(Mandatory = $false)]
    [string]$SnoIngressVip = "",

    [Parameter(Mandatory = $false)]
    [string]$SnoInstallationDisk = "",

    [Parameter(Mandatory = $false)]
    [string]$HyperVVmName = "",

    [Parameter(Mandatory = $false)]
    [string]$HyperVSwitchName = "Default Switch",

    [Parameter(Mandatory = $false)]
    [string]$HyperVVmPath = "",

    [Parameter(Mandatory = $false)]
    [int]$HyperVDiskSizeGB = 120,

    [Parameter(Mandatory = $false)]
    [int]$HyperVMemoryStartupGB = 64,

    [Parameter(Mandatory = $false)]
    [int]$HyperVProcessorCount = 16,

    [Parameter(Mandatory = $false)]
    [string]$DiscoveryIsoPath = ""
)

# ============================================================================
# ERROR HANDLING - Stop execution on any error
# ============================================================================
$ErrorActionPreference = 'Stop'
$VerbosePreference = 'Continue'

# For PowerShell 7.3+: native commands (oc, az, helm) will also respect ErrorActionPreference
if ($PSVersionTable.PSVersion.Major -ge 7 -and $PSVersionTable.PSVersion.Minor -ge 3) {
    $PSNativeCommandUseErrorActionPreference = $true
}

$script:StepCounter = 0
$script:LastStepLabel = ""

function Stop-OnError {
    param(
        [string]$Message = "",
        [string]$Detail = ""
    )
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
        $errorMsg = "Command failed with exit code $LASTEXITCODE."
        if ($script:LastStepLabel) {
            $errorMsg += " Step $($script:StepCounter): $($script:LastStepLabel)"
        } elseif ($Message) {
            $errorMsg += " Step: $Message"
        }
        if (-not [string]::IsNullOrWhiteSpace($Detail)) {
            $errorMsg += " Details: $($Detail.Trim())"
        }
        throw $errorMsg
    }
}

function Get-PreferredHostAccessIp {
    param(
        [string]$OverrideIp
    )

    if ($OverrideIp) {
        return $OverrideIp
    }

    $allIpv4 = @(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.IPAddress -ne "127.0.0.1" -and
        $_.IPAddress -notmatch "^169\."
    })

    $physicalIp = $allIpv4 | Where-Object {
        $_.InterfaceAlias -notmatch "Loopback|vEthernet|Hyper-V|Default Switch|VMware|VirtualBox|WSL|Bluetooth"
    } | Select-Object -First 1 -ExpandProperty IPAddress

    if ($physicalIp) {
        return $physicalIp
    }

    $virtualIp = $allIpv4 | Where-Object {
        $_.InterfaceAlias -match "vEthernet|Hyper-V"
    } | Select-Object -First 1 -ExpandProperty IPAddress

    if ($virtualIp) {
        return $virtualIp
    }

    return ($allIpv4 | Select-Object -First 1 -ExpandProperty IPAddress)
}

# ============================================================================
# CONFIGURATION - Modify these values for your environment
# ============================================================================

function Test-CommandAvailable([string]$Name) {
    $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function New-DynamicSqlPassword {
    # Generates a strong password satisfying SQL Server complexity rules
    $upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    $lower  = 'abcdefghijkmnpqrstuvwxyz'
    $digits = '23456789'
    $special = '!@#$%^&*()-_=+'
    $all = $upper + $lower + $digits + $special
    $pwd = @(
        $upper[(Get-Random -Maximum $upper.Length)]
        $lower[(Get-Random -Maximum $lower.Length)]
        $digits[(Get-Random -Maximum $digits.Length)]
        $special[(Get-Random -Maximum $special.Length)]
    )
    for ($i = 0; $i -lt 20; $i++) { $pwd += $all[(Get-Random -Maximum $all.Length)] }
    -join ($pwd | Sort-Object { Get-Random })
}

function Get-FirstEnvValue {
    param([string[]]$Names)
    foreach ($name in $Names) {
        $value = [Environment]::GetEnvironmentVariable($name)
        if (-not [string]::IsNullOrWhiteSpace($value)) { return $value }
    }
    return ""
}

function Try-ResolveAzureAccountContext {
    if (-not (Test-CommandAvailable -Name 'az')) {
        return $null
    }

    $accountJson = & az account show --query '{tenantId:tenantId,subscriptionId:id,subscriptionName:name}' -o json 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($accountJson)) {
        return $null
    }

    try {
        return $accountJson | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        return $null
    }
}

$script:OpenShiftUsernameWasExplicit = $PSBoundParameters.ContainsKey('OpenShiftUsername')
$script:OpenShiftTokenWasExplicit = $PSBoundParameters.ContainsKey('OpenShiftToken')
$script:OpenShiftPasswordWasExplicit = $PSBoundParameters.ContainsKey('OpenShiftPassword')
$script:OpenShiftApiUrlWasExplicit = $PSBoundParameters.ContainsKey('OpenShiftApiUrl')
$script:KubeConfigPathWasExplicit = $PSBoundParameters.ContainsKey('KubeConfigPath')

if (-not $script:KubeConfigPathWasExplicit) {
    $envKubeConfig = Get-FirstEnvValue @('KUBECONFIG', 'KUBE_CONFIG_PATH')
    if ($envKubeConfig) { $KubeConfigPath = $envKubeConfig }
}
if (-not $script:OpenShiftApiUrlWasExplicit) {
    $envOpenShiftApiUrl = Get-FirstEnvValue @('OPENSHIFT_API_URL')
    if ($envOpenShiftApiUrl) { $OpenShiftApiUrl = $envOpenShiftApiUrl }
}
if (-not $script:OpenShiftTokenWasExplicit) {
    $envOpenShiftToken = Get-FirstEnvValue @('OPENSHIFT_TOKEN')
    if ($envOpenShiftToken) { $OpenShiftToken = $envOpenShiftToken }
}
if (-not $script:OpenShiftPasswordWasExplicit) {
    $envOpenShiftPassword = Get-FirstEnvValue @('OPENSHIFT_PASSWORD')
    if ($envOpenShiftPassword) { $OpenShiftPassword = $envOpenShiftPassword }
}
if (-not $script:OpenShiftUsernameWasExplicit) {
    $envOpenShiftUsername = Get-FirstEnvValue @('OPENSHIFT_USERNAME')
    if ($envOpenShiftUsername) { $OpenShiftUsername = $envOpenShiftUsername }
}

if (-not $TenantId) {
    $TenantId = Get-FirstEnvValue @('AZURE_TENANT_ID', 'ARM_TENANT_ID')
}
if (-not $SubscriptionName) {
    $SubscriptionName = Get-FirstEnvValue @('AZURE_SUBSCRIPTION_NAME', 'ARM_SUBSCRIPTION_NAME')
}

if (-not $TenantId -or -not $SubscriptionName) {
    $azureContext = Try-ResolveAzureAccountContext
    if ($azureContext) {
        if (-not $TenantId -and $azureContext.tenantId) {
            $TenantId = [string]$azureContext.tenantId
        }
        if (-not $SubscriptionName -and $azureContext.subscriptionName) {
            $SubscriptionName = [string]$azureContext.subscriptionName
        }
        if (-not $SubscriptionName -and $azureContext.subscriptionId) {
            $SubscriptionName = [string]$azureContext.subscriptionId
        }
    }
}

$INDEX = $Index
$RESOURCE_GROUP = "${Prefix}-sno-rg" + $INDEX
$CLUSTER_NAME = "${Prefix}-sno" + $INDEX
$LOCATION = "eastus"
$EXTENSION_NAME = "logicapps-aca-extension"
$NAMESPACE = "logicapps-aca-ns"
$CONNECTED_ENV_NAME = "$CLUSTER_NAME-env"
$CUSTOM_LOCATION_NAME = "logicapps-customlocation" + $INDEX
$LOGIC_APP_NAME = "${Prefix}lasno$INDEX"
$METALLB_POOL_NAME = "aca-pool"
$METALLB_L2_ADVERTISEMENT_NAME = "aca-l2"
$METALLB_IP_START = if ($MetalLbIpStart) { $MetalLbIpStart } else { Get-FirstEnvValue @('METALLB_IP_START') }
$METALLB_IP_END = if ($MetalLbIpEnd) { $MetalLbIpEnd } else { Get-FirstEnvValue @('METALLB_IP_END') }
$OPENSHIFT_CLIENT_ZIP_URL = "https://mirror.openshift.com/pub/openshift-v4/clients/ocp/$OpenShiftVersionChannel/openshift-client-windows.zip"
$OPENSHIFT_TOOLS_DIR = $OpenShiftToolsDir
$SNO_INSTALLER_ASSETS_DIR = $SnoInstallerAssetsDir
$HYPERV_VM_NAME = if ($HyperVVmName) { $HyperVVmName } else { "$CLUSTER_NAME-vm" }
$HYPERV_VM_PATH = if ($HyperVVmPath) { $HyperVVmPath } else { "C:\Users\Public\Documents\Hyper-V\$CLUSTER_NAME" }
$HYPERV_VHD_PATH = Join-Path $HYPERV_VM_PATH "$HYPERV_VM_NAME.vhdx"
$DISCOVERY_ISO_PATH = $DiscoveryIsoPath

# Host access IP (used by SMB/SQL access from cluster)
$HostAccessIp = if ($HostAccessIp) { $HostAccessIp } else { Get-FirstEnvValue @('HOST_ACCESS_IP', 'LOGICAPPS_HOST_ACCESS_IP') }
if (-not $HostAccessIp) {
    $HostAccessIp = Get-PreferredHostAccessIp
    Write-Host "  Host access IP (auto): $HostAccessIp"
} else {
    Write-Host "  Host access IP: $HostAccessIp"
}

# SQL Server config (running on Windows host, reachable from SNO pods)
$resolvedSqlServer = if ($SqlServer) { $SqlServer } else { Get-FirstEnvValue @('SQL_SERVER', 'LOGICAPPS_SQL_SERVER', 'SQL_SERVER_FQDN_OR_IP') }
$SQL_SERVER_IP = if ($resolvedSqlServer) { $resolvedSqlServer } else { $HostAccessIp }
Write-Host "  SQL Server IP (host): $SQL_SERVER_IP"
$SQL_DATABASE = if ($SqlDatabase) { $SqlDatabase } else { (Get-FirstEnvValue @('SQL_DATABASE', 'LOGICAPPS_SQL_DATABASE')) }
if (-not $SQL_DATABASE) { $SQL_DATABASE = "logicapp" }
$SQL_USER = if ($SqlUser) { $SqlUser } else { (Get-FirstEnvValue @('SQL_USER', 'LOGICAPPS_SQL_USER', 'SQL_SERVER_USERNAME')) }
if (-not $SQL_USER) { $SQL_USER = "logicappsuser" }
$SQL_PASSWORD = if ($SqlPassword) { $SqlPassword } else { (Get-FirstEnvValue @('SQL_PASSWORD', 'LOGICAPPS_SQL_PASSWORD', 'SQL_SERVER_PASSWORD')) }
$SQL_PASSWORD_GENERATED = $false
if (-not $SQL_PASSWORD) {
    $SQL_PASSWORD = New-DynamicSqlPassword
    $SQL_PASSWORD_GENERATED = $true
    Write-Host "  SQL password: auto-generated (no -SqlPassword/SQL_PASSWORD provided)"
}
$CREDENTIALS_FILE = Join-Path $PSScriptRoot "credentials.txt"
@(
    "# Logic Apps SNO setup credentials (auto-generated $(Get-Date -Format 's'))"
    "SQL_SERVER=$SQL_SERVER_IP"
    "SQL_DATABASE=$SQL_DATABASE"
    "SQL_USER=$SQL_USER"
    "SQL_PASSWORD=$SQL_PASSWORD"
) | Set-Content -Path $CREDENTIALS_FILE -Encoding UTF8
Write-Host "  SQL credentials written to: $CREDENTIALS_FILE"

# SMB Share config (for workflow artifact storage)
$SMB_SHARE_PATH = "C:\storage"
$SMB_SHARE_NAME = "storage"
$SMB_USER = $SQL_USER
$SMB_PASSWORD = $SQL_PASSWORD

# MetalLB IP range (must be routable in the SNO cluster network)
$METALLB_VERSION = "v0.14.9"

# MLLP Configuration (dedicated TCP LoadBalancer bypassing envoy)
$MLLP_PORT = 34900
$MLLP_HOST = "0.0.0.0"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

function Write-Phase {
    param([string]$PhaseNum, [string]$Message)
    if (-not (ShouldRunPhase $PhaseNum)) {
        Write-Host "`n  [SKIP] Phase $PhaseNum : $Message" -ForegroundColor DarkGray
        return $false
    }
    Write-Host ""
    Write-Host "=" * 80 -ForegroundColor Cyan
    Write-Host "  PHASE $PhaseNum : $Message" -ForegroundColor Cyan
    Write-Host "=" * 80 -ForegroundColor Cyan
    Write-Host ""
    return $true
}

function ShouldRunPhase {
    param([string]$PhaseNum)
    if (-not $Phase -or $Phase.Count -eq 0) { return $true }
    return ($Phase -contains $PhaseNum)
}

function Write-Step {
    param([string]$Message)
    $script:StepCounter += 1
    $script:LastStepLabel = $Message
    Write-Host ("  [Step {0:D2}] {1}" -f $script:StepCounter, $Message) -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "  [!] $Message" -ForegroundColor Yellow
}

function Normalize-Text {
    param([AllowNull()]$Value)

    if ($null -eq $Value) {
        return ""
    }

    return $Value.ToString().Trim()
}

function Invoke-OcBestEffort {
    param([string[]]$Arguments)

    $previousNativePreference = $null
    $hadNativePreference = $false
    if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
        $hadNativePreference = $true
        $previousNativePreference = $PSNativeCommandUseErrorActionPreference
        $PSNativeCommandUseErrorActionPreference = $false
    }

    try {
        $output = & oc @Arguments 2>&1
        return Normalize-Text ($output -join [Environment]::NewLine)
    } catch {
        return Normalize-Text $_.Exception.Message
    } finally {
        if ($hadNativePreference) {
            $PSNativeCommandUseErrorActionPreference = $previousNativePreference
        }
    }
}

function Get-OpenShiftFirewallRemoteAddresses {
    param([string]$RequestedCidr)

    if ([string]::IsNullOrWhiteSpace($RequestedCidr) -or $RequestedCidr -eq "Any") {
        return @("Any")
    }

    $cidrs = New-Object 'System.Collections.Generic.List[string]'
    $cidrs.Add($RequestedCidr)

    if (Connect-OpenShiftCluster -BestEffort) {
        $networkJson = Invoke-OcBestEffort -Arguments @('get', 'network.config', 'cluster', '-o', 'json')
        if (-not [string]::IsNullOrWhiteSpace($networkJson)) {
            try {
                $network = $networkJson | ConvertFrom-Json -ErrorAction Stop
                foreach ($entry in @($network.status.clusterNetwork)) {
                    if ($entry.cidr) {
                        $cidrs.Add([string]$entry.cidr)
                    }
                }
                foreach ($entry in @($network.status.serviceNetwork)) {
                    if ($entry) {
                        $cidrs.Add([string]$entry)
                    }
                }
            } catch {
                Write-Warn "Could not parse OpenShift network CIDRs from cluster API. Continuing with '$RequestedCidr' only."
            }
        }
    }

    return @($cidrs | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique)
}

function Ensure-AzExtension {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    # Inspect az exit codes directly instead of letting native command errors abort the script,
    # so a failed *upgrade* that rolls back to a working version does not stop the run.
    $previousNativePreference = $null
    $hadNativePreference = $false
    if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
        $hadNativePreference = $true
        $previousNativePreference = $PSNativeCommandUseErrorActionPreference
        $PSNativeCommandUseErrorActionPreference = $false
    }

    try {
        az extension add --upgrade --yes --name $Name --verbose
        $addExit = $LASTEXITCODE
        if ($addExit -ne 0) {
            # An upgrade can fail (e.g. pip error) yet leave a usable version installed.
            az extension show --name $Name 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Warn "Could not upgrade Azure CLI extension '$Name' (exit $addExit); continuing with the currently installed version."
            } else {
                throw "Azure CLI extension '$Name' could not be installed or upgraded (az exit code $addExit)."
            }
        }
    } finally {
        if ($hadNativePreference) {
            $PSNativeCommandUseErrorActionPreference = $previousNativePreference
        }
    }
}

function Ensure-Directory {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Ensure-ExtensionsApiProxyViaEnvoyInternal {
    param([string]$Namespace)

    $configMapName = "microsoft-app-environment-k8se-extensions-api"
    $deploymentName = "microsoft-app-environment-k8se-extensions-api"
    $desiredProxyPass = "proxy_pass https://microsoft-app-environment-k8se-envoy-internal.$Namespace.svc.cluster.local;"

    Write-Step "Ensuring extensions-api proxies revision traffic through internal envoy"

    $configMapJson = & oc get configmap $configMapName -n $Namespace -o json 2>&1
    Stop-OnError "get extensions-api configmap"

    $configMap = $configMapJson | ConvertFrom-Json
    $sharedConf = Normalize-Text $configMap.data.'shared.conf'
    if ([string]::IsNullOrWhiteSpace($sharedConf)) {
        throw "ConfigMap '$configMapName' does not contain shared.conf."
    }

    if ($sharedConf.Contains($desiredProxyPass)) {
        Write-Host "  extensions-api already proxies via internal envoy." -ForegroundColor DarkGray
        return
    }

    $updatedSharedConf = [regex]::Replace(
        $sharedConf,
        'proxy_pass\s+https://\$rev\.internal\.[^;]+;',
        $desiredProxyPass
    )

    if ($updatedSharedConf -eq $sharedConf) {
        throw "Could not find the expected revision proxy_pass line in shared.conf."
    }

    $patchPayload = @{
        data = @{
            'shared.conf' = $updatedSharedConf
        }
    } | ConvertTo-Json -Depth 4 -Compress

    & oc patch configmap $configMapName -n $Namespace --type merge -p $patchPayload 2>&1 | Out-Null
    Stop-OnError "patch extensions-api configmap"

    & oc rollout restart deployment $deploymentName -n $Namespace 2>&1 | Out-Null
    Stop-OnError "restart extensions-api deployment"

    & oc rollout status deployment $deploymentName -n $Namespace --timeout=180s 2>&1
    Stop-OnError "wait for extensions-api rollout"
}

function Add-ToSessionPath {
    param([string]$Path)

    if (-not [string]::IsNullOrWhiteSpace($Path) -and (Test-Path $Path)) {
        $pathEntries = @($env:PATH -split ';' | Where-Object { $_ })
        if ($Path -notin $pathEntries) {
            $env:PATH = "$Path;$env:PATH"
        }
    }
}

function Refresh-PathFromSystem {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $combined = @($machinePath, $userPath) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    if ($combined.Count -gt 0) {
        $env:PATH = ($combined -join ';')
    }
}

function Install-WingetPackage {
    param(
        [string]$PackageId,
        [string]$CommandName,
        [string[]]$AdditionalPaths = @()
    )

    $existingCommand = Get-Command $CommandName -ErrorAction SilentlyContinue
    if ($existingCommand) {
        return $existingCommand.Source
    }

    $wingetCmd = Get-Command winget -ErrorAction SilentlyContinue
    if (-not $wingetCmd) {
        throw "'winget' is not available, so $CommandName cannot be installed automatically. Install $CommandName manually and re-run the script."
    }

    Write-Step "Installing $CommandName via winget package $PackageId"
    $nativePreferenceWasSet = $false
    $previousNativePreference = $null
    if ($PSVersionTable.PSVersion.Major -ge 7 -and $PSVersionTable.PSVersion.Minor -ge 3) {
        $nativePreferenceWasSet = $true
        $previousNativePreference = $PSNativeCommandUseErrorActionPreference
        $PSNativeCommandUseErrorActionPreference = $false
    }
    try {
        winget install --id $PackageId --exact --silent --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
        $wingetExitCode = $LASTEXITCODE
    } finally {
        if ($nativePreferenceWasSet) {
            $PSNativeCommandUseErrorActionPreference = $previousNativePreference
        }
    }

    Refresh-PathFromSystem
    foreach ($pathEntry in $AdditionalPaths) {
        Add-ToSessionPath -Path $pathEntry
    }

    $installedCommand = Get-Command $CommandName -ErrorAction SilentlyContinue
    if ($installedCommand) {
        return $installedCommand.Source
    }

    if ($wingetExitCode -ne 0) {
        throw "$CommandName installation via winget failed with exit code $wingetExitCode and the command is still not available in PATH."
    }

    if (-not $installedCommand) {
        throw "$CommandName installation completed but the command is still not available in PATH."
    }
}

function Install-ArchiveTool {
    param(
        [string]$ToolName,
        [string]$ZipUrl,
        [string]$DestinationDir
    )

    $existingCommand = Get-Command $ToolName -ErrorAction SilentlyContinue
    if ($existingCommand) {
        return $existingCommand.Source
    }

    Ensure-Directory -Path $DestinationDir
    Add-ToSessionPath -Path $DestinationDir

    $toolExe = Join-Path $DestinationDir "$ToolName.exe"
    if (Test-Path $toolExe) {
        Add-ToSessionPath -Path $DestinationDir
        return $toolExe
    }

    $downloadPath = Join-Path $env:TEMP "$ToolName-download.zip"
    $extractPath = Join-Path $env:TEMP "$ToolName-extract"

    Write-Step "Downloading $ToolName from $ZipUrl"
    Invoke-WebRequest -Uri $ZipUrl -OutFile $downloadPath

    if (Test-Path $extractPath) {
        Remove-Item -Path $extractPath -Recurse -Force -ErrorAction SilentlyContinue
    }

    Expand-Archive -Path $downloadPath -DestinationPath $extractPath -Force
    $archiveTool = Get-ChildItem -Path $extractPath -Filter "$ToolName.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $archiveTool) {
        throw "Downloaded archive from '$ZipUrl' does not contain $ToolName.exe."
    }

    Copy-Item -Path $archiveTool.FullName -Destination $toolExe -Force

    if ($ToolName -eq "oc") {
        $kubectlExe = Get-ChildItem -Path $extractPath -Filter "kubectl.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($kubectlExe) {
            Copy-Item -Path $kubectlExe.FullName -Destination (Join-Path $DestinationDir "kubectl.exe") -Force
        }
    }

    Remove-Item -Path $downloadPath -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $extractPath -Recurse -Force -ErrorAction SilentlyContinue

    Add-ToSessionPath -Path $DestinationDir
    return $toolExe
}

function Install-OcCli {
    return Install-ArchiveTool -ToolName "oc" -ZipUrl $OPENSHIFT_CLIENT_ZIP_URL -DestinationDir $OPENSHIFT_TOOLS_DIR
}

function Install-AzureCli {
    $azureCliPaths = @(
        "${env:ProgramFiles}\Microsoft SDKs\Azure\CLI2\wbin",
        "${env:ProgramFiles(x86)}\Microsoft SDKs\Azure\CLI2\wbin",
        "$env:ProgramFiles\Microsoft SDKs\Azure\CLI2\wbin"
    )
    return Install-WingetPackage -PackageId "Microsoft.AzureCLI" -CommandName "az" -AdditionalPaths $azureCliPaths
}

function Install-HelmCli {
    return Install-WingetPackage -PackageId "Helm.Helm" -CommandName "helm"
}

function Write-SnoAssistedInstallerInputs {
    param([string]$DestinationDir)

    if (-not (Test-Path $PullSecretPath)) {
        throw "Pull secret file not found at '$PullSecretPath'. Download it from Red Hat and re-run the script."
    }

    Ensure-Directory -Path $DestinationDir

    $pullSecret = (Get-Content $PullSecretPath -Raw).Trim()
    if ([string]::IsNullOrWhiteSpace($pullSecret)) {
        throw "Pull secret file '$PullSecretPath' is empty."
    }

    $sshKeyValue = "<set-public-ssh-key>"
    if (-not [string]::IsNullOrWhiteSpace($SshPublicKeyPath) -and (Test-Path $SshPublicKeyPath)) {
        $sshKeyValue = (Get-Content $SshPublicKeyPath -Raw).Trim()
    }

    $baseDomainValue = if ($SnoBaseDomain) { $SnoBaseDomain } else { "<set-base-domain>" }
    $machineNetworkValue = if ($SnoMachineNetworkCidr) { $SnoMachineNetworkCidr } else { "<set-machine-network-cidr>" }
    $apiVipValue = if ($SnoApiVip) { $SnoApiVip } else { "<set-api-vip>" }
    $ingressVipValue = if ($SnoIngressVip) { $SnoIngressVip } else { "<set-ingress-vip>" }
    $installationDiskValue = if ($SnoInstallationDisk) { $SnoInstallationDisk } else { "/dev/disk/by-id/<set-installation-disk>" }

    $summaryPath = Join-Path $DestinationDir "assisted-installer-inputs.json"
    $summary = [ordered]@{
        clusterName = $CLUSTER_NAME
        baseDomain = $baseDomainValue
        installMode = "single-node-openshift"
        pullSecretPath = $PullSecretPath
        sshPublicKeyPath = if (Test-Path $SshPublicKeyPath) { $SshPublicKeyPath } else { "<set-public-ssh-key-path>" }
        sshPublicKey = $sshKeyValue
        machineNetworkCidr = $machineNetworkValue
        apiVip = $apiVipValue
        ingressVip = $ingressVipValue
        installationDisk = $installationDiskValue
        redHatConsoleUrl = "https://console.redhat.com/openshift/assisted-installer/clusters"
        notes = @(
            "Create a new cluster in the Assisted Installer.",
            "Select 'Install single node OpenShift (SNO)'.",
            "Use the clusterName and baseDomain values from this file in the wizard.",
            "Download the discovery ISO from the wizard and boot the target host with it.",
            "Complete the remaining wizard steps and download kubeconfig after install."
        )
    } | ConvertTo-Json -Depth 6

    [System.IO.File]::WriteAllText($summaryPath, $summary, [System.Text.UTF8Encoding]::new($false))
    return $summaryPath
}

function Assert-HyperVConfig {
    if ([string]::IsNullOrWhiteSpace($HyperVSwitchName)) {
        throw "HyperVSwitchName is required for Hyper-V SNO provisioning."
    }

    if ([string]::IsNullOrWhiteSpace($DISCOVERY_ISO_PATH)) {
        throw "DiscoveryIsoPath is required for Hyper-V SNO provisioning. Download the discovery ISO from the Assisted Installer first."
    }

    if (-not (Test-Path $DISCOVERY_ISO_PATH)) {
        throw "Discovery ISO not found at '$DISCOVERY_ISO_PATH'. Download it from console.redhat.com and re-run the script."
    }

    $switch = Get-VMSwitch -Name $HyperVSwitchName -ErrorAction SilentlyContinue
    if (-not $switch) {
        throw "Hyper-V switch '$HyperVSwitchName' was not found. Create the switch in Hyper-V Manager and re-run the script."
    }
}

function Ensure-HyperVVmForSno {
    Assert-HyperVConfig

    if (-not (Get-Module -ListAvailable -Name Hyper-V)) {
        throw "Hyper-V PowerShell module is not available. Enable Hyper-V on this machine and re-run the script."
    }

    Import-Module Hyper-V -ErrorAction Stop
    Ensure-Directory -Path $HYPERV_VM_PATH
    $startupMemoryBytes = [UInt64]$HyperVMemoryStartupGB * 1GB
    $diskSizeBytes = [UInt64]$HyperVDiskSizeGB * 1GB

    $vm = Get-VM -Name $HYPERV_VM_NAME -ErrorAction SilentlyContinue
    if (-not $vm) {
        Write-Step "Creating Hyper-V VM '$HYPERV_VM_NAME'"
        if (Test-Path $HYPERV_VHD_PATH) {
            Write-Host "  Reusing existing VHDX: $HYPERV_VHD_PATH" -ForegroundColor Yellow
            New-VM -Name $HYPERV_VM_NAME -Generation 2 -MemoryStartupBytes $startupMemoryBytes -VHDPath $HYPERV_VHD_PATH -Path $HYPERV_VM_PATH -SwitchName $HyperVSwitchName | Out-Null
        } else {
            New-VM -Name $HYPERV_VM_NAME -Generation 2 -MemoryStartupBytes $startupMemoryBytes -NewVHDPath $HYPERV_VHD_PATH -NewVHDSizeBytes $diskSizeBytes -Path $HYPERV_VM_PATH -SwitchName $HyperVSwitchName | Out-Null
        }
    } else {
        Write-Step "Hyper-V VM '$HYPERV_VM_NAME' already exists"
    }

    Set-VM -Name $HYPERV_VM_NAME -AutomaticCheckpointsEnabled $false -CheckpointType Disabled | Out-Null
    Set-VMProcessor -VMName $HYPERV_VM_NAME -Count $HyperVProcessorCount | Out-Null
    Set-VMMemory -VMName $HYPERV_VM_NAME -DynamicMemoryEnabled $false -StartupBytes $startupMemoryBytes | Out-Null
    Set-VMFirmware -VMName $HYPERV_VM_NAME -EnableSecureBoot Off | Out-Null

    $dvdDrive = Get-VMDvdDrive -VMName $HYPERV_VM_NAME -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $dvdDrive) {
        Add-VMDvdDrive -VMName $HYPERV_VM_NAME -Path $DISCOVERY_ISO_PATH | Out-Null
    } else {
        Set-VMDvdDrive -VMName $HYPERV_VM_NAME -Path $DISCOVERY_ISO_PATH | Out-Null
    }

    $dvdDrive = Get-VMDvdDrive -VMName $HYPERV_VM_NAME | Select-Object -First 1
    $hardDrive = Get-VMHardDiskDrive -VMName $HYPERV_VM_NAME | Select-Object -First 1
    if ($dvdDrive -and $hardDrive) {
        Set-VMFirmware -VMName $HYPERV_VM_NAME -FirstBootDevice $dvdDrive | Out-Null
        Set-VMFirmware -VMName $HYPERV_VM_NAME -BootOrder $dvdDrive, $hardDrive | Out-Null
    }

    Start-VM -Name $HYPERV_VM_NAME | Out-Null
    return (Get-VM -Name $HYPERV_VM_NAME)
}

function Ensure-HostsFileMapping {
    param(
        [Parameter(Mandatory = $true)]
        [string]$HostName,

        [Parameter(Mandatory = $true)]
        [string]$IPAddress
    )

    $hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
    $hostPattern = "(^|\s){0}(\s|$)" -f [regex]::Escape($HostName)
    $existingLines = if (Test-Path $hostsPath) { Get-Content $hostsPath } else { @() }
    $updatedLines = $existingLines | Where-Object { $_ -notmatch $hostPattern }
    $updatedLines += "$IPAddress $HostName"
    [System.IO.File]::WriteAllLines($hostsPath, $updatedLines, [System.Text.UTF8Encoding]::new($false))
    ipconfig /flushdns 2>&1 | Out-Null
}

function Test-TcpEndpoint {
    param(
        [Parameter(Mandatory = $true)]
        [string]$HostName,

        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    return [bool](Test-NetConnection -ComputerName $HostName -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue)
}

function Set-KubeConfigServerOverride {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ResolvedKubeConfigPath,

        [Parameter(Mandatory = $true)]
        [string]$OverrideApiUrl
    )

    $kubeConfigContent = Get-Content $ResolvedKubeConfigPath -Raw
    $serverPattern = '(?m)^(?<indent>\s*)server:\s*(?<server>\S+)\s*$'
    $serverMatch = [regex]::Match($kubeConfigContent, $serverPattern)
    if (-not $serverMatch.Success) {
        throw "Kubeconfig file '$ResolvedKubeConfigPath' does not contain a cluster server entry."
    }

    $originalServerUrl = $serverMatch.Groups['server'].Value
    $originalServerUri = $null
    $overrideServerUri = $null
    try {
        $originalServerUri = [uri]$originalServerUrl
        $overrideServerUri = [uri]$OverrideApiUrl
    } catch {
        throw "OpenShift API URL '$OverrideApiUrl' or kubeconfig server '$originalServerUrl' is not a valid URI."
    }

    $overrideIpAddress = $null
    $overrideIsIpAddress = [System.Net.IPAddress]::TryParse($overrideServerUri.Host, [ref]$overrideIpAddress)

    if ($originalServerUri.Host -ne $overrideServerUri.Host -and $overrideIsIpAddress) {
        Ensure-HostsFileMapping -HostName $originalServerUri.Host -IPAddress $overrideServerUri.Host
        $script:ResolvedKubeConfigPath = $ResolvedKubeConfigPath
    } else {
        $overrideKubeConfigPath = Join-Path ([System.IO.Path]::GetTempPath()) ("{0}-{1}.kubeconfig" -f [System.IO.Path]::GetFileNameWithoutExtension($ResolvedKubeConfigPath), [guid]::NewGuid().ToString("N"))
        $kubeConfigContent = [regex]::Replace($kubeConfigContent, '(?m)^\s*tls-server-name:\s*.+\r?\n?', '')

        $replacement = "{0}server: {1}" -f $serverMatch.Groups['indent'].Value, $OverrideApiUrl
        if ($originalServerUri.Host -ne $overrideServerUri.Host) {
            $replacement = "{0}`r`n{1}tls-server-name: {2}" -f $replacement, $serverMatch.Groups['indent'].Value, $originalServerUri.Host
        }

        $updatedKubeConfigContent = [regex]::Replace($kubeConfigContent, $serverPattern, $replacement, 1)
        [System.IO.File]::WriteAllText($overrideKubeConfigPath, $updatedKubeConfigContent, [System.Text.UTF8Encoding]::new($false))
        $script:ResolvedKubeConfigPath = $overrideKubeConfigPath
    }

    $env:KUBECONFIG = $script:ResolvedKubeConfigPath
}

function Find-ReachableClusterApiUrl {
    $candidateHosts = @(
        "api.$CLUSTER_NAME.test",
        "api.$CLUSTER_NAME.localhost"
    ) | Select-Object -Unique

    foreach ($candidateHost in $candidateHosts) {
        if (Test-TcpEndpoint -HostName $candidateHost -Port 6443) {
            return "https://$candidateHost`:6443"
        }
    }

    return $null
}

function Get-HyperVVmIPAddress {
    param(
        [Parameter(Mandatory = $true)]
        [string]$VmName
    )

    if (-not (Get-Command Get-VM -ErrorAction SilentlyContinue)) {
        return $null
    }

    $vm = Get-VM -Name $VmName -ErrorAction SilentlyContinue
    if (-not $vm) {
        return $null
    }

    $adapters = @(Get-VMNetworkAdapter -VMName $VmName -ErrorAction SilentlyContinue)
    foreach ($adapter in $adapters) {
        # Prefer guest-reported IPv4 addresses when Hyper-V integration services are available.
        $reported = @($adapter.IPAddresses | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' })
        foreach ($ip in $reported) {
            if (Test-TcpEndpoint -HostName $ip -Port 6443) {
                return $ip
            }
        }

        # Fall back to the neighbor (ARP) table, matching the adapter MAC address.
        if (-not [string]::IsNullOrWhiteSpace($adapter.MacAddress)) {
            $macFmt = (($adapter.MacAddress -replace '[:-]', '') -replace '(..)(?=.)', '$1-').ToUpperInvariant()
            $neighbors = @(Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue |
                Where-Object { $_.LinkLayerAddress -eq $macFmt -and $_.State -ne 'Unreachable' } |
                Select-Object -ExpandProperty IPAddress)
            foreach ($ip in $neighbors) {
                if (Test-TcpEndpoint -HostName $ip -Port 6443) {
                    return $ip
                }
            }
        }
    }

    return $null
}

function Ensure-ClusterEndpointResolvable {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ApiUrl
    )

    $apiUri = $null
    try {
        $apiUri = [uri]$ApiUrl
    } catch {
        return
    }

    $apiHost = $apiUri.Host
    if ([string]::IsNullOrWhiteSpace($apiHost)) {
        return
    }

    # IP-based endpoints do not require DNS remediation.
    $parsedIp = $null
    if ([System.Net.IPAddress]::TryParse($apiHost, [ref]$parsedIp)) {
        return
    }

    $apiPort = if ($apiUri.Port -gt 0) { $apiUri.Port } else { 6443 }

    # If the API host already resolves and is reachable, there is nothing to fix.
    $resolves = $false
    try {
        $resolves = [bool](Resolve-DnsName -Name $apiHost -ErrorAction SilentlyContinue)
    } catch {
        $resolves = $false
    }
    if ($resolves -and (Test-TcpEndpoint -HostName $apiHost -Port $apiPort)) {
        return
    }

    # Single Node OpenShift serves the API server and the ingress/apps routes from the node IP.
    $clusterIp = Get-HyperVVmIPAddress -VmName $HYPERV_VM_NAME
    if ([string]::IsNullOrWhiteSpace($clusterIp)) {
        Write-Warn "Cluster endpoint '$apiHost' does not resolve and no reachable IP could be auto-detected from Hyper-V VM '$HYPERV_VM_NAME'. Pass -OpenShiftApiUrl with the cluster IP or add a hosts entry manually."
        return
    }

    # Map the API host and the OpenShift routes needed for password (OAuth) login.
    $hostNames = New-Object System.Collections.Generic.List[string]
    $hostNames.Add($apiHost) | Out-Null
    if ($apiHost -match '^api\.(?<base>.+)$') {
        $baseDomain = $matches['base']
        $hostNames.Add("oauth-openshift.apps.$baseDomain") | Out-Null
        $hostNames.Add("console-openshift-console.apps.$baseDomain") | Out-Null
    }

    foreach ($name in ($hostNames | Select-Object -Unique)) {
        Ensure-HostsFileMapping -HostName $name -IPAddress $clusterIp
    }
    Write-Warn "Cluster endpoint '$apiHost' did not resolve; mapped it (and OpenShift OAuth/console routes) to $clusterIp via the hosts file."
}

function Initialize-KubeConfig {
    Install-OcCli | Out-Null

    if ([string]::IsNullOrWhiteSpace($KubeConfigPath)) {
        return
    }

    if (-not (Test-Path $KubeConfigPath)) {
        if (-not [string]::IsNullOrWhiteSpace($OpenShiftToken) -or -not [string]::IsNullOrWhiteSpace($OpenShiftPassword)) {
            return
        }
        throw "Kubeconfig file not found at '$KubeConfigPath'. Update -KubeConfigPath or provide a valid kubeconfig."
    }

    $resolvedKubeConfig = (Resolve-Path $KubeConfigPath).Path
    if (-not [string]::IsNullOrWhiteSpace($OpenShiftApiUrl)) {
        Set-KubeConfigServerOverride -ResolvedKubeConfigPath $resolvedKubeConfig -OverrideApiUrl $OpenShiftApiUrl
    } else {
        $script:ResolvedKubeConfigPath = $resolvedKubeConfig
        $env:KUBECONFIG = $script:ResolvedKubeConfigPath
    }
}

function Try-ResolveOpenShiftFromCurrentContext {
    $result = [ordered]@{
        ApiUrl = ""
        Token = ""
        Username = ""
    }

    $previousNativePreference = $null
    $hadNativePreference = $false
    if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
        $hadNativePreference = $true
        $previousNativePreference = $PSNativeCommandUseErrorActionPreference
        $PSNativeCommandUseErrorActionPreference = $false
    }

    try {
        $server = Normalize-Text (& oc whoami --show-server 2>$null)
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($server)) {
            $result.ApiUrl = $server
        }

        $user = Normalize-Text (& oc whoami 2>$null)
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($user) -and $user -ne "system:anonymous") {
            $result.Username = $user
        }

        $token = Normalize-Text (& oc whoami -t 2>$null)
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($token) -and $token -notmatch 'Unauthorized|forbidden|error') {
            $result.Token = $token
        }
    } finally {
        if ($hadNativePreference) {
            $PSNativeCommandUseErrorActionPreference = $previousNativePreference
        }
    }

    return [pscustomobject]$result
}

function Connect-OpenShiftCluster {
    param([switch]$BestEffort)

    try {
        Initialize-KubeConfig

        if ($script:OpenShiftConnected) {
            if ($script:ResolvedKubeConfigPath) {
                $env:KUBECONFIG = $script:ResolvedKubeConfigPath
            }
            return $true
        }

        # Make sure the API endpoint resolves before probing the current context, so an
        # already-authenticated kubeconfig (e.g. certificate based) can be reused below.
        if (-not [string]::IsNullOrWhiteSpace($OpenShiftApiUrl)) {
            Ensure-ClusterEndpointResolvable -ApiUrl $OpenShiftApiUrl
        }

        $currentContext = Try-ResolveOpenShiftFromCurrentContext
        if ([string]::IsNullOrWhiteSpace($OpenShiftApiUrl) -and -not [string]::IsNullOrWhiteSpace($currentContext.ApiUrl)) {
            $OpenShiftApiUrl = $currentContext.ApiUrl
            if (-not $BestEffort) {
                Write-Step "Using OpenShift API from current oc context: $OpenShiftApiUrl"
            }
            Ensure-ClusterEndpointResolvable -ApiUrl $OpenShiftApiUrl
        }
        if ([string]::IsNullOrWhiteSpace($OpenShiftToken) -and
            [string]::IsNullOrWhiteSpace($OpenShiftPassword) -and
            -not [string]::IsNullOrWhiteSpace($currentContext.Token)) {
            $OpenShiftToken = $currentContext.Token
            if (-not $BestEffort) {
                Write-Step "Using OpenShift token from current oc session"
            }
        }
        # Never feed a certificate identity (system:*) into a basic-auth login.
        if ((-not $script:OpenShiftUsernameWasExplicit -or $OpenShiftUsername -eq "kubeadmin") -and
            -not [string]::IsNullOrWhiteSpace($currentContext.Username) -and
            $currentContext.Username -notlike "system:*") {
            $OpenShiftUsername = $currentContext.Username
        }

        # If the current kubeconfig context already authenticates, reuse it instead of
        # attempting a fresh basic-auth/token login. A certificate-based admin context
        # (user "system:admin") is valid for kubeconfig auth but invalid for basic auth.
        $contextAuthenticated = (-not [string]::IsNullOrWhiteSpace($currentContext.Username) -and
            $currentContext.Username -ne "system:anonymous")
        if ($contextAuthenticated -and -not $BestEffort) {
            Write-Step "Reusing authenticated kubeconfig context (user: $($currentContext.Username))"
        }

        $skipTlsFlag = "--insecure-skip-tls-verify=$($SkipTlsVerify.ToString().ToLowerInvariant())"

        if (-not $contextAuthenticated -and -not [string]::IsNullOrWhiteSpace($OpenShiftToken)) {
            if ([string]::IsNullOrWhiteSpace($OpenShiftApiUrl)) {
                throw "OpenShiftApiUrl is required when OpenShiftToken is provided."
            }

            $previousNativePreference = $null
            $hadNativePreference = $false
            if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
                $hadNativePreference = $true
                $previousNativePreference = $PSNativeCommandUseErrorActionPreference
                $PSNativeCommandUseErrorActionPreference = $false
            }
            try {
                $loginOutput = & oc login $OpenShiftApiUrl "--token=$OpenShiftToken" $skipTlsFlag --request-timeout=30s 2>&1
            } finally {
                if ($hadNativePreference) {
                    $PSNativeCommandUseErrorActionPreference = $previousNativePreference
                }
            }
            Stop-OnError "oc login with token" ($loginOutput -join "`n")
        } elseif (-not $contextAuthenticated -and -not [string]::IsNullOrWhiteSpace($OpenShiftPassword)) {
            if ([string]::IsNullOrWhiteSpace($OpenShiftApiUrl)) {
                throw "OpenShiftApiUrl is required when OpenShiftPassword is provided."
            }

            $previousNativePreference = $null
            $hadNativePreference = $false
            if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
                $hadNativePreference = $true
                $previousNativePreference = $PSNativeCommandUseErrorActionPreference
                $PSNativeCommandUseErrorActionPreference = $false
            }
            try {
                $loginOutput = & oc login -u $OpenShiftUsername -p $OpenShiftPassword $OpenShiftApiUrl $skipTlsFlag --request-timeout=30s 2>&1
            } finally {
                if ($hadNativePreference) {
                    $PSNativeCommandUseErrorActionPreference = $previousNativePreference
                }
            }
            Stop-OnError "oc login with username/password" ($loginOutput -join "`n")
        } else {
            $previousNativePreference = $null
            $hadNativePreference = $false
            if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
                $hadNativePreference = $true
                $previousNativePreference = $PSNativeCommandUseErrorActionPreference
                $PSNativeCommandUseErrorActionPreference = $false
            }

            try {
                & oc whoami 2>&1 | Out-Null
                $ocWhoAmIExitCode = $LASTEXITCODE
            } finally {
                if ($hadNativePreference) {
                    $PSNativeCommandUseErrorActionPreference = $previousNativePreference
                }
            }

            if ($ocWhoAmIExitCode -ne 0) {
                if ([string]::IsNullOrWhiteSpace($OpenShiftApiUrl)) {
                    $reachableApiUrl = Find-ReachableClusterApiUrl
                    if (-not [string]::IsNullOrWhiteSpace($reachableApiUrl) -and $script:ResolvedKubeConfigPath) {
                        Set-KubeConfigServerOverride -ResolvedKubeConfigPath $script:ResolvedKubeConfigPath -OverrideApiUrl $reachableApiUrl
                        Write-Warn "Current kubeconfig endpoint is not usable. Retrying with detected API endpoint '$reachableApiUrl'."
                        & oc whoami 2>&1 | Out-Null
                        $ocWhoAmIExitCode = $LASTEXITCODE
                    }
                }
            }

            if ($ocWhoAmIExitCode -ne 0) {
                $ocWhoamiError = Invoke-OcBestEffort -Arguments @('whoami')
                throw "OpenShift authentication is not available from the current kubeconfig context. Provide -OpenShiftToken or -OpenShiftPassword, or login with 'oc login' before running the script. oc whoami: $ocWhoamiError"
            }
        }

        $server = Normalize-Text (& oc whoami --show-server 2>$null)
        $context = Normalize-Text (& oc config current-context 2>$null)
        if (-not $BestEffort) {
            if ($server) {
                Write-Step "Connected to OpenShift API: $server"
            }
            if ($context) {
                Write-Step "Using kubeconfig context '$context'"
            }
        }

        $script:OpenShiftConnected = $true
        return $true
    } catch {
        if ($BestEffort) {
            return $false
        }
        throw
    }
}

function Resolve-MetalLbRange {
    function Get-Ipv4OctetsOrNull {
        param([string]$Address)
        if ([string]::IsNullOrWhiteSpace($Address)) { return $null }
        $parts = $Address.Trim() -split '\.'
        if ($parts.Count -ne 4) { return $null }
        $octets = @()
        foreach ($part in $parts) {
            $value = 0
            if (-not [int]::TryParse($part, [ref]$value)) { return $null }
            if ($value -lt 0 -or $value -gt 255) { return $null }
            $octets += $value
        }
        return ,$octets
    }

    function Resolve-PrefixFromHints {
        $hints = @(
            $METALLB_IP_START,
            $METALLB_IP_END,
            $HostAccessIp,
            $SQL_SERVER_IP,
            (Get-OpenShiftNodeIp)
        )
        foreach ($hint in $hints) {
            $octets = Get-Ipv4OctetsOrNull -Address $hint
            if ($octets) { return "$($octets[0]).$($octets[1]).$($octets[2])" }
        }
        return $null
    }

    $prefix = Resolve-PrefixFromHints
    if (-not $prefix) {
        throw "Could not determine a local IPv4 /24 prefix for MetalLB. Provide -MetalLbIpStart and -MetalLbIpEnd."
    }

    $startOctets = Get-Ipv4OctetsOrNull -Address $METALLB_IP_START
    $endOctets = Get-Ipv4OctetsOrNull -Address $METALLB_IP_END

    if ($startOctets -and $endOctets) {
        if ("$($startOctets[0]).$($startOctets[1]).$($startOctets[2])" -ne "$($endOctets[0]).$($endOctets[1]).$($endOctets[2])") {
            throw "MetalLB start/end must be in the same /24 network. Current values: $METALLB_IP_START - $METALLB_IP_END"
        }
        if ($startOctets[3] -ge $endOctets[3]) {
            throw "MetalLB start IP must be less than end IP. Current values: $METALLB_IP_START - $METALLB_IP_END"
        }
        return
    }

    if (-not $startOctets -and -not $endOctets) {
        $randomStartHost = Get-Random -Minimum 200 -Maximum 241
        $script:METALLB_IP_START = "$prefix.$randomStartHost"
        $script:METALLB_IP_END = "$prefix.$($randomStartHost + 9)"
        Write-Step "Auto-selected local MetalLB range: $($script:METALLB_IP_START) - $($script:METALLB_IP_END)"
        return
    }

    if ($startOctets -and -not $endOctets) {
        $startHost = [int]$startOctets[3]
        $endHost = [Math]::Min(254, $startHost + 9)
        if ($endHost -le $startHost) { $endHost = [Math]::Min(254, $startHost + 1) }
        $script:METALLB_IP_START = "$($startOctets[0]).$($startOctets[1]).$($startOctets[2]).$startHost"
        $script:METALLB_IP_END = "$($startOctets[0]).$($startOctets[1]).$($startOctets[2]).$endHost"
        Write-Step "Derived MetalLB end IP from start: $($script:METALLB_IP_START) - $($script:METALLB_IP_END)"
        return
    }

    $endHost = [int]$endOctets[3]
    $startHost = [Math]::Max(1, $endHost - 9)
    if ($startHost -ge $endHost) { $startHost = [Math]::Max(1, $endHost - 1) }
    $script:METALLB_IP_START = "$($endOctets[0]).$($endOctets[1]).$($endOctets[2]).$startHost"
    $script:METALLB_IP_END = "$($endOctets[0]).$($endOctets[1]).$($endOctets[2]).$endHost"
    Write-Step "Derived MetalLB start IP from end: $($script:METALLB_IP_START) - $($script:METALLB_IP_END)"
    return
}

function Assert-MetalLbConfig {
    Resolve-MetalLbRange
    if ([string]::IsNullOrWhiteSpace($METALLB_IP_START) -or [string]::IsNullOrWhiteSpace($METALLB_IP_END)) {
        throw "MetalLB IP range could not be resolved. Provide -MetalLbIpStart and -MetalLbIpEnd."
    }
}

function Get-OpenShiftNodeIp {
    $nodeIp = Normalize-Text (& oc get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>$null)
    if (-not $nodeIp) {
        $nodeIp = Normalize-Text (& oc get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}' 2>$null)
    }
    return $nodeIp
}

function Ensure-OpenShiftNamespace {
    param([string]$Namespace)

    $existingNamespace = Normalize-Text (& oc get namespace $Namespace --ignore-not-found -o name 2>$null)
    if (-not $existingNamespace) {
        Write-Step "Creating namespace '$Namespace'"
        oc create namespace $Namespace --v=4
        Stop-OnError "create namespace $Namespace"
    } else {
        Write-Step "Namespace '$Namespace' already exists"
    }
}

function Wait-ForPods {
    param(
        [string]$Namespace,
        [string]$LabelSelector = "",
        [int]$TimeoutSeconds = 300,
        [int]$ExpectedCount = 1
    )
    $elapsed = 0
    while ($elapsed -lt $TimeoutSeconds) {
        try {
            if ($LabelSelector) {
                $pods = oc get pods -n $Namespace -l $LabelSelector --no-headers 2>&1
            } else {
                $pods = oc get pods -n $Namespace --no-headers 2>&1
            }
        } catch {
            $pods = @()
        }
        $running = ($pods | Where-Object { $_ -match "\s+Running\s+" }).Count
        if ($running -ge $ExpectedCount) {
            Write-Step "All $running pods running in $Namespace"
            return $true
        }
        Start-Sleep -Seconds 10
        $elapsed += 10
        Write-Host "    Waiting... ($elapsed`s / $TimeoutSeconds`s) - $running running" -ForegroundColor DarkGray
    }
    Write-Warn "Timeout waiting for pods in $Namespace"
    return $false
}

# ============================================================================
# PREREQUISITES CHECK
# ============================================================================
if (Write-Phase "0" "Checking Prerequisites") {

Write-Step "Ensuring OpenShift CLI is installed"
$ocPath = Install-OcCli
Write-Step "oc ready: $ocPath"

$azPath = Install-AzureCli
Write-Step "az ready: $azPath"

$helmPath = Install-HelmCli
Write-Step "helm ready: $helmPath"

Write-Step "Checking if SQL Server is installed locally"
$sqlService = Get-Service -Name 'MSSQLSERVER', 'MSSQL$*' -ErrorAction SilentlyContinue
if (-not $sqlService) {
    throw "SQL Server is not installed locally. Please install SQL Server before running this script. (No MSSQLSERVER or named instance service found.)"
}
$runningSql = $sqlService | Where-Object { $_.Status -eq 'Running' }
if (-not $runningSql) {
    throw "SQL Server service found but not running (Status: $($sqlService.Status)). Please start the SQL Server service before running this script."
}
Write-Step "SQL Server is installed and running (Service: $($runningSql.Name))"

} # End Phase 0

# ============================================================================
# PHASE 0.8: PREPARE SNO ASSISTED INSTALLER INPUTS
# ============================================================================
if (Write-Phase "0.8" "Prepare SNO Assisted Installer inputs") {

Write-Step "Ensuring OpenShift tooling is available"
Install-OcCli | Out-Null

Write-Step "Writing SNO Assisted Installer input summary"
$assistedInputsPath = Write-SnoAssistedInstallerInputs -DestinationDir $SNO_INSTALLER_ASSETS_DIR
Write-Step "SNO Assisted Installer input file created at $assistedInputsPath"

Write-Host "  Follow the Assisted Installer flow to create the cluster:" -ForegroundColor Yellow
Write-Host "    1. Open https://console.redhat.com/openshift/assisted-installer/clusters" -ForegroundColor Yellow
Write-Host "    2. Create a new cluster and select 'Install single node OpenShift (SNO)'" -ForegroundColor Yellow
Write-Host "    3. Use the values in `"$assistedInputsPath`" for cluster name, base domain, networking, and SSH key" -ForegroundColor Yellow
Write-Host "    4. Download the discovery ISO from the wizard and boot the target host" -ForegroundColor Yellow
Write-Host "    5. Complete the wizard and download kubeconfig after installation" -ForegroundColor Yellow

} # End Phase 0.8

# ============================================================================
# PHASE 0.9: CREATE HYPER-V VM FOR SNO
# ============================================================================
if (Write-Phase "0.9" "Create and start Hyper-V VM for SNO discovery ISO") {

Write-Step "Creating or updating the Hyper-V VM for SNO"
$hyperVVm = Ensure-HyperVVmForSno

Write-Host "  Hyper-V VM:        $($hyperVVm.Name)" -ForegroundColor White
Write-Host "  State:             $($hyperVVm.State)" -ForegroundColor White
Write-Host "  MemoryStartupGB:   $HyperVMemoryStartupGB" -ForegroundColor White
Write-Host "  ProcessorCount:    $HyperVProcessorCount" -ForegroundColor White
Write-Host "  VHDX:              $HYPERV_VHD_PATH" -ForegroundColor White
Write-Host "  Discovery ISO:     $DISCOVERY_ISO_PATH" -ForegroundColor White
Write-Host "  Switch:            $HyperVSwitchName" -ForegroundColor White
Write-Host "  Next: finish the Assisted Installer workflow in Red Hat console after the VM boots from the discovery ISO." -ForegroundColor Yellow

} # End Phase 0.9

$postInstallerPhases = @("0.5", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "12.5", "13")
if ($Phase -and $Phase.Count -gt 0 -and ($Phase | Where-Object { $_ -in $postInstallerPhases }).Count -eq 0) {
    Write-Step "Requested phases completed"
    return
}

# ============================================================================
# PHASE 0.5: CLEAN SLATE - Remove previous deployments (only if -Clean specified)
# ============================================================================
if ($Clean -and (Write-Phase "0.5" "Clean Slate - Removing previous deployments")) {

# --- Clean up Azure resources ---
Write-Step "Checking for existing Azure resource group: $RESOURCE_GROUP"
$rgExists = az group exists --name $RESOURCE_GROUP 2>&1
if ($rgExists -eq "true") {
    Write-Step "Deleting existing resource group '$RESOURCE_GROUP' (this may take a few minutes)..."
    
    # Delete Logic App extension first (avoids orphaned resources)
    try {
        az k8s-extension delete `
            --resource-group $RESOURCE_GROUP `
            --cluster-type connectedClusters `
            --cluster-name $CLUSTER_NAME `
            --name $EXTENSION_NAME `
            --yes --no-wait 2>&1 | Out-Null
        Write-Host "  Triggered k8s-extension deletion"
    } catch { Write-Host "  No existing k8s-extension to delete (OK)" }

    # Delete connected environment
    try {
        az containerapp connected-env delete `
            --resource-group $RESOURCE_GROUP `
            --name "$CLUSTER_NAME-env" `
            --yes --no-wait 2>&1 | Out-Null
        Write-Host "  Triggered connected-env deletion"
    } catch { Write-Host "  No existing connected-env to delete (OK)" }

    # Disconnect Arc cluster
    try {
        az connectedk8s delete `
            --resource-group $RESOURCE_GROUP `
            --name $CLUSTER_NAME `
            --yes --no-wait 2>&1 | Out-Null
        Write-Host "  Triggered Arc cluster disconnection"
    } catch { Write-Host "  No existing Arc cluster to disconnect (OK)" }

    # Delete the resource group entirely
    az group delete --name $RESOURCE_GROUP --yes --no-wait
    Write-Step "Resource group deletion initiated (async)"
    
    # Wait briefly for deletion to propagate
    Write-Host "  Waiting 30s for Azure resource cleanup to propagate..."
    Start-Sleep -Seconds 30
} else {
    Write-Step "Resource group '$RESOURCE_GROUP' does not exist (clean)"
}

# --- Clean up OpenShift cluster resources (best-effort) ---
Write-Step "Cleaning up cluster namespaces and resources (best-effort)"

$ocAvailable = $false
try {
    if (Get-Command oc -ErrorAction SilentlyContinue) {
        $ocAvailable = Connect-OpenShiftCluster -BestEffort
    }
} catch {}

if ($ocAvailable) {
    # Delete the Logic Apps / ACA namespace (removes all extension pods, logic app pods, envoy, etc.)
    Write-Step "Deleting namespace '$NAMESPACE' (all extension & logic app pods)..."
    try {
        oc delete namespace $NAMESPACE --ignore-not-found --timeout=120s 2>&1 | Out-Null
        Write-Host "    Namespace '$NAMESPACE' deleted"
    } catch { Write-Host "    Namespace deletion timed out or not found (OK)" }

    # Remove MetalLB namespace
    Write-Step "Deleting MetalLB namespace..."
    try {
        oc delete namespace metallb-system --ignore-not-found --timeout=60s 2>&1 | Out-Null
        Write-Host "    metallb-system namespace deleted"
    } catch { Write-Host "    MetalLB namespace deletion timed out or not found (OK)" }

    # Remove Azure Arc helm release and namespace
    Write-Step "Deleting Azure Arc helm release and namespace..."
    try {
        helm delete azure-arc --namespace azure-arc-release --no-hooks 2>&1 | Out-Null
        Write-Host "    Azure Arc helm release deleted"
    } catch { Write-Host "    No Azure Arc helm release to delete (OK)" }
    try {
        oc delete namespace azure-arc --ignore-not-found --timeout=60s 2>&1 | Out-Null
        oc delete namespace azure-arc-release --ignore-not-found --timeout=60s 2>&1 | Out-Null
        Write-Host "    azure-arc namespaces deleted"
    } catch { Write-Host "    Azure Arc namespace deletion timed out or not found (OK)" }

    # Remove stale APIServices that block namespace termination
    Write-Step "Removing stale APIServices (prevents namespace stuck in Terminating)..."
    try {
        oc delete apiservice v1alpha1.containerapp.microsoft.com --ignore-not-found 2>&1 | Out-Null
        oc delete apiservice v1alpha1.extensions.containerapp.microsoft.com --ignore-not-found 2>&1 | Out-Null
        oc delete apiservice v1beta1.external.metrics.k8s.io --ignore-not-found 2>&1 | Out-Null
    } catch {}

    # Force-remove finalizers from stuck namespaces
    Write-Step "Removing finalizers from stuck namespaces..."
    $stuckNamespaces = @($NAMESPACE, "metallb-system", "azure-arc", "azure-arc-release")
    foreach ($ns in $stuckNamespaces) {
        try {
            $nsJson = oc get namespace $ns -o json 2>&1
            if ($nsJson -notmatch "NotFound" -and $nsJson -notmatch "not found") {
                $nsObj = $nsJson | ConvertFrom-Json
                if ($nsObj.status.phase -eq "Terminating") {
                    $nsObj.spec.finalizers = @()
                    ($nsObj | ConvertTo-Json -Depth 10) | oc replace --raw "/api/v1/namespaces/$ns/finalize" -f - 2>&1 | Out-Null
                    Write-Host "    Removed finalizers from '$ns'"
                }
            }
        } catch {}
    }

    # Remove leftover CRDs from extensions
    Write-Step "Removing leftover CRDs..."
    try {
        $crds = oc get crd --no-headers 2>&1 | Where-Object { $_ -match "metallb|containerapp|keda|dapr|k8se" }
        foreach ($line in $crds) {
            $crdName = ($line -split '\s+')[0]
            if ($crdName) {
                oc delete crd $crdName --ignore-not-found --timeout=30s 2>&1 | Out-Null
            }
        }
    } catch {}

    # Reset DNS operator forward zones
    Write-Step "Resetting DNS operator..."
    try {
        oc patch dns.operator.openshift.io default --type=json -p='[{"op":"remove","path":"/spec/servers"}]' 2>&1 | Out-Null
    } catch {}

    # Clean up SCC bindings
    Write-Step "Removing SCC bindings..."
    try {
        oc adm policy remove-scc-from-group privileged "system:serviceaccounts:${NAMESPACE}" 2>&1 | Out-Null
        oc adm policy remove-scc-from-group privileged "system:serviceaccounts:azure-arc" 2>&1 | Out-Null
        oc adm policy remove-scc-from-user privileged "system:serviceaccount:azure-arc:azure-arc-kube-aad-proxy-sa" 2>&1 | Out-Null
        oc adm policy remove-scc-from-user anyuid "system:serviceaccount:metallb-system:controller" 2>&1 | Out-Null
        oc adm policy remove-scc-from-user privileged "system:serviceaccount:metallb-system:speaker" 2>&1 | Out-Null
    } catch {}

    # Remove SMB CSI driver
    Write-Step "Removing SMB CSI driver..."
    try {
        helm uninstall csi-driver-smb --namespace kube-system 2>&1 | Out-Null
        Write-Host "    SMB CSI driver uninstalled"
    } catch { Write-Host "    SMB CSI driver not found (OK)" }

    # Wait briefly for namespaces to terminate (best-effort, non-blocking)
    Write-Step "Waiting for namespaces to fully terminate (max 60s)..."
    $waitMax = 6
    for ($i = 1; $i -le $waitMax; $i++) {
        try {
            $remaining = oc get namespaces --no-headers 2>&1 | Where-Object { $_ -match "Terminating" }
            if (-not $remaining) {
                Write-Host "    All namespaces terminated successfully"
                break
            }
            if ($i -eq $waitMax) { 
                Write-Warn "Some namespaces still terminating - continuing anyway (they will clean up in background)"
            }
        } catch { break }
        Start-Sleep -Seconds 10
    }
} else {
    Write-Step "OpenShift cluster not reachable - skipping cluster cleanup"
}

# --- Clean up Windows host resources ---
Write-Step "Cleaning up Windows firewall rules..."
try {
    Remove-NetFirewallRule -DisplayName "SMB from OpenShift" -ErrorAction SilentlyContinue
    Remove-NetFirewallRule -DisplayName "SQL from OpenShift" -ErrorAction SilentlyContinue
} catch {}

# Wait for Azure RG deletion to complete if it was initiated
if ($rgExists -eq "true") {
    Write-Step "Waiting for Azure resource group deletion to complete..."
    $rgWaitMax = 36  # 6 minutes max
    for ($i = 1; $i -le $rgWaitMax; $i++) {
        $stillExists = az group exists --name $RESOURCE_GROUP 2>&1
        if ($stillExists -ne "true") {
            Write-Step "Resource group '$RESOURCE_GROUP' deleted successfully"
            break
        }
        if ($i -eq $rgWaitMax) {
            Write-Warn "Resource group still deleting after timeout - continuing anyway (async delete in progress)"
        }
        Write-Host "  Waiting... ($($i * 10)s / $($rgWaitMax * 10)s)"
        Start-Sleep -Seconds 10
    }
}

# Recreate the resource group fresh
Write-Step "Creating fresh resource group '$RESOURCE_GROUP'"
az group create --name $RESOURCE_GROUP --location $LOCATION --verbose
Stop-OnError "az group create"
Write-Step "Clean slate ready - all previous resources removed"
} # End Phase 0.5

# Ensure resource group exists (create if not present)
$rgExists = az group exists --name $RESOURCE_GROUP 2>&1
if ($rgExists -ne "true") {
    Write-Step "Creating resource group '$RESOURCE_GROUP'"
    az group create --name $RESOURCE_GROUP --location $LOCATION --verbose
    Stop-OnError "az group create"
}

# ============================================================================
# PHASE 1: OpenShift SNO Access
# ============================================================================
if (Write-Phase "1" "Connect to OpenShift SNO cluster") {

Connect-OpenShiftCluster

Write-Step "Validating cluster connectivity"
oc get nodes --no-headers
Stop-OnError "oc get nodes"

$clusterVersion = Normalize-Text (& oc get clusterversion version -o jsonpath='{.status.desired.version}' 2>$null)
if ($clusterVersion) {
    Write-Step "OpenShift version: $clusterVersion"
}

} # End Phase 1

$clusterRequiredPhases = @("4", "5", "6", "7", "9", "10", "11", "12", "12.5", "13")
if (-not $script:OpenShiftConnected -and (-not $Phase -or ($Phase | Where-Object { $_ -in $clusterRequiredPhases }).Count -gt 0)) {
    Connect-OpenShiftCluster
}

# ============================================================================
# PHASE 2: Windows Host Preparation (SQL + SMB)
# ============================================================================
if (Write-Phase "2" "Windows Host Preparation (SQL Server + SMB Share)") {

Write-Step "Creating local user for SMB/SQL access"
$SecurePass = ConvertTo-SecureString $SMB_PASSWORD -AsPlainText -Force
try {
    New-LocalUser -Name $SMB_USER -Password $SecurePass -FullName "Logic Apps Service User" -Description "Used by OpenShift pods for SMB and SQL" -ErrorAction Stop
    Add-LocalGroupMember -Group "Users" -Member $SMB_USER
    Write-Step "User '$SMB_USER' created"
} catch {
    Write-Warn "User '$SMB_USER' may already exist: $($_.Exception.Message)"
}

Write-Step "Creating SMB share directory"
New-Item -ItemType Directory -Path $SMB_SHARE_PATH -Force | Out-Null

Write-Step "Creating SMB share"
try {
    New-SmbShare -Name $SMB_SHARE_NAME -Path $SMB_SHARE_PATH -FullAccess "Everyone" -ErrorAction Stop
} catch {
    Write-Warn "Share may already exist: $($_.Exception.Message)"
}

Write-Step "Creating host.json for Logic Apps"
$hostJson = @'
{
  "version": "2.0",
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle.Workflows",
    "version": "[1.*, 2.0.0)"
  }
}
'@
Set-Content -Path "$SMB_SHARE_PATH\host.json" -Value $hostJson -Encoding UTF8

Write-Step "Creating Functions/Secrets directory"
New-Item -ItemType Directory -Path "$SMB_SHARE_PATH\Functions\Secrets" -Force | Out-Null

Write-Step "Creating artifacts directories (Schemas, Maps)"
New-Item -ItemType Directory -Path "$SMB_SHARE_PATH\Artifacts\Schemas" -Force | Out-Null
New-Item -ItemType Directory -Path "$SMB_SHARE_PATH\Artifacts\Maps" -Force | Out-Null

Write-Step "Configuring Windows Firewall for SMB (port 445) from OpenShift"
$firewallRemoteAddresses = Get-OpenShiftFirewallRemoteAddresses -RequestedCidr $OpenShiftSourceCidr
if ($firewallRemoteAddresses -contains "Any") {
    Write-Warn "OpenShiftSourceCidr not provided - allowing SMB access from any source. Set -OpenShiftSourceCidr to tighten the firewall rule."
} else {
    Write-Host "  Using SMB firewall source CIDRs: $($firewallRemoteAddresses -join ', ')" -ForegroundColor DarkGray
}
Get-NetFirewallRule -DisplayName "SMB from OpenShift" -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "SMB from OpenShift" -Direction Inbound -Protocol TCP -LocalPort 445 -RemoteAddress $firewallRemoteAddresses -Action Allow -ErrorAction SilentlyContinue | Out-Null

Write-Step "Configuring Windows Firewall for SQL (port 1433) from OpenShift"
if ($firewallRemoteAddresses -contains "Any") {
    Write-Warn "OpenShiftSourceCidr not provided - allowing SQL access from any source. Set -OpenShiftSourceCidr to tighten the firewall rule."
} else {
    Write-Host "  Using SQL firewall source CIDRs: $($firewallRemoteAddresses -join ', ')" -ForegroundColor DarkGray
}
Get-NetFirewallRule -DisplayName "SQL from OpenShift" -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "SQL from OpenShift" -Direction Inbound -Protocol TCP -LocalPort 1433 -RemoteAddress $firewallRemoteAddresses -Action Allow -ErrorAction SilentlyContinue | Out-Null

Write-Step "Creating SQL Server database and login for Logic Apps"
# Connect using Windows Authentication (admin running this script) and create the database + SQL login
$sqlCmdPath = Get-Command sqlcmd -ErrorAction SilentlyContinue
if (-not $sqlCmdPath) {
    # Try common sqlcmd paths
    $sqlCmdCandidates = @(
        "$env:ProgramFiles\Microsoft SQL Server\Client SDK\ODBC\*\Tools\Binn\SQLCMD.EXE",
        "$env:ProgramFiles\Microsoft SQL Server\*\Tools\Binn\SQLCMD.EXE"
    )
    $sqlCmdFound = $sqlCmdCandidates | ForEach-Object { Resolve-Path $_ -ErrorAction SilentlyContinue } | Select-Object -First 1
    if ($sqlCmdFound) {
        $sqlCmdExe = $sqlCmdFound.Path
    } else {
        throw "sqlcmd not found. Please install SQL Server command line tools (sqlcmd) or add it to PATH."
    }
} else {
    $sqlCmdExe = $sqlCmdPath.Source
}

$sqlSetupScript = @"
-- Enable mixed mode authentication (requires restart to take effect if not already enabled)
EXEC xp_instance_regwrite N'HKEY_LOCAL_MACHINE', N'SOFTWARE\Microsoft\MSSQLServer\MSSQLServer', N'LoginMode', REG_DWORD, 2;

-- Create database if not exists
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'$SQL_DATABASE')
BEGIN
    CREATE DATABASE [$SQL_DATABASE];
    PRINT 'Database $SQL_DATABASE created.';
END
ELSE
    PRINT 'Database $SQL_DATABASE already exists.';
GO

-- Create login if not exists
IF NOT EXISTS (SELECT name FROM sys.server_principals WHERE name = N'$SQL_USER')
BEGIN
    CREATE LOGIN [$SQL_USER] WITH PASSWORD = N'$SQL_PASSWORD', CHECK_POLICY = OFF, CHECK_EXPIRATION = OFF;
    PRINT 'Login $SQL_USER created.';
END
ELSE
BEGIN
    ALTER LOGIN [$SQL_USER] WITH PASSWORD = N'$SQL_PASSWORD';
    PRINT 'Login $SQL_USER already exists, password updated.';
END
GO

-- Create user and grant db_owner on the Logic Apps database
USE [$SQL_DATABASE];
GO
IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = N'$SQL_USER')
BEGIN
    -- Check if login is already mapped as dbo, if so remap
    IF EXISTS (SELECT * FROM sys.database_principals WHERE sid = SUSER_SID(N'$SQL_USER') AND name = 'dbo')
    BEGIN
        PRINT 'Login $SQL_USER is already mapped as dbo, skipping CREATE USER.';
    END
    ELSE
    BEGIN
        CREATE USER [$SQL_USER] FOR LOGIN [$SQL_USER];
        PRINT 'User $SQL_USER created in $SQL_DATABASE.';
    END
END
ELSE
BEGIN
    PRINT 'User $SQL_USER already exists in $SQL_DATABASE.';
END
GO
-- Grant db_owner if not already a member
IF IS_ROLEMEMBER('db_owner', N'$SQL_USER') = 0 AND EXISTS (SELECT name FROM sys.database_principals WHERE name = N'$SQL_USER')
BEGIN
    ALTER ROLE db_owner ADD MEMBER [$SQL_USER];
    PRINT 'User $SQL_USER granted db_owner on $SQL_DATABASE.';
END
ELSE
BEGIN
    PRINT 'User $SQL_USER already has db_owner on $SQL_DATABASE or is dbo.';
END
GO
"@

$sqlSetupFile = "$env:TEMP\sno-sql-setup.sql"
Set-Content -Path $sqlSetupFile -Value $sqlSetupScript -Encoding UTF8

Write-Step "Executing SQL setup (Windows Auth as current admin user)..."
& $sqlCmdExe -S "localhost" -E -C -i $sqlSetupFile -b -V 11
Stop-OnError "SQL Server database/login setup"

Remove-Item -Path $sqlSetupFile -Force -ErrorAction SilentlyContinue
Write-Step "SQL Server configured: database '$SQL_DATABASE', login '$SQL_USER' with db_owner"

Write-Step "Restarting SQL Server to apply mixed mode authentication"
Restart-Service -Name 'MSSQLSERVER' -Force -Verbose
Start-Sleep -Seconds 5
Write-Step "SQL Server restarted"

} # End Phase 2

# ============================================================================
# PHASE 3: Azure Provider Registration
# ============================================================================
if (Write-Phase "3" "Azure Login & Provider Registration") {

Write-Step "Logging into Azure"
if (Try-ResolveAzureAccountContext) {
    Write-Host "  Using existing Azure CLI login/session." -ForegroundColor Green
} else {
    if ([string]::IsNullOrWhiteSpace($TenantId)) {
        throw "Azure CLI is not logged in and TenantId was not provided. Run 'az login' first or provide -TenantId."
    }
    az login --tenant $TenantId --verbose
    Stop-OnError "az login"
}

if (-not [string]::IsNullOrWhiteSpace($SubscriptionName)) {
    Write-Step "Setting subscription to '$SubscriptionName'"
    az account set --subscription $SubscriptionName
    Stop-OnError "az account set"
}

Write-Step "Creating resource group"
az group create --name $RESOURCE_GROUP --location $LOCATION --output table --verbose
Stop-OnError "az group create"

Write-Step "Adding Azure CLI extensions"
Ensure-AzExtension -Name connectedk8s
Ensure-AzExtension -Name k8s-extension
Ensure-AzExtension -Name customlocation
Ensure-AzExtension -Name containerapp

Write-Step "Registering providers (this takes ~5 minutes)"
az provider register --namespace Microsoft.Kubernetes --wait --verbose
Stop-OnError "az provider register Microsoft.Kubernetes"
az provider register --namespace Microsoft.KubernetesConfiguration --wait --verbose
Stop-OnError "az provider register Microsoft.KubernetesConfiguration"
az provider register --namespace Microsoft.ExtendedLocation --wait --verbose
Stop-OnError "az provider register Microsoft.ExtendedLocation"
az provider register --namespace Microsoft.Web --wait --verbose
Stop-OnError "az provider register Microsoft.Web"
az provider register --namespace Microsoft.App --wait --verbose
Stop-OnError "az provider register Microsoft.App"
az provider register --namespace Microsoft.OperationalInsights --wait --verbose
Stop-OnError "az provider register Microsoft.OperationalInsights"

} # End Phase 3

# ============================================================================
# PHASE 4: SMB CSI Driver
# ============================================================================
if (Write-Phase "4" "Install SMB CSI Driver") {

Write-Step "Adding Helm repo and installing CSI driver"
helm repo add csi-driver-smb https://raw.githubusercontent.com/kubernetes-csi/csi-driver-smb/master/charts 2>&1 | Out-Null
helm repo update
Stop-OnError "helm repo update"

# Ensure helm uses the selected kubeconfig
if ($script:ResolvedKubeConfigPath) {
    $env:KUBECONFIG = $script:ResolvedKubeConfigPath
}

# Check if already installed
$existing = helm list -n kube-system --filter csi-driver-smb --short 2>$null
if ($existing) {
    Write-Host "  csi-driver-smb already installed, upgrading..."
}
try {
    helm upgrade --install csi-driver-smb csi-driver-smb/csi-driver-smb `
        --namespace kube-system `
        --version v1.15.0 `
        --kube-insecure-skip-tls-verify `
        --wait --timeout 120s
} catch {
    Write-Host "  Retrying without specific version..."
    helm upgrade --install csi-driver-smb csi-driver-smb/csi-driver-smb `
        --namespace kube-system `
        --kube-insecure-skip-tls-verify `
        --wait --timeout 120s
}
Stop-OnError "helm install csi-driver-smb"

} # End Phase 4

# ============================================================================
# PHASE 5: MetalLB Installation
# ============================================================================
if (Write-Phase "5" "Install MetalLB (LoadBalancer for bare-metal/SNO)") {

Assert-MetalLbConfig

Write-Step "Applying MetalLB manifests"
oc apply -f "https://raw.githubusercontent.com/metallb/metallb/$METALLB_VERSION/config/manifests/metallb-native.yaml" --v=4
Stop-OnError "oc apply MetalLB manifests"

Write-Step "Granting SCC to MetalLB service accounts"
Start-Sleep -Seconds 15  # Wait for namespace and SAs to be created
oc adm policy add-scc-to-user anyuid system:serviceaccount:metallb-system:controller --v=4
Stop-OnError "grant anyuid SCC to MetalLB controller"
oc adm policy add-scc-to-user privileged system:serviceaccount:metallb-system:speaker --v=4
Stop-OnError "grant SCC to MetalLB speaker (privileged)"

Write-Step "Waiting for MetalLB workloads to roll out"
Start-Sleep -Seconds 10  # Allow SCC grants and generated secrets to propagate before rollout checks.
oc rollout status deployment/controller -n metallb-system --timeout=180s --v=4
Stop-OnError "wait for MetalLB controller rollout"
oc rollout status daemonset/speaker -n metallb-system --timeout=180s --v=4
Stop-OnError "wait for MetalLB speaker rollout"
oc get pods -n metallb-system --v=4
Stop-OnError "get MetalLB pods"

# Wait for MetalLB webhook endpoints to become available
Write-Step "Waiting for MetalLB webhook endpoints to be ready"
$webhookRetries = 30
for ($i = 1; $i -le $webhookRetries; $i++) {
    $endpoints = oc get endpoints metallb-webhook-service -n metallb-system -o jsonpath='{.subsets[*].addresses[*].ip}' 2>&1
    if ($LASTEXITCODE -eq 0 -and $endpoints) {
        Write-Host "  MetalLB webhook endpoints ready: $endpoints"
        break
    }
    if ($i -eq $webhookRetries) {
        Write-Warn "MetalLB webhook endpoints not ready after $($webhookRetries * 5)s - attempting config anyway"
    }
    Write-Host "  Waiting for webhook endpoints... ($($i * 5)s)"
    Start-Sleep -Seconds 5
}

Write-Step "Configuring MetalLB IP pool and L2 advertisement"
$metallbConfig = @"
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: $METALLB_POOL_NAME
  namespace: metallb-system
spec:
  addresses:
    - $METALLB_IP_START-$METALLB_IP_END
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: $METALLB_L2_ADVERTISEMENT_NAME
  namespace: metallb-system
spec:
  ipAddressPools:
    - $METALLB_POOL_NAME
"@
$metallbConfig | oc apply -f - --v=4
Stop-OnError "apply MetalLB IP pool config"

} # End Phase 5

# ============================================================================
# PHASE 6: Azure Arc Connected Cluster
# ============================================================================
if (Write-Phase "6" "Connect cluster to Azure Arc") {

Write-Step "Granting SCC for Azure Arc (pre-requisite)"
oc adm policy add-scc-to-user privileged system:serviceaccount:azure-arc:azure-arc-kube-aad-proxy-sa --v=4
Stop-OnError "grant SCC for Azure Arc (pre-requisite)"

Write-Step "Connecting cluster to Azure Arc"
az connectedk8s connect --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME --distribution openshift --infrastructure generic --verbose
Stop-OnError "az connectedk8s connect"

Write-Step "Granting SCC for Azure Arc (post-connect)"
oc adm policy add-scc-to-user privileged system:serviceaccount:azure-arc:azure-arc-kube-aad-proxy-sa --v=4
Stop-OnError "grant SCC for Azure Arc (post-connect)"

Write-Step "Verifying Arc connection"
az connectedk8s list --resource-group $RESOURCE_GROUP --output table --verbose
Stop-OnError "az connectedk8s list"

} # End Phase 6

# ============================================================================
# PHASE 7: SCC Permissions for ACA Extension
# ============================================================================
if (Write-Phase "7" "Grant OpenShift SCC Permissions") {

Ensure-OpenShiftNamespace -Namespace $NAMESPACE

Write-Step "Granting privileged SCC to ACA namespace service accounts"
# This MUST be done before extension installation
oc adm policy add-scc-to-group privileged system:serviceaccounts:$NAMESPACE --v=4
Stop-OnError "grant SCC to ACA namespace"
oc adm policy add-scc-to-group privileged system:serviceaccounts:azure-arc --v=4
Stop-OnError "grant SCC to azure-arc namespace"

} # End Phase 7

# ============================================================================
# PHASE 8: Log Analytics Workspace
# ============================================================================
if (Write-Phase "8" "Create Log Analytics Workspace") {

Write-Step "Creating workspace"
az monitor log-analytics workspace create `
    --resource-group $RESOURCE_GROUP `
    --workspace-name $CLUSTER_NAME `
    --verbose
Stop-OnError "az monitor log-analytics workspace create"

$LOG_ANALYTICS_WORKSPACE_ID = az monitor log-analytics workspace show `
    --resource-group $RESOURCE_GROUP `
    --workspace-name $CLUSTER_NAME `
    --query customerId --output tsv `
    --verbose
Stop-OnError "az monitor log-analytics workspace show"

$LOG_ANALYTICS_WORKSPACE_ID_ENC = [Convert]::ToBase64String(
    [System.Text.Encoding]::UTF8.GetBytes($LOG_ANALYTICS_WORKSPACE_ID))

$LOG_ANALYTICS_KEY = az monitor log-analytics workspace get-shared-keys `
    --resource-group $RESOURCE_GROUP `
    --workspace-name $CLUSTER_NAME `
    --query primarySharedKey --output tsv `
    --verbose
Stop-OnError "az monitor log-analytics workspace get-shared-keys"

$LOG_ANALYTICS_KEY_ENC = [Convert]::ToBase64String(
    [System.Text.Encoding]::UTF8.GetBytes($LOG_ANALYTICS_KEY))

} # End Phase 8

# ============================================================================
# PHASE 9: Install ACA Extension
# ============================================================================
if (Write-Phase "9" "Install ACA (Container Apps) Extension") {

Assert-MetalLbConfig
Ensure-OpenShiftNamespace -Namespace $NAMESPACE

Write-Step "Ensuring privileged SCC on ACA namespace"
oc adm policy add-scc-to-group privileged system:serviceaccounts:$NAMESPACE --v=4
Stop-OnError "grant SCC to ACA namespace"

$staticIp = Get-OpenShiftNodeIp
if ($staticIp) {
    Write-Step "OpenShift node IP: $staticIp"
}

Write-Step "Installing k8s-extension (Microsoft.App.Environment)"

# Clean up cluster-scoped resources from previous extension installs that may conflict
Write-Host "  Cleaning stale Helm-managed cluster resources from prior installs..."
# Delete ALL cluster-scoped resources labeled with any previous extension release name
$oldReleaseLabels = @("app.kubernetes.io/instance=logicapps-aca-extension", "app.kubernetes.io/instance=${EXTENSION_NAME}")
foreach ($label in $oldReleaseLabels) {
    oc delete priorityclass -l $label --ignore-not-found 2>&1 | Out-Null
    oc delete clusterrole,clusterrolebinding -l $label --ignore-not-found 2>&1 | Out-Null
    oc delete mutatingwebhookconfiguration,validatingwebhookconfiguration -l $label --ignore-not-found 2>&1 | Out-Null
}

# Remove stale ExtensionConfig that may be stuck with finalizers from a previous failed install.
# The config-agent cannot delete these on its own when the namespace is recreated, causing an
# infinite "Unable to delete the old extension config" retry loop.
Write-Host "  Checking for stale ExtensionConfig resources..."
$staleEC = Invoke-OcBestEffort @("get", "extensionconfig", $EXTENSION_NAME, "-n", $NAMESPACE, "-o", "jsonpath={.metadata.deletionTimestamp}")
if ($staleEC -and $staleEC -notmatch "NotFound|not found|the server doesn't have a resource type|error") {
    Write-Host "  Found stale ExtensionConfig with deletionTimestamp=$staleEC — removing finalizers..."
    $server = oc whoami --show-server
    $token = oc whoami -t
    curl.exe -k -s -X PATCH "$server/apis/clusterconfig.azure.com/v1beta1/namespaces/$NAMESPACE/extensionconfigs/$EXTENSION_NAME" `
        -H "Authorization: Bearer $token" `
        -H "Content-Type: application/merge-patch+json" `
        -d '{"metadata":{"finalizers":null}}' -o NUL -w "%{http_code}"
    Write-Host ""
    Start-Sleep -Seconds 5
    Write-Host "  Stale ExtensionConfig cleaned up."
} else {
    # Also handle the case where ExtensionConfig exists without deletionTimestamp but from a prior install
    $existingEC = Invoke-OcBestEffort @("get", "extensionconfig", $EXTENSION_NAME, "-n", $NAMESPACE, "--no-headers")
    if ($existingEC -and $existingEC -notmatch "NotFound|not found|the server doesn't have a resource type|error|No resources") {
        Write-Host "  Existing ExtensionConfig found — deleting for clean reinstall..."
        $server = oc whoami --show-server
        $token = oc whoami -t
        # Remove finalizers first to prevent hang
        curl.exe -k -s -X PATCH "$server/apis/clusterconfig.azure.com/v1beta1/namespaces/$NAMESPACE/extensionconfigs/$EXTENSION_NAME" `
            -H "Authorization: Bearer $token" `
            -H "Content-Type: application/merge-patch+json" `
            -d '{"metadata":{"finalizers":null}}' -o NUL -w "%{http_code}"
        Write-Host ""
        oc delete extensionconfig $EXTENSION_NAME -n $NAMESPACE --timeout=30s 2>&1 | Out-Null
        Start-Sleep -Seconds 5
    }
}

# Remove orphaned K8se CRDs that may block Helm install with "invalid ownership metadata" errors.
# Helm requires CRDs it manages to have proper labels/annotations; leftover CRDs from partial
# uninstalls will cause "cannot be imported into the current release" failures.
Write-Host "  Removing orphaned K8se CRDs from prior installs..."
$k8seCrds = oc get crd --no-headers 2>&1 | Select-String "k8se.microsoft.com" | ForEach-Object { ($_ -split '\s+')[0] }
foreach ($crd in $k8seCrds) {
    $managedBy = oc get crd $crd -o jsonpath='{.metadata.labels.app\.kubernetes\.io/managed-by}' 2>&1
    if ($managedBy -ne "Helm") {
        Write-Host "    Deleting orphaned CRD: $crd"
        oc delete crd $crd --ignore-not-found 2>&1 | Out-Null
    }
}

# Clean up any stale Helm release secrets
Write-Host "  Removing stale Helm release secrets..."
oc delete secrets -n $NAMESPACE -l "name=$EXTENSION_NAME,owner=helm" --ignore-not-found 2>&1 | Out-Null

az k8s-extension create `
    --resource-group $RESOURCE_GROUP `
    --name $EXTENSION_NAME `
    --cluster-type connectedClusters `
    --cluster-name $CLUSTER_NAME `
    --extension-type 'Microsoft.App.Environment' `
    --release-train stable `
    --auto-upgrade-minor-version true `
    --scope cluster `
    --release-namespace $NAMESPACE `
    --configuration-settings "Microsoft.CustomLocation.ServiceAccount=default" `
    --configuration-settings "appsNamespace=${NAMESPACE}" `
    --configuration-settings "clusterName=${CONNECTED_ENV_NAME}" `
    --configuration-settings "keda.enabled=true" `
    --configuration-settings "keda.logicAppsScaler.enabled=true" `
    --configuration-settings "keda.logicAppsScaler.replicaCount=1" `
    --configuration-settings "containerAppController.api.functionsServerEnabled=true" `
    --configuration-settings "functionsProxyApiConfig.enabled=true" `
    --configuration-settings "Azure.Cluster.Distribution=openshift" `
    --configuration-settings "coreDNSVersion=1.8.6" `
    --configuration-settings "envoy.annotations.service.beta.kubernetes.io/azure-load-balancer-resource-group=${RESOURCE_GROUP}" `
    --configuration-settings "envoy.annotations.metallb.universe.tf/address-pool=${METALLB_POOL_NAME}" `
    --configuration-settings "envoy.config.loadBalancerIP=${METALLB_IP_START}" `
    --configuration-settings "logProcessor.appLogs.destination=log-analytics" `
    --configuration-protected-settings "logProcessor.appLogs.logAnalyticsConfig.customerId=${LOG_ANALYTICS_WORKSPACE_ID_ENC}" `
    --configuration-protected-settings "logProcessor.appLogs.logAnalyticsConfig.sharedKey=${LOG_ANALYTICS_KEY_ENC}" `
    --verbose
Stop-OnError "az k8s-extension create"

Write-Step "Waiting for extension pods to come up (this can take 5-10 minutes)..."
$podsReady = Wait-ForPods -Namespace $NAMESPACE -TimeoutSeconds 600 -ExpectedCount 20
if (-not $podsReady) { throw "ACA extension pods failed to become ready within timeout." }

# Fix: The extension install sometimes creates the log-processor-apps-la secret with 0 data keys,
# causing the fluent-bit container to fail with CreateContainerConfigError looking for
# LOG_ANALYTICS_CUSTOMER_ID. Ensure the secret is populated with the correct values.
Write-Step "Ensuring log-processor Log Analytics secret is populated"
$laSecretName = "microsoft-app-environment-k8se-log-processor-apps-la"
$laSecretKeys = oc get secret $laSecretName -n $NAMESPACE -o jsonpath='{.data}' 2>&1
if (-not $laSecretKeys -or $laSecretKeys -eq '{}') {
    Write-Host "  Log Analytics secret is empty — populating with workspace credentials..."
    $idB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($LOG_ANALYTICS_WORKSPACE_ID))
    $keyB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($LOG_ANALYTICS_KEY))
    $laPatchJson = '{"data":{"LOG_ANALYTICS_CUSTOMER_ID":"' + $idB64 + '","LOG_ANALYTICS_SHARED_KEY":"' + $keyB64 + '"}}'
    oc patch secret $laSecretName -n $NAMESPACE --type=merge -p $laPatchJson
    Stop-OnError "patch log-processor Log Analytics secret"
    # Restart the log-processor pod to pick up the fixed secret
    oc delete pod -n $NAMESPACE -l app=microsoft-app-environment-k8se-log-processor --ignore-not-found 2>&1 | Out-Null
    Write-Host "  Log-processor pod restarted with correct credentials."
} else {
    Write-Host "  Log Analytics secret already populated — OK."
}

} # End Phase 9

# ============================================================================
# PHASE 10: Custom Location, Connected Environment & DNS Setup
# ============================================================================
if (Write-Phase "10" "Create Custom Location, Connected Environment & DNS") {

$EXTENSION_ID = az k8s-extension show `
    --cluster-type connectedClusters `
    --cluster-name $CLUSTER_NAME `
    --resource-group $RESOURCE_GROUP `
    --name $EXTENSION_NAME `
    --query id --output tsv `
    --verbose

$CONNECTED_CLUSTER_ID = az connectedk8s show `
    --resource-group $RESOURCE_GROUP `
    --name $CLUSTER_NAME `
    --query id --output tsv `
    --verbose

Write-Step "Creating custom location '$CUSTOM_LOCATION_NAME'"
az customlocation create `
    --resource-group $RESOURCE_GROUP `
    --name $CUSTOM_LOCATION_NAME `
    --host-resource-id $CONNECTED_CLUSTER_ID `
    --namespace $NAMESPACE `
    --cluster-extension-ids $EXTENSION_ID `
    --location $LOCATION `
    --verbose
Stop-OnError "az customlocation create"

$CUSTOM_LOCATION_ID = az customlocation show `
    --resource-group $RESOURCE_GROUP `
    --name $CUSTOM_LOCATION_NAME `
    --query id --output tsv `
    --verbose
Stop-OnError "get custom location ID"
if (-not $CUSTOM_LOCATION_ID) {
    throw "Custom location ID is empty - creation may have failed."
}
Write-Host "  Custom Location ID: $CUSTOM_LOCATION_ID"

# Wait for Arc connected cluster to be in 'Connected' state
Write-Step "Waiting for Arc connected cluster to be fully connected..."
$arcRetries = 18
for ($i = 1; $i -le $arcRetries; $i++) {
    try {
        $arcStatus = az connectedk8s show `
            --resource-group $RESOURCE_GROUP `
            --name $CLUSTER_NAME `
            --query "connectivityStatus" --output tsv 2>&1
    } catch { $arcStatus = "" }
    if ($arcStatus -eq "Connected") {
        Write-Step "Arc cluster is Connected"
        break
    }
    if ($i -eq $arcRetries) {
        Write-Warn "Arc cluster not in Connected state after timeout (state: $arcStatus)"
    }
    Write-Host "  Waiting... state=$arcStatus ($($i * 10)s / $($arcRetries * 10)s)"
    Start-Sleep -Seconds 10
}

Write-Step "Creating connected environment"
az containerapp connected-env create `
    --resource-group $RESOURCE_GROUP `
    --name $CONNECTED_ENV_NAME `
    --custom-location $CUSTOM_LOCATION_ID `
    --location $LOCATION `
    --verbose
Stop-OnError "az containerapp connected-env create"

# Wait for connected environment to be provisioned
Write-Step "Waiting for connected environment to be ready..."
$envRetries = 18
for ($i = 1; $i -le $envRetries; $i++) {
    try {
        $envState = az containerapp connected-env show `
            --resource-group $RESOURCE_GROUP `
            --name $CONNECTED_ENV_NAME `
            --query "provisioningState" --output tsv 2>&1
    } catch { $envState = "" }
    if ($envState -eq "Succeeded") {
        Write-Step "Connected environment provisioned successfully"
        break
    }
    if ($i -eq $envRetries) {
        Write-Warn "Connected environment not ready after timeout (state: $envState)"
    }
    Write-Host "  Waiting... state=$envState ($($i * 10)s / $($envRetries * 10)s)"
    Start-Sleep -Seconds 10
}

Write-Step "Waiting for envoy LoadBalancer service to receive a MetalLB IP"
$envoyExternalIp = ""
$envoyRetries = 36
for ($i = 1; $i -le $envoyRetries; $i++) {
    try {
        $envoyExternalIp = Normalize-Text (& oc get svc microsoft-app-environment-k8se-envoy -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>$null)
    } catch {
        $envoyExternalIp = ""
    }

    if ($envoyExternalIp) {
        Write-Step "Envoy external IP assigned: $envoyExternalIp"
        break
    }

    if ($i -eq $envoyRetries) {
        throw "Envoy LoadBalancer service did not receive an external IP from MetalLB within timeout."
    }

    Write-Host "  Waiting for envoy external IP... ($($i * 10)s / $($envoyRetries * 10)s)" -ForegroundColor DarkGray
    Start-Sleep -Seconds 10
}

Write-Step "Configuring CoreDNS for OpenShift with az containerapp arc setup-core-dns"
az containerapp arc setup-core-dns --distro=openshift --verbose
Stop-OnError "az containerapp arc setup-core-dns"

Write-Step "Validating DNS operator configuration"
oc get dns.operator.openshift.io default -o yaml
Stop-OnError "get DNS operator configuration"

Write-Step "Normalizing extensions-api revision proxy"
Ensure-ExtensionsApiProxyViaEnvoyInternal -Namespace $NAMESPACE

} # End Phase 10

# ============================================================================
# PHASE 11: Link Storage to Connected Environment & Create Logic App
# ============================================================================
if (Write-Phase "11" "Link Storage, Create Container App & Logic App Extension") {

$CONNECTED_ENV_ID = az containerapp connected-env show `
    --resource-group $RESOURCE_GROUP `
    --name $CONNECTED_ENV_NAME `
    --query id --output tsv `
    --verbose
Stop-OnError "get connected environment ID"
if (-not $CONNECTED_ENV_ID) {
    throw "Connected environment ID is empty - connected environment '$CONNECTED_ENV_NAME' may not exist yet."
}
Write-Host "  Connected Environment ID: $CONNECTED_ENV_ID"

$STORAGE_NAME = "smbstorage1"

# --- Step 12a: Link SMB storage to the connected environment ---
Write-Step "Linking SMB storage to connected environment"

$storageBody = @{
    properties = @{
        smb = @{
            host     = $SQL_SERVER_IP
            shareName = $SMB_SHARE_NAME
            username  = $SMB_USER
            password  = $SMB_PASSWORD
            accessMode = "ReadWrite"
        }
    }
} | ConvertTo-Json -Depth 5

$storageBodyFile = "$env:TEMP\storage-body.json"
[System.IO.File]::WriteAllText($storageBodyFile, $storageBody, [System.Text.UTF8Encoding]::new($false))

az rest --method PUT `
    --url "${CONNECTED_ENV_ID}/storages/${STORAGE_NAME}?api-version=2024-02-02-preview" `
    --body "@$storageBodyFile" `
    --verbose
Stop-OnError "link SMB storage to connected environment"
Remove-Item $storageBodyFile -Force -ErrorAction SilentlyContinue
Write-Step "Storage '$STORAGE_NAME' linked to connected environment"

# --- Step 12b: Create Container App with kind=workflowapp using ARM REST API ---
Write-Step "Creating Logic App container app (kind=workflowapp) via ARM"

$CUSTOM_LOCATION_ID = az customlocation show `
    --resource-group $RESOURCE_GROUP `
    --name $CUSTOM_LOCATION_NAME `
    --query id --output tsv
Stop-OnError "get custom location ID for container app"

$logicAppAuthEncryptionKeyBytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($logicAppAuthEncryptionKeyBytes)
$logicAppAuthEncryptionKey = [Convert]::ToBase64String($logicAppAuthEncryptionKeyBytes)

$containerAppBody = @{
    type     = "Microsoft.App/containerApps"
    kind     = "workflowapp"
    location = $LOCATION
    extendedLocation = @{
        name = $CUSTOM_LOCATION_ID
        type = "CustomLocation"
    }
    properties = @{
        environmentId = $CONNECTED_ENV_ID
        configuration = @{
            secrets = @(
                @{ name = "sqlconnection"; value = "Server=$SQL_SERVER_IP;Database=$SQL_DATABASE;User Id=$SQL_USER;Password=$SQL_PASSWORD;TrustServerCertificate=True;" }
                @{ name = "websiteencryptionkey"; value = $logicAppAuthEncryptionKey }
            )
            activeRevisionsMode = "Single"
            ingress = @{
                external      = $true
                targetPort    = 8080
                allowInsecure = $true
            }
        }
        template = @{
            containers = @(
                @{
                    image = "mcr.microsoft.com/azurelogicapps/logicapps-base:latest"
                    name  = "logicapps-container"
                    command = @("/bin/bash", "-c", "ln -sf /home/site/wwwroot/Artifacts /home/artifacts; update-ca-certificates || true; if [ `"`$IS_ZIP_DEPLOY_ENABLED`" = `"true`" ]; then /Scripts/initWithZipDeploy.sh; else /Scripts/init.sh; fi")
                    env   = @(
                        @{ name = "AzureWebJobsSecretStorageType"; value = "files" }
                        @{ name = "APP_KIND"; value = "workflowapp" }
                        @{ name = "FUNCTIONS_EXTENSION_VERSION"; value = "~4" }
                        @{ name = "AzureFunctionsJobHost__extensionBundle__id"; value = "Microsoft.Azure.Functions.ExtensionBundle.Workflows" }
                        @{ name = "AzureFunctionsJobHost__extensionBundle__version"; value = "[1.*,2.0.0)" }
                        @{ name = "WEBSITE_USE_PLACEHOLDER_DOTNETISOLATED"; value = "1" }
                        @{ name = "TARGET_BASED_SCALING_ENABLED"; value = "1" }
                        @{ name = "WEBSITES_PORT"; value = "8080" }
                        @{ name = "ASPNETCORE_URLS"; value = "http://+:80;http://+:8080" }
                        @{ name = "ASPNETCORE_HTTP_PORTS"; value = "80;8080" }
                        @{ name = "FUNCTIONS_HTTPWORKER_PORT"; value = "80" }
                        @{ name = "HTTP_PLATFORM_PORT"; value = "80" }
                        @{ name = "CONTAINER_APP_PORT"; value = "8080" }
                        @{ name = "WEBSITE_SITE_NAME"; value = $LOGIC_APP_NAME }
                        @{ name = "WEBSITE_AUTH_ENCRYPTION_KEY"; secretRef = "websiteencryptionkey" }
                        @{ name = "Workflows.Sql.ConnectionString"; value = "Server=$SQL_SERVER_IP;Database=$SQL_DATABASE;User Id=$SQL_USER;Password=$SQL_PASSWORD;TrustServerCertificate=True;" }
                    )
                    resources = @{
                        cpu    = 2.0
                        memory = "4.0Gi"
                    }
                    volumeMounts = @(
                        @{
                            volumeName = $STORAGE_NAME
                            mountPath  = "/home/site/wwwroot"
                        }
                    )
                }
            )
            scale = @{
                minReplicas = 1
                maxReplicas = 30
            }
            volumes = @(
                @{
                    name        = $STORAGE_NAME
                    storageName = $STORAGE_NAME
                    storageType = "Smb"
                }
            )
        }
    }
} | ConvertTo-Json -Depth 10

$subscriptionId = az account show --query id --output tsv
Stop-OnError "get subscription ID"

$containerAppUrl = "https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.App/containerApps/${LOGIC_APP_NAME}?api-version=2024-02-02-preview"

$containerAppFile = "$env:TEMP\containerapp-body.json"
[System.IO.File]::WriteAllText($containerAppFile, $containerAppBody, [System.Text.UTF8Encoding]::new($false))

az rest --method PUT `
    --url $containerAppUrl `
    --body "@$containerAppFile" `
    --verbose
Stop-OnError "create container app (ARM PUT)"
Remove-Item $containerAppFile -Force -ErrorAction SilentlyContinue

Write-Step "Waiting for Logic App container app pods..."
Start-Sleep -Seconds 30
Wait-ForPods -Namespace $NAMESPACE -LabelSelector "containerapps.io/app-name=$LOGIC_APP_NAME" -TimeoutSeconds 300

# --- Step 12b-fix: Wait for pod to be fully ready and verify ingress routing ---
# With targetPort=8080, the envoy-controller accepts the AppRoute without issues.
# The service selector "project:doesnotexist" is the K8se activator pattern for scale-to-zero
# and is expected — envoy routes via xDS/EDS, not K8s service endpoints.
Write-Step "Waiting for Logic App pod to stabilize (3/3 containers)..."
$stabilizeRetries = 12
for ($i = 1; $i -le $stabilizeRetries; $i++) {
    $podReady = oc get pods -n $NAMESPACE -l "containerapps.io/app-name=$LOGIC_APP_NAME" -o jsonpath='{.items[0].status.containerStatuses[*].ready}' 2>&1
    if ($podReady -match "true true true") {
        Write-Step "Logic App pod is fully ready (3/3 containers)"
        break
    }
    if ($i -eq $stabilizeRetries) {
        Write-Warn "Pod not fully stabilized after $($stabilizeRetries * 10)s - continuing"
    }
    Start-Sleep -Seconds 10
}

# --- Step 12c: Create Logic App Extension resource ---
Write-Step "Creating Logic App extension (Microsoft.App/logicApps)"

$logicAppExtBody = @{
    type     = "Microsoft.App/logicApps"
    location = $LOCATION
    properties = @{}
} | ConvertTo-Json -Depth 5

$logicAppExtUrl = "https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.App/containerApps/${LOGIC_APP_NAME}/providers/Microsoft.App/logicApps/${LOGIC_APP_NAME}?api-version=2024-02-02-preview"

$logicAppExtFile = "$env:TEMP\logicapp-ext-body.json"
[System.IO.File]::WriteAllText($logicAppExtFile, $logicAppExtBody, [System.Text.UTF8Encoding]::new($false))

az rest --method PUT `
    --url $logicAppExtUrl `
    --body "@$logicAppExtFile" `
    --verbose
Stop-OnError "create Logic App extension"
Remove-Item $logicAppExtFile -Force -ErrorAction SilentlyContinue
Write-Step "Logic App extension created successfully"

# --- Step 12d: Validate volume mount ---
Write-Step "Validating volume mount on container app..."
Start-Sleep -Seconds 15

$appJson = az rest --method GET --url $containerAppUrl 2>&1 | ConvertFrom-Json
$volumes = $appJson.properties.template.volumes
$mounts = $appJson.properties.template.containers[0].volumeMounts

$volumeFound = $volumes | Where-Object { $_.name -eq $STORAGE_NAME -and $_.storageName -eq $STORAGE_NAME }
$mountFound = $mounts | Where-Object { $_.volumeName -eq $STORAGE_NAME -and $_.mountPath -eq "/home/site/wwwroot" }

if ($volumeFound -and $mountFound) {
    Write-Step "Volume mount validated: $STORAGE_NAME -> /home/site/wwwroot"
} else {
    Write-Warn "Volume mount validation failed! Expected volume '$STORAGE_NAME' mounted at '/home/site/wwwroot'"
    Write-Host "  Volumes: $($volumes | ConvertTo-Json -Compress)" -ForegroundColor Yellow
    Write-Host "  Mounts:  $($mounts | ConvertTo-Json -Compress)" -ForegroundColor Yellow
    throw "Volume mount validation failed - container app may not have correct storage configuration."
}

# --- Step 12e: Update host secrets to match app identity ---
Write-Step "Updating host secrets to match deployed app identity"
$appPod = oc get pods -n $NAMESPACE -l "containerapps.io/app-name=$LOGIC_APP_NAME" --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>&1
if ($appPod) {
    $appFQDN = $appJson.properties.configuration.ingress.fqdn
    $appEncKey = oc exec $appPod -n $NAMESPACE -c logicapps-container -- printenv WEBSITE_AUTH_ENCRYPTION_KEY 2>&1
    Write-Host "  App FQDN: $appFQDN"

    $secretsFile = "$SMB_SHARE_PATH\Functions\Secrets\host.json"
    if (Test-Path $secretsFile) {
        $secrets = Get-Content $secretsFile -Raw | ConvertFrom-Json
        $needsUpdate = ($secrets.hostName -ne $appFQDN) -or ($secrets.decryptionKeyId -notlike "*$appEncKey*")
        if ($needsUpdate) {
            Write-Host "  Updating hostName: $($secrets.hostName) -> $appFQDN"
            $secrets.hostName = $appFQDN
            if ($appEncKey) {
                $secrets.decryptionKeyId = "MACHINEKEY_DecryptionKey=$appEncKey;"
            }
            $secretsJson = $secrets | ConvertTo-Json -Depth 5
            [System.IO.File]::WriteAllText($secretsFile, $secretsJson, [System.Text.UTF8Encoding]::new($false))
            Write-Step "Host secrets updated - restarting pod to pick up changes"
            oc delete pod $appPod -n $NAMESPACE --force 2>&1 | Out-Null
            Start-Sleep -Seconds 20
            Wait-ForPods -Namespace $NAMESPACE -LabelSelector "containerapps.io/app-name=$LOGIC_APP_NAME" -TimeoutSeconds 300
        } else {
            Write-Step "Host secrets already match app identity"
        }
    } else {
        Write-Warn "Host secrets file not found at $secretsFile - Functions host will generate on first start"
    }
} else {
    Write-Warn "Could not find running pod for $LOGIC_APP_NAME - skipping host secrets update"
}

} # End Phase 11

# ============================================================================
# PHASE 12: Deploy Sample Workflow
# ============================================================================
if (Write-Phase "12" "Deploy Sample Hello World Workflow") {

Write-Step "Creating hello-workflow on SMB share"
New-Item -ItemType Directory -Path "$SMB_SHARE_PATH\hello-workflow" -Force | Out-Null

$workflow = @'
{
  "definition": {
    "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
    "actions": {
      "Response": {
        "type": "Response",
        "kind": "Http",
        "inputs": {
          "statusCode": 200,
          "headers": { "Content-Type": "application/json" },
          "body": {
            "message": "Hello from Logic Apps on OpenShift SNO!",
            "timestamp": "@{utcNow()}",
            "workflowName": "@{workflow().name}"
          }
        },
        "runAfter": {}
      }
    },
    "triggers": {
      "When_a_HTTP_request_is_received": {
        "type": "Request",
        "kind": "Http",
        "inputs": {}
      }
    },
    "contentVersion": "1.0.0.0"
  },
  "kind": "Stateful"
}
'@
Set-Content -Path "$SMB_SHARE_PATH\hello-workflow\workflow.json" -Value $workflow -Encoding UTF8
Write-Step "Workflow deployed to $SMB_SHARE_PATH\hello-workflow\workflow.json"

} # End Phase 12

# ============================================================================
# PHASE 12.5: Create Dedicated MLLP TCP LoadBalancer Service
# ============================================================================
if (Write-Phase "12.5" "Create Dedicated MLLP TCP LoadBalancer (bypasses envoy)") {

# The Container Apps envoy (k8se) does NOT support raw TCP passthrough for
# additionalPortMappings — it only handles HTTP (L7). MLLP is a raw TCP protocol
# (HL7 over socket with 0x0B/0x1C/0x0D framing), so we create a dedicated
# LoadBalancer Service that routes directly to the pod, bypassing envoy entirely.

Write-Step "Creating dedicated MLLP LoadBalancer service (svc/mllp-receive-lb)"
$mllpSvcYaml = @"
apiVersion: v1
kind: Service
metadata:
  name: mllp-receive-lb
  namespace: $NAMESPACE
  labels:
    purpose: mllp-tcp-passthrough
  annotations:
    service.beta.kubernetes.io/azure-load-balancer-internal: "true"
spec:
  type: LoadBalancer
  selector:
    containerapps.io/app-name: $LOGIC_APP_NAME
  ports:
    - name: mllp-primary
      port: $MLLP_PORT
      targetPort: $MLLP_PORT
      protocol: TCP
  sessionAffinity: None
"@

$mllpSvcYaml | oc apply -f - --v=4
Stop-OnError "create MLLP LoadBalancer service"

Write-Step "Waiting for MLLP LoadBalancer IP assignment..."
$mllpLbIp = $null
for ($i = 1; $i -le 12; $i++) {
    $mllpLbIp = oc get svc mllp-receive-lb -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>&1
    if ($mllpLbIp -and $mllpLbIp -notmatch "error") {
        Write-Step "MLLP LoadBalancer IP assigned: $mllpLbIp"
        break
    }
    if ($i -eq 12) {
        Write-Warn "MLLP LB IP not assigned after 60s - MetalLB may need time. Check: oc get svc mllp-receive-lb -n $NAMESPACE"
    }
    Start-Sleep -Seconds 5
}

# Verify endpoints are populated (pod is backing the service)
$mllpEndpoints = oc get endpoints mllp-receive-lb -n $NAMESPACE -o jsonpath='{.subsets[*].addresses[*].ip}' 2>&1
if ($mllpEndpoints -and $mllpEndpoints -notmatch "error") {
    Write-Step "MLLP service endpoints active: $mllpEndpoints"
} else {
    Write-Warn "MLLP service has no endpoints yet. Pod may still be starting."
}

} # End Phase 12.5

# ============================================================================
# PHASE 13: Verification
# ============================================================================
if (Write-Phase "13" "Verification") {

Write-Step "Checking all pods in $NAMESPACE"
oc get pods -n $NAMESPACE --v=4

Write-Step "Checking envoy LoadBalancer IP"
oc get svc microsoft-app-environment-k8se-envoy -n $NAMESPACE --v=4

Write-Step "Testing DNS resolution"
$testPod = oc get pods -n $NAMESPACE -l "containerapps.io/app-name=$LOGIC_APP_NAME" --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>&1
if ($testPod) {
    $appFQDN = az rest --method GET `
        --url "https://management.azure.com/subscriptions/$(az account show --query id -o tsv)/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.App/containerApps/${LOGIC_APP_NAME}?api-version=2025-01-01" `
        --query "properties.configuration.ingress.fqdn" -o tsv 2>&1
    if ($appFQDN) {
        Write-Host "  Testing FQDN: $appFQDN"
        $dnsResult = oc exec $testPod -n $NAMESPACE -c logicapps-container -- curl -s --max-time 5 "http://$appFQDN/" 2>&1
        if ($dnsResult -match "Azure Function") {
            Write-Step "DNS resolution and envoy routing: OK"
        } else {
            Write-Warn "DNS resolution or envoy routing may have issues. Response: $($dnsResult | Select-Object -First 1)"
        }
    }

    Write-Host "  Testing admin API..."
    $secretsFile = "$SMB_SHARE_PATH\Functions\Secrets\host.json"
    if (Test-Path $secretsFile) {
        $secrets = Get-Content $secretsFile -Raw | ConvertFrom-Json
        $masterKey = $secrets.masterKey.value
        $encodedKey = [System.Uri]::EscapeDataString($masterKey)
        $statusResult = oc exec $testPod -n $NAMESPACE -c logicapps-container -- curl -s "http://localhost:80/admin/host/status?code=$encodedKey" 2>&1
        if ($statusResult -match '"state":"Running"') {
            Write-Step "Functions host admin API: OK"
        } else {
            Write-Warn "Functions host admin API returned: $statusResult"
        }

        $wfResult = oc exec $testPod -n $NAMESPACE -c logicapps-container -- curl -s "http://localhost:80/runtime/webhooks/workflow/api/management/workflows?api-version=2024-02-02&code=$encodedKey" 2>&1
        if ($wfResult -match '"name"' -or $wfResult -eq '[]') {
            $wfCount = 0
            if ($wfResult -ne '[]') { $wfCount = ($wfResult | ConvertFrom-Json).Count }
            Write-Step "Workflow management API: OK ($wfCount workflows found)"
        } else {
            Write-Warn "Workflow management API returned: $wfResult"
        }
    }

    # Test the full ARM → extensions-api → envoy → app path (this is what Azure Portal uses)
    Ensure-ExtensionsApiProxyViaEnvoyInternal -Namespace $NAMESPACE
    Write-Step "Testing ARM endpoint (Azure Portal path)..."
    $subscriptionId = az account show --query id --output tsv
    $armWorkflowsUrl = "https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.App/containerApps/${LOGIC_APP_NAME}/providers/Microsoft.App/logicApps/${LOGIC_APP_NAME}/workflows?api-version=2024-02-02-preview"
    $armResult = az rest --method GET --url $armWorkflowsUrl 2>&1
    if ($armResult -match '"value"' -or $armResult -match '"workflows"') {
        $armWorkflows = ($armResult | ConvertFrom-Json).value
        Write-Step "ARM workflows endpoint: OK ($($armWorkflows.Count) workflows visible from Azure Portal)"
    } else {
        Write-Warn "ARM workflows endpoint failed: $($armResult | Select-Object -First 2)"
        Write-Host "    extensions-api is expected to proxy through microsoft-app-environment-k8se-envoy-internal." -ForegroundColor Yellow
        Write-Host "    Re-run Ensure-ExtensionsApiProxyViaEnvoyInternal or inspect oc logs deployment/microsoft-app-environment-k8se-extensions-api -n $NAMESPACE" -ForegroundColor Yellow
    }
} else {
    Write-Warn "No running pod found for $LOGIC_APP_NAME - skipping connectivity tests"
}

Write-Host ""
Write-Host "=" * 80 -ForegroundColor Green
Write-Host "  SETUP COMPLETE!" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Green
Write-Host ""
Write-Host "  Resource Group:    $RESOURCE_GROUP" -ForegroundColor White
Write-Host "  Cluster:           $CLUSTER_NAME" -ForegroundColor White
Write-Host "  Logic App:         $LOGIC_APP_NAME" -ForegroundColor White
Write-Host "  Extension:         $EXTENSION_NAME" -ForegroundColor White
Write-Host "  Namespace:         $NAMESPACE" -ForegroundColor White
Write-Host "  SMB Share:         \\$SQL_SERVER_IP\$SMB_SHARE_NAME -> /home/site/wwwroot" -ForegroundColor White
Write-Host "  Workflows Dir:     $SMB_SHARE_PATH" -ForegroundColor White
Write-Host ""

# --- Optional MLLP Port-Forward ---
# Use oc port-forward when the MetalLB IP is not directly reachable from Windows.
Write-Step "Starting MLLP port-forward for local Windows access"
$existingMllpPf = Get-Process -Name 'oc' -ErrorAction SilentlyContinue | Where-Object {
    try { (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine -match "$MLLP_PORT" } catch { $false }
}
if ($existingMllpPf) {
    $existingMllpPf | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 2
}
$mllpPfProc = Start-Process -FilePath "oc" `
    -ArgumentList "port-forward svc/mllp-receive-lb ${MLLP_PORT}:${MLLP_PORT} -n $NAMESPACE --address 0.0.0.0" `
    -NoNewWindow -PassThru
Write-Host "  MLLP port-forward started (PID: $($mllpPfProc.Id))"
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "  MLLP Receive Configuration:" -ForegroundColor Cyan
Write-Host "  ─────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "  MLLP LB Service:   svc/mllp-receive-lb ($NAMESPACE)" -ForegroundColor White
Write-Host "  MLLP LB IP:        $mllpLbIp" -ForegroundColor White
Write-Host "  MLLP Port:         $MLLP_PORT" -ForegroundColor White
Write-Host "  Port-Forward PID:  $($mllpPfProc.Id)" -ForegroundColor White
Write-Host ""
Write-Host "  To send HL7 messages (from Windows):" -ForegroundColor Yellow
Write-Host "    MllpSend.exe /I 127.0.0.1 /P $MLLP_PORT /SB 11 /EB 28 /CR 13 `"your HL7 message`"" -ForegroundColor Yellow
Write-Host ""
Write-Host "  IMPORTANT: /SB 11 /EB 28 /CR 13 flags are REQUIRED for MLLP framing." -ForegroundColor Red
Write-Host "  Without them, TCP connects but the trigger never fires." -ForegroundColor Red
Write-Host ""
Write-Host "  To restart port-forward after reboot:" -ForegroundColor Yellow
Write-Host "    oc port-forward svc/mllp-receive-lb ${MLLP_PORT}:${MLLP_PORT} -n $NAMESPACE --address 0.0.0.0" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Production (real AKS): No port-forward needed. Use the LB IP directly." -ForegroundColor DarkGray
Write-Host ""
Write-Host "  To add a new workflow:" -ForegroundColor Yellow
Write-Host "    1. Create a folder under $SMB_SHARE_PATH\<workflow-name>\" -ForegroundColor Yellow
Write-Host "    2. Add workflow.json inside that folder" -ForegroundColor Yellow
Write-Host "    3. Restart the Logic App pod or wait for file watcher to pick it up" -ForegroundColor Yellow
Write-Host ""

} # End Phase 13

# ============================================================================
# TROUBLESHOOTING
# ============================================================================
<#
COMMON ISSUES AND FIXES:

1. Pods stuck in ContainerCreating with SCC errors:
   oc adm policy add-scc-to-group privileged system:serviceaccounts:logicapps-aca-ns

2. Envoy service stuck at <pending> External-IP:
   - MetalLB needs OpenShift SCCs:
     oc adm policy add-scc-to-user anyuid system:serviceaccount:metallb-system:controller
     oc adm policy add-scc-to-user privileged system:serviceaccount:metallb-system:speaker
   - Check MetalLB pods and address pool: oc get pods -n metallb-system ; oc get ipaddresspool,l2advertisement -n metallb-system

3. SyncTriggers 404:
   - DNS resolution issue. Verify: oc exec <pod> -c logicapps-container -- nslookup <app>.internal.<domain>.k4apps.io
   - Must resolve to envoy-internal ClusterIP, not node IP
   - Re-run: az containerapp arc setup-core-dns --distro=openshift --verbose

4. Workflow not loading (404 on /api/management/workflows):
   - Verify SMB mount is at /home/site/wwwroot: oc exec <pod> -c logicapps-container -- ls /home/site/wwwroot/
   - Workflow.json must be at /home/site/wwwroot/<workflow-name>/workflow.json
   - Restart pod after adding workflow files

5. SQL connection errors:
   - Verify from pod: oc exec <pod> -c logicapps-container -- sh -c "echo 'select 1' | /opt/mssql-tools/bin/sqlcmd -S <windows-host-ip> -U logicappsuser -P '<password>'"
   - Ensure TCP/IP is enabled in SQL Server Configuration Manager
   - Ensure firewall allows port 1433 from the SNO node or pod source CIDR

6. WEBSITE_AUTH_ENCRYPTION_KEY missing:
   - Add to containerapp env vars via oc patch
   - The controller should auto-generate this; if not, set a 32-byte base64 string

7. MetalLB speaker CrashLoopBackOff:
   - Controller needs anyuid SCC and speaker needs privileged SCC
   - oc adm policy add-scc-to-user anyuid system:serviceaccount:metallb-system:controller
   - oc adm policy add-scc-to-user privileged system:serviceaccount:metallb-system:speaker

8. az k8s-extension permission error:
   - Delete and reinstall: Remove-Item -Recurse -Force "$HOME\.azure\cliextensions\k8s-extension"
   - Then: az extension add --name k8s-extension --upgrade --yes

9. OpenShift DNS operator reverting DNS changes:
   - Don't edit dns-default configmap/daemonset directly
   - Use: oc patch dns.operator.openshift.io default --type=merge -p '<json>'
   - This is the supported way to add forward zones

10. 502 Bad Gateway from Azure Portal workflow listing:
    - Root cause: extensions-api nginx proxies revision traffic to a `*.internal.<env>.k4apps.io` hostname
      that may not resolve correctly on OpenShift.
    - Fix: patch the extensions-api `shared.conf` to proxy to
      `https://microsoft-app-environment-k8se-envoy-internal.<namespace>.svc.cluster.local`
      while preserving the original Host/SNI header.
    - This script now applies that patch automatically through Ensure-ExtensionsApiProxyViaEnvoyInternal.
    - Verify: oc logs deployment/microsoft-app-environment-k8se-extensions-api -n logicapps-aca-ns | grep "502"

11. Envoy-controller "unsupported local proxy redirect port: 80":
    - The envoy-controller rejects targetPort=80 for the localproxy sidecar.
    - Fix: Set ingress.targetPort=8080 in the container app ARM body.
    - App must listen on BOTH 80 (for K8se startup probe) and 8080 (for envoy routing):
      ASPNETCORE_URLS=http://+:80;http://+:8080
    - The service selector "project:doesnotexist" is EXPECTED (K8se activator pattern for scale-to-zero).
      Do NOT try to fix it — envoy routes via xDS/EDS, not K8s service endpoints.

12. SNO node out of memory (OOM kills):
    - Increase worker or VM memory assigned to the SNO node
    - Logic Apps container needs at least 2 CPU / 4Gi memory
#>
