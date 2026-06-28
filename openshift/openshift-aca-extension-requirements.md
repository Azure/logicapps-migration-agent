# Installing the Logic Apps / Azure Container Apps Extension on Red Hat OpenShift

> **Audience:** Customers running the `Microsoft.App.Environment` (Azure Container Apps / Logic Apps) Arc extension on a Red Hat OpenShift cluster.
>
> **Why this doc exists:** OpenShift differs from vanilla Kubernetes / AKS in two ways that affect this extension:
> 1. **Security Context Constraints (SCCs).** OpenShift's default `restricted-v2` SCC blocks the elevated permissions (privileged containers, host networking, fixed UIDs) that the extension and MetalLB require. You must grant SCCs explicitly.
> 2. **No LoadBalancer IPAM.** On-premises / bare-metal OpenShift (`platform: none`) has no cloud controller to fulfill `type: LoadBalancer` services, so the envoy ingress IP stays `<pending>` forever. You must provide a load balancer such as **MetalLB**.
>
> The standard AKS install instructions do **not** include these steps. Everything below is the OpenShift-specific delta.

---

## Prerequisites

| Item | Value used in this guide |
|------|--------------------------|
| Install namespace | `logicapps-aca-ns` |
| Arc connected cluster | `sno-arc-3` (resource group `anandgmenon-sno3`) |
| Environment name | `sno-arc-env-3` |
| Node subnet | `192.168.128.0/24` (adapt the MetalLB pool to your network) |
| `oc` logged in as | cluster-admin |

Set your kubeconfig before running `oc` commands:

```powershell
$env:KUBECONFIG = "$env:USERPROFILE\.kube\sno3\config"
```

---

## Step 1 — Create the install namespace

```bash
oc create namespace logicapps-aca-ns
```

> Creates the namespace the extension will deploy into **before** the install, so SCC grants below can be applied to it up front.

## Step 2 — Grant the install namespace privileged SCC

```bash
oc adm policy add-scc-to-group privileged system:serviceaccounts:logicapps-aca-ns
```

> Allows every service account in `logicapps-aca-ns` to run privileged pods. Several extension components (`log-processor`, `mdm`, `extensions-api`, envoy) require this; without it OpenShift's `restricted-v2` SCC blocks them and the Helm install rolls back.

---

## Step 3 — Install MetalLB (provides the LoadBalancer IP)

```bash
oc apply -f https://raw.githubusercontent.com/metallb/metallb/v0.14.9/config/manifests/metallb-native.yaml
```

> Deploys the MetalLB controller + speaker. On its own this creates **zero pods** on OpenShift — the manifest is written for vanilla Kubernetes and its pods violate `restricted-v2` SCC (see next two steps).

## Step 4 — Grant MetalLB the SCCs it needs

```bash
# controller runs as fixed uid/gid 65534
oc adm policy add-scc-to-user anyuid     -z controller -n metallb-system

# speaker needs hostNetwork + NET_RAW capability + host ports 7472/7946
oc adm policy add-scc-to-user privileged -z speaker    -n metallb-system
```

> `anyuid` lets the **controller** run as its hard-coded UID 65534. `privileged` lets the **speaker** use host networking, the `NET_RAW` capability, and host ports — all required for L2 ARP advertisement. Without these grants both pods fail to schedule with `unable to validate against any security context constraint`.

## Step 5 — Wait for MetalLB to be ready

```bash
oc wait --for=condition=Ready pods --all -n metallb-system --timeout=180s
oc get pods -n metallb-system
```

> Confirms the controller and speaker pods are `Running` before you create address pools (the validating webhook lives in the controller pod and will reject pool creation until it is serving).

## Step 6 — Create the address pool and L2 advertisement

```bash
cat <<'EOF' | oc apply -f -
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: aca-pool
  namespace: metallb-system
spec:
  addresses:
    - 192.168.128.200-192.168.128.250
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: aca-l2
  namespace: metallb-system
spec:
  ipAddressPools:
    - aca-pool
EOF
```

> Defines the range of IPs MetalLB hands out to `LoadBalancer` services and advertises them on the local network via L2 (ARP). **Use a free range on your own node subnet** — the example uses `192.168.128.200–250`. Verify with:

```bash
oc get ipaddresspool,l2advertisement -n metallb-system
```

---

## Step 7 — Install the ACA / Logic Apps extension with OpenShift settings

```powershell
az k8s-extension create `
  --resource-group anandgmenon-sno3 `
  --name logicapps-aca-extension `
  --cluster-type connectedClusters `
  --cluster-name sno-arc-3 `
  --extension-type 'Microsoft.App.Environment' `
  --release-train stable `
  --auto-upgrade-minor-version true `
  --scope cluster `
  --release-namespace logicapps-aca-ns `
  --configuration-settings "Microsoft.CustomLocation.ServiceAccount=default" `
  --configuration-settings "appsNamespace=logicapps-aca-ns" `
  --configuration-settings "clusterName=sno-arc-env-3" `
  --configuration-settings "keda.enabled=true" `
  --configuration-settings "keda.logicAppsScaler.enabled=true" `
  --configuration-settings "keda.logicAppsScaler.replicaCount=1" `
  --configuration-settings "containerAppController.api.functionsServerEnabled=true" `
  --configuration-settings "functionsProxyApiConfig.enabled=true" `
  --configuration-settings "Azure.Cluster.Distribution=openshift" `
  --configuration-settings "coreDNSVersion=1.8.6"
```

> Installs the extension. The two **OpenShift-specific** settings are:
> - **`Azure.Cluster.Distribution=openshift`** — switches the Helm chart into its OpenShift branch so the right components are rendered with the privileged security context OpenShift expects.
> - **`coreDNSVersion=1.8.6`** — tells the chart that CoreDNS supports `answer auto`, so the CoreDNS rewrites it generates are RFC 1034-compliant. Without it, strict glibc clients (Azure Linux 3.0 containers) reject the DNS responses.

## Step 8 — Configure CoreDNS for OpenShift

```powershell
az containerapp arc setup-core-dns --distro=openshift --verbose
```

> Patches the cluster's CoreDNS (`openshift-dns/dns-default`) so the environment's FQDNs resolve to the envoy ingress service. The `--distro=openshift` flag targets OpenShift's `openshift-dns` layout (not the AKS-style `kube-system/coredns`) and writes the rewrites with `answer auto`.

---

## What "done" looks like

- `oc get svc -n logicapps-aca-ns` → the `…k8se-envoy` service has an **EXTERNAL-IP from your MetalLB pool** (not `<pending>`).
- `oc get pods -n logicapps-aca-ns --field-selector=status.phase!=Running` → returns **no pods**.
- `az k8s-extension show …` → `provisioningState: Succeeded`.
- Custom location and connected environment both report `Succeeded`.

---

## Summary of OpenShift-only deltas

| # | Step | OpenShift-specific reason |
|---|------|---------------------------|
| 2 | `add-scc-to-group privileged` on install namespace | Extension pods need privileged SCC |
| 3–6 | Install MetalLB + grant its SCCs + address pool | No cloud LoadBalancer IPAM on bare-metal OpenShift |
| 7 | `Azure.Cluster.Distribution=openshift` | Render the chart's OpenShift branch |
| 7 | `coreDNSVersion=1.8.6` | Emit RFC 1034-compliant `answer auto` rewrites |
| 8 | `setup-core-dns --distro=openshift` | Patch OpenShift's `openshift-dns` CoreDNS layout |

Everything else in the install matches the standard AKS instructions.
