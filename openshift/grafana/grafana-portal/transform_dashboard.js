const fs = require('fs');
const path = "C:\\src\\logicapps-migration-agent\\openshift\\grafana\\grafana-portal\\dashboards\\logicapps-workflow-hub-psrivas-la1001.json";
const dash = JSON.parse(fs.readFileSync(path, 'utf8'));
const DS = "Prometheus-Portal";
const panels = dash.panels || [];
const maxid = panels.reduce((m, p) => Math.max(m, p.id || 0), 0);
const WAIT_ERR = 'CrashLoopBackOff|ImagePullBackOff|ErrImagePull|CreateContainerError|CreateContainerConfigError|InvalidImageName|RunContainerError';
const TERM_ERR = 'Error|OOMKilled|ContainerCannotRun|StartError|DeadlineExceeded|Evicted|ContainerStatusUnknown';

for (const p of panels) {
  const gp = p.gridPos || {};
  if ((gp.y || 0) >= 85) gp.y = (gp.y || 0) + 4;
}

const stat = {
  id: maxid + 1,
  title: "Cluster Pod Health (All Namespaces)",
  type: "stat",
  datasource: DS,
  gridPos: { h: 4, w: 24, x: 0, y: 85 },
  targets: [
    { refId: "A", expr: "count(kube_pod_status_phase == 1)", legendFormat: "Total Pods", instant: true },
    { refId: "B", expr: '(count(kube_pod_status_phase{phase="Running"} == 1) or on() vector(0))', legendFormat: "Running", instant: true },
    { refId: "C", expr: '(count(kube_pod_status_phase{phase="Pending"} == 1) or on() vector(0))', legendFormat: "Pending", instant: true },
    { refId: "D", expr: '(count(kube_pod_status_phase{phase="Failed"} == 1) or on() vector(0))', legendFormat: "Failed", instant: true },
    { refId: "E", expr: '(count(kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"} == 1) or on() vector(0))', legendFormat: "CrashLooping", instant: true }
  ],
  fieldConfig: { defaults: { decimals: 0, color: { mode: "fixed", fixedColor: "text" } }, overrides: [] },
  options: {
    reduceOptions: { calcs: ["lastNotNull"], fields: "", values: false },
    orientation: "horizontal", textMode: "value_and_name", colorMode: "value", graphMode: "none", justifyMode: "auto"
  }
};

const find = (t) => panels.find((p) => p.title === t);

let p = find("K8s Warning Events");
if (p) {
  p.title = "Cluster Pod Warnings & Errors (All Pods)";
  p.targets = [{
    refId: "A",
    expr: 'label_replace(kube_pod_container_status_waiting_reason{reason=~"' + WAIT_ERR + '"} == 1, "severity", "Error", "", "")'
        + ' or label_replace(kube_pod_container_status_terminated_reason{reason=~"' + TERM_ERR + '"} == 1, "severity", "Error", "", "")',
    legendFormat: "{{pod}}", instant: true, format: "table"
  }];
  p.transformations = [{ id: "organize", options: {
    excludeByName: { Time: true, __name__: true, endpoint: true, instance: true, job: true, prometheus: true,
                     service: true, uid: true, container_id: true, image: true, image_id: true, image_spec: true, pod_ip: true, node: true },
    renameByName: { namespace: "Namespace", pod: "Pod", container: "Container", reason: "Reason", severity: "Severity", Value: "Active" }
  }}];
  p.options = { showHeader: true, cellHeight: "sm", sortBy: [{ displayName: "Namespace", desc: false }] };
}

p = find("Top Errors / Warnings Summary");
if (p) {
  p.title = "Top Pod Errors / Warnings Summary";
  p.targets = [{
    refId: "A",
    expr: 'sum by (reason) (kube_pod_container_status_waiting_reason{reason=~"' + WAIT_ERR + '"} == 1)'
        + ' or sum by (reason) (kube_pod_container_status_terminated_reason{reason=~"' + TERM_ERR + '"} == 1)',
    legendFormat: "{{reason}}", instant: true, format: "table"
  }];
  p.transformations = [{ id: "organize", options: { excludeByName: { Time: true }, renameByName: { reason: "Reason", Value: "Affected Containers" } } }];
  p.options = { showHeader: true, cellHeight: "sm", sortBy: [{ displayName: "Affected Containers", desc: true }] };
}

p = find("Warning Events Over Time");
if (p) {
  p.title = "Pod Warnings & Errors Over Time";
  p.targets = [
    { refId: "A", expr: '(sum(kube_pod_container_status_waiting_reason{reason=~"' + WAIT_ERR + '"} == 1) or on() vector(0))', legendFormat: "Waiting/Errors" },
    { refId: "B", expr: '(sum(kube_pod_status_phase{phase="Pending"} == 1) or on() vector(0))', legendFormat: "Pending" },
    { refId: "C", expr: '(sum(kube_pod_status_phase{phase="Failed"} == 1) or on() vector(0))', legendFormat: "Failed" },
    { refId: "D", expr: '(sum(kube_pod_container_status_terminated_reason{reason=~"OOMKilled|Error|ContainerCannotRun|StartError"} == 1) or on() vector(0))', legendFormat: "Terminated/Errors" },
    { refId: "E", expr: '(sum(rate(kube_pod_container_status_restarts_total[5m])) or on() vector(0))', legendFormat: "Restart rate (5m)" }
  ];
}

panels.push(stat);
dash.panels = panels;
fs.writeFileSync(path, JSON.stringify(dash, null, 2) + "\n");
console.log("OK: panels now", panels.length, "stat id", stat.id);
