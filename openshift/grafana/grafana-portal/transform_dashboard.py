import json, sys, io

path = r"C:\src\logicapps-migration-agent\openshift\grafana\grafana-portal\dashboards\logicapps-workflow-hub-psrivas-la1001.json"
with io.open(path, "r", encoding="utf-8") as f:
    dash = json.load(f)

DS = "Prometheus-Portal"
panels = dash.get("panels", [])
maxid = max((p.get("id", 0) for p in panels), default=0)

WAIT_ERR = 'CrashLoopBackOff|ImagePullBackOff|ErrImagePull|CreateContainerError|CreateContainerConfigError|InvalidImageName|RunContainerError'
TERM_ERR = 'Error|OOMKilled|ContainerCannotRun|StartError|DeadlineExceeded|Evicted|ContainerStatusUnknown'

# 1) open a 4-row gap at y=85 by pushing everything at/after it down
for p in panels:
    gp = p.get("gridPos", {})
    if gp.get("y", 0) >= 85:
        gp["y"] = gp.get("y", 0) + 4

# 2) new Cluster Pod Health stat panel at y=85
stat = {
    "id": maxid + 1,
    "title": "Cluster Pod Health (All Namespaces)",
    "type": "stat",
    "datasource": DS,
    "gridPos": {"h": 4, "w": 24, "x": 0, "y": 85},
    "targets": [
        {"refId": "A", "expr": "count(kube_pod_status_phase == 1)", "legendFormat": "Total Pods", "instant": True},
        {"refId": "B", "expr": '(count(kube_pod_status_phase{phase="Running"} == 1) or on() vector(0))', "legendFormat": "Running", "instant": True},
        {"refId": "C", "expr": '(count(kube_pod_status_phase{phase="Pending"} == 1) or on() vector(0))', "legendFormat": "Pending", "instant": True},
        {"refId": "D", "expr": '(count(kube_pod_status_phase{phase="Failed"} == 1) or on() vector(0))', "legendFormat": "Failed", "instant": True},
        {"refId": "E", "expr": '(count(kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"} == 1) or on() vector(0))', "legendFormat": "CrashLooping", "instant": True},
    ],
    "fieldConfig": {"defaults": {"decimals": 0, "color": {"mode": "fixed", "fixedColor": "text"}}, "overrides": []},
    "options": {
        "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
        "orientation": "horizontal", "textMode": "value_and_name", "colorMode": "value",
        "graphMode": "none", "justifyMode": "auto",
    },
}

def find(title):
    for p in panels:
        if p.get("title") == title:
            return p
    return None

# 3) K8s Warning Events -> Cluster Pod Warnings & Errors (All Pods)
p = find("K8s Warning Events")
if p:
    p["title"] = "Cluster Pod Warnings & Errors (All Pods)"
    p["targets"] = [{
        "refId": "A",
        "expr": ('label_replace(kube_pod_container_status_waiting_reason{reason=~"' + WAIT_ERR + '"} == 1, "severity", "Error", "", "")'
                 ' or label_replace(kube_pod_container_status_terminated_reason{reason=~"' + TERM_ERR + '"} == 1, "severity", "Error", "", "")'),
        "legendFormat": "{{pod}}", "instant": True, "format": "table",
    }]
    p["transformations"] = [{"id": "organize", "options": {
        "excludeByName": {"Time": True, "__name__": True, "endpoint": True, "instance": True, "job": True,
                           "prometheus": True, "service": True, "uid": True, "container_id": True,
                           "image": True, "image_id": True, "image_spec": True, "pod_ip": True, "node": True},
        "renameByName": {"namespace": "Namespace", "pod": "Pod", "container": "Container",
                          "reason": "Reason", "severity": "Severity", "Value": "Active"},
    }}]
    p["options"] = {"showHeader": True, "cellHeight": "sm", "sortBy": [{"displayName": "Namespace", "desc": False}]}

# 4) Top Errors / Warnings Summary -> Top Pod Errors / Warnings Summary
p = find("Top Errors / Warnings Summary")
if p:
    p["title"] = "Top Pod Errors / Warnings Summary"
    p["targets"] = [{
        "refId": "A",
        "expr": ('sum by (reason) (kube_pod_container_status_waiting_reason{reason=~"' + WAIT_ERR + '"} == 1)'
                 ' or sum by (reason) (kube_pod_container_status_terminated_reason{reason=~"' + TERM_ERR + '"} == 1)'),
        "legendFormat": "{{reason}}", "instant": True, "format": "table",
    }]
    p["transformations"] = [{"id": "organize", "options": {
        "excludeByName": {"Time": True},
        "renameByName": {"reason": "Reason", "Value": "Affected Containers"},
    }}]
    p["options"] = {"showHeader": True, "cellHeight": "sm", "sortBy": [{"displayName": "Affected Containers", "desc": True}]}

# 5) Warning Events Over Time -> Pod Warnings & Errors Over Time
p = find("Warning Events Over Time")
if p:
    p["title"] = "Pod Warnings & Errors Over Time"
    p["targets"] = [
        {"refId": "A", "expr": '(sum(kube_pod_container_status_waiting_reason{reason=~"' + WAIT_ERR + '"} == 1) or on() vector(0))', "legendFormat": "Waiting/Errors"},
        {"refId": "B", "expr": '(sum(kube_pod_status_phase{phase="Pending"} == 1) or on() vector(0))', "legendFormat": "Pending"},
        {"refId": "C", "expr": '(sum(kube_pod_status_phase{phase="Failed"} == 1) or on() vector(0))', "legendFormat": "Failed"},
        {"refId": "D", "expr": '(sum(kube_pod_container_status_terminated_reason{reason=~"OOMKilled|Error|ContainerCannotRun|StartError"} == 1) or on() vector(0))', "legendFormat": "Terminated/Errors"},
        {"refId": "E", "expr": '(sum(rate(kube_pod_container_status_restarts_total[5m])) or on() vector(0))', "legendFormat": "Restart rate (5m)"},
    ]

panels.append(stat)
dash["panels"] = panels

with io.open(path, "w", encoding="utf-8") as f:
    json.dump(dash, f, indent=2)
    f.write("\n")

print("OK: panels now", len(panels), "stat id", stat["id"])
