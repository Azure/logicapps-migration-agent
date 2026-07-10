const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const http = require('http');
const fs = require('fs');

const CONFIG = {"port":3002,"namespace":"logicapps-aca-ns","appName":"psrivas-la1001","kubeconfigPath":"C:\\Users\\psrivas\\Downloads\\kubeconfig","kubeContext":"","ocPath":"C:\\src\\logicapps-migration-agent\\openshift\\openshift-tools\\oc.exe","loginRefreshSeconds":240,"logContainer":"logicapps-container"};
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
  <h1>⚡ Logic App Manager</h1>
  <div id="maxHint" class="muted">Compact view — press <strong>v</strong> or maximize this panel for Live Stream, config &amp; actions.</div>
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
      <h3 style="margin:0;">🔴 Top Errors from Pod Logs</h3>
      <div class="row">
        <input id="logErrTail" type="number" min="50" max="5000" value="500" title="Lines of log history to scan per pod" style="width:90px;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:4px;padding:6px;" />
        <button class="primary" onclick="loadLogErrors()">Scan Recent Logs</button>
      </div>
    </div>
    <div id="logErrorsMeta" class="muted" style="margin-top:6px;">Scanning recent pod logs…</div>
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
      if (meta.length) html += '<div class="muted" style="margin-top:6px;">' + meta.join(' — ') + '</div>';
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
      var icon = allReady ? '✅' : (pods.length ? '❌' : '—');
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
          var st = ok ? '<span style="color:var(--success);font-weight:600;">✅</span>' : '<span style="color:var(--danger);font-weight:600;">❌</span>';
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
      logErrorsMetaEl.innerHTML = 'Revision <strong>' + escapeHtml(d.revision || '-') + '</strong> &nbsp;•&nbsp; '
        + (d.podsScanned || []).length + ' pod(s), ' + (d.linesScanned || 0) + ' lines scanned, tail=' + (d.tail || 0)
        + ' &nbsp;•&nbsp; ' + errs.length + ' distinct error group(s)'
        + (when ? (' &nbsp;•&nbsp; captured ' + escapeHtml(when)) : '');
      if(!errs.length){
        logErrorsEl.innerHTML = '<div class="pill" style="color:var(--success);border-color:var(--success);font-weight:600;">✅ No errors found in recent logs.</div>';
        return;
      }
      var html = '<table style="table-layout:fixed;width:100%;"><tr>'
        + '<th style="width:70px;">Severity</th><th style="width:56px;">Count</th><th>Recent error line</th><th style="width:150px;">Last seen</th></tr>';
      errs.forEach(function(e){
        var color = e.severity === 'error' ? 'var(--danger)' : 'var(--accent)';
        var tag = e.severity === 'error' ? '🔴 Error' : '🟠 Warn';
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
      logErrorsMetaEl.textContent = 'Scanning recent pod logs…';
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















