const http = require('http');
const https = require('https');
const { URL } = require('url');
const { execFile } = require('child_process');
const { promisify } = require('util');

const CONFIG = {"port":3001,"logicAppBase":"http://127.0.0.1:8088","masterKey":"<LOGICAPPS_MASTER_KEY>","apiVersion":"2020-05-01-preview","namespace":"<NAMESPACE>","appName":"<APP_NAME>","kubeconfigPath":"<KUBECONFIG_PATH>","ocPath":"oc"};
const PORT = CONFIG.port;
const execFileAsync = promisify(execFile);
const RUNTIME = {
  namespace: CONFIG.namespace || 'logicapps-aca-ns',
  appName: CONFIG.appName || 'psrivaslasn002',
  kubeconfigPath: CONFIG.kubeconfigPath || '',
  ocPath: CONFIG.ocPath || 'oc'
};

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

function deriveRevisionNameFromPod(podName) {
  const match = String(podName || '').match(/--([^-]+)-/);
  return match ? match[1] : 'unknown';
}

async function runOc(args) {
  const env = { ...process.env };
  if (RUNTIME.kubeconfigPath) env.KUBECONFIG = RUNTIME.kubeconfigPath;
  const result = await execFileAsync(RUNTIME.ocPath, args, { env, maxBuffer: 10 * 1024 * 1024 });
  return (result.stdout || '').trim();
}

async function getRevisionRows() {
  const selector = `containerapps.io/app-name=${RUNTIME.appName}`;
  const out = await runOc(['-n', RUNTIME.namespace, 'get', 'pods', '-l', selector, '-o', 'json']);
  const payload = tryParseJson(out) || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  const byRevision = new Map();

  items.forEach((pod) => {
    const meta = pod.metadata || {};
    const status = pod.status || {};
    const labels = meta.labels || {};
    const podName = meta.name || '';
    const revision = labels['containerapps.io/revision-name'] || deriveRevisionNameFromPod(podName);
    const containerStatuses = Array.isArray(status.containerStatuses) ? status.containerStatuses : [];
    const ready = containerStatuses.some((c) => c && c.ready);
    const restartCount = containerStatuses.reduce((sum, c) => sum + (c && c.restartCount ? c.restartCount : 0), 0);

    if (!byRevision.has(revision)) {
      byRevision.set(revision, { revision, replicas: 0, readyReplicas: 0, restartCount: 0, health: 'Unknown', pods: [] });
    }
    const row = byRevision.get(revision);
    row.replicas += 1;
    if (ready) row.readyReplicas += 1;
    row.restartCount += restartCount;
    row.pods.push(podName);
  });

  const rows = Array.from(byRevision.values()).map((row) => {
    const health = row.readyReplicas === row.replicas && row.replicas > 0 ? 'Healthy' : (row.readyReplicas > 0 ? 'Degraded' : 'Unhealthy');
    return { ...row, health };
  });

  rows.sort((a, b) => a.revision.localeCompare(b.revision));
  return rows;
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

function parseDurationToSeconds(value) {
  if (!value) return null;
  const text = String(value).trim().toLowerCase();
  if (!text || text === '-') return null;
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h)?$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2] || 's';
  if (unit === 'ms') return amount / 1000;
  if (unit === 'm') return amount * 60;
  if (unit === 'h') return amount * 3600;
  return amount;
}

function matchesDurationFilter(durationSeconds, filterText) {
  const filter = (filterText || '').trim().toLowerCase();
  if (!filter) return true;
  if (durationSeconds === null) return false;
  const m = filter.match(/^(<=|>=|=|<|>)?\s*(\d+(?:\.\d+)?)\s*(ms|s|m|h)?$/);
  if (!m) return true;
  const op = m[1] || '=';
  const targetSeconds = parseDurationToSeconds(String(m[2]) + (m[3] || 's'));
  if (targetSeconds === null) return true;
  if (op === '>') return durationSeconds > targetSeconds;
  if (op === '<') return durationSeconds < targetSeconds;
  if (op === '>=') return durationSeconds >= targetSeconds;
  if (op === '<=') return durationSeconds <= targetSeconds;
  return durationSeconds === targetSeconds;
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
      const requestedTop = Math.max(1, Math.min(5000, Number(url.searchParams.get('top') || '1000') || 1000));
      const filter = url.searchParams.get('filter');
      const quickRunIdQuery = (url.searchParams.get('quickRunId') || '').trim().toLowerCase();
      const runIdQuery = (url.searchParams.get('runId') || '').trim().toLowerCase();
      const statusQuery = (url.searchParams.get('status') || '').trim().toLowerCase();
      const startFrom = (url.searchParams.get('startFrom') || '').trim();
      const startTo = (url.searchParams.get('startTo') || '').trim();
      const durationQuery = (url.searchParams.get('duration') || '').trim().toLowerCase();
      const pageSize = Math.min(250, requestedTop);
      let apiPath = managementPath(`/runtime/webhooks/workflow/api/management/workflows/${encodeURIComponent(workflow)}/runs`) + `&$top=${encodeURIComponent(pageSize)}`;
      if (filter) {
        apiPath += `&$filter=${encodeURIComponent(filter)}`;
      }

      let result = await makeRequest('GET', apiPath);
      if (result.status >= 400) {
        sendJson(res, result.status, result.json || {});
        return;
      }

      let payload = result.json || {};
      let runs = Array.isArray(payload.value) ? payload.value.slice() : [];
      let nextLink = payload.nextLink;
      while (nextLink && runs.length < requestedTop) {
        result = await makeRequest('GET', nextLink);
        if (result.status >= 400) break;
        payload = result.json || {};
        runs.push(...(Array.isArray(payload.value) ? payload.value : []));
        nextLink = payload.nextLink;
      }
      runs = runs.slice(0, requestedTop);

      if (quickRunIdQuery || runIdQuery || statusQuery || startFrom || startTo || durationQuery) {
        const fromMs = startFrom ? Date.parse(startFrom) : NaN;
        const toMs = startTo ? Date.parse(startTo) : NaN;
        runs = runs.filter((run) => {
          const p = run.properties || {};
          const runId = String(run.name || '').toLowerCase();
          const status = String(p.status || '').toLowerCase();
          const startMs = p.startTime ? Date.parse(p.startTime) : NaN;
          const durationSeconds = p.endTime && p.startTime ? ((new Date(p.endTime) - new Date(p.startTime)) / 1000) : null;
          return (
            (!quickRunIdQuery || runId.includes(quickRunIdQuery)) &&
            (!runIdQuery || runId.includes(runIdQuery)) &&
            (!statusQuery || status === statusQuery) &&
            (!startFrom || (!Number.isNaN(startMs) && !Number.isNaN(fromMs) && startMs >= fromMs)) &&
            (!startTo || (!Number.isNaN(startMs) && !Number.isNaN(toMs) && startMs <= toMs)) &&
            matchesDurationFilter(durationSeconds, durationQuery)
          );
        });
      }
      sendJson(res, 200, { value: runs });
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
      const runsResult = await makeRequest('GET', managementPath(`/runtime/webhooks/workflow/api/management/workflows/${encodeURIComponent(workflow)}/runs`) + `&$top=50&$filter=${encodeURIComponent("status eq 'Failed'")}`);
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
      sendJson(res, result.status === 200 || result.status === 202 ? 200 : result.status, {
        message: result.status < 300 ? `Triggered ${workflow}` : `Trigger failed (${result.status})`,
        trigger: triggerName,
        status: result.status,
        error: result.status >= 400 ? result.body : undefined
      });
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
      sendJson(res, triggerResult.status >= 200 && triggerResult.status < 300 ? 200 : triggerResult.status, {
        message: `Remote trigger sent for ${workflow}`,
        trigger: triggerName,
        callbackUrl,
        status: triggerResult.status,
        response: triggerResult.json || triggerResult.body
      });
      return;
    }

    if (path === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Workflow Manager</title>
  <style>
    * { box-sizing: border-box; }
    :root { --bg:#f4f5f5; --card:#fff; --border:#dfe2e5; --text:#1f1f1f; --muted:#6e6e78; --btn:#3871dc; --danger:#e02f44; --success:#1a7f4b; --accent:#6f42c1; --surface:#fafafa; }
    body.dark { --bg:transparent; --card:#1f2028; --border:#30323d; --text:#d8d9e3; --muted:#a7a9b7; --surface:#111218; }
    body { margin:0; padding:12px; font:13px/1.45 Inter,Arial,sans-serif; background:var(--bg); color:var(--text); }
    h1 { margin:0 0 12px; font-size:16px; }
    .card { background:var(--card); border:1px solid var(--border); border-radius:4px; padding:12px; margin-bottom:10px; }
    .card.collapsed { padding-top:8px; padding-bottom:8px; margin-bottom:6px; }
    .card-header { display:flex; align-items:center; justify-content:space-between; gap:8px; }
    .card-title { margin:0; font-size:14px; }
    .card-toggle { border:none; border-radius:4px; background:var(--surface); color:var(--text); padding:4px 8px; cursor:pointer; }
    .card.collapsed .card-body { display:none; }
    .row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
    button, input, select, textarea { font:inherit; }
    button { border:none; border-radius:4px; color:#fff; padding:6px 10px; cursor:pointer; }
    .primary { background:var(--btn); }
    .danger { background:var(--danger); }
    .success { background:var(--success); }
    .accent { background:var(--accent); }
    input, select, textarea { width:100%; border:1px solid var(--border); background:var(--surface); color:var(--text); border-radius:4px; padding:6px 8px; }
    textarea { min-height:80px; }
    table { width:100%; border-collapse:collapse; margin-top:10px; }
    th, td { padding:6px 8px; border-bottom:1px solid var(--border); text-align:left; }
    th { color:var(--muted); font-weight:600; }
    .muted { color:var(--muted); }
    #output { white-space:pre-wrap; background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:8px; display:none; }
  </style>
</head>
<body>
  <script>
    (function () {
      try {
        const p = window.parent && window.parent.document && window.parent.document.body;
        if (p && (p.classList.contains('theme-dark') || p.getAttribute('data-theme') === 'dark')) document.body.classList.add('dark');
      } catch {}
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) document.body.classList.add('dark');
      if (new URLSearchParams(window.location.search).get('theme') === 'dark') document.body.classList.add('dark');
    })();
  </script>

  <h1>⚡ Workflow Manager</h1>
  <div class="card" data-card="workflow-select">
    <div class="card-header"><h3 class="card-title">Workflow Actions</h3><button type="button" class="card-toggle" onclick="toggleCard(this)">Minimize</button></div>
    <div class="card-body">
    <div class="row">
      <div style="min-width:220px;flex:1 1 220px;">
        <label class="muted">Workflow</label>
        <select id="workflow"></select>
      </div>
      <div class="row" style="align-self:flex-end;">
        <button class="primary" onclick="listRuns()">List Runs</button>
        <button class="accent" onclick="refreshWorkflows()">Refresh Workflows</button>
        <button class="danger" onclick="listFailedRuns()">Failed Runs</button>
        <button class="danger" onclick="resubmitFailed()">Retry All Failed</button>
        <button class="success" onclick="triggerWorkflow()">Trigger</button>
        <button class="success" onclick="triggerRemote()">Remote Trigger</button>
        <button class="accent" onclick="getRemoteTriggerUrl()">Remote URL</button>
      </div>
    </div>
    </div>
  </div>

  <div class="card" data-card="quick-search">
    <div class="card-header"><h3 class="card-title">Quick Search</h3><button type="button" class="card-toggle" onclick="toggleCard(this)">Minimize</button></div>
    <div class="card-body">
    <label class="muted">Quick Search (Run ID)</label>
    <input id="runIdSearch" type="text" placeholder="Type part of Run ID..." />
    </div>
  </div>

  <div class="card" data-card="payload">
    <div class="card-header"><h3 class="card-title">Remote Trigger Payload</h3><button type="button" class="card-toggle" onclick="toggleCard(this)">Minimize</button></div>
    <div class="card-body">
    <label class="muted">Remote trigger payload (JSON)</label>
    <textarea id="payload">{}</textarea>
    </div>
  </div>

  <div id="output"></div>
  <div id="results"></div>

  <script>
    const workflowEl = document.getElementById('workflow');
    const outputEl = document.getElementById('output');
    const resultsEl = document.getElementById('results');
    const runIdSearchEl = document.getElementById('runIdSearch');
    let currentRuns = [];
    let currentFailedOnly = false;
    const runFilterState = { quickRunId: '', runId: '', status: '', startFromDate: '', startFromTime: '00:00', startToDate: '', startToTime: '23:59', duration: '' };
    function cardStateKey(card) { return 'workflow-manager-card:' + card.getAttribute('data-card'); }
    function initCards() {
      document.querySelectorAll('.card[data-card]').forEach((card) => {
        const minimized = localStorage.getItem(cardStateKey(card)) === '1';
        card.classList.toggle('collapsed', minimized);
        const button = card.querySelector('.card-toggle');
        if (button) {
          button.textContent = minimized ? 'Expand' : 'Minimize';
          button.setAttribute('aria-expanded', minimized ? 'false' : 'true');
        }
      });
    }
    function toggleCard(button) {
      const card = button.closest('.card');
      if (!card) return;
      const minimized = !card.classList.contains('collapsed');
      card.classList.toggle('collapsed', minimized);
      localStorage.setItem(cardStateKey(card), minimized ? '1' : '0');
      button.textContent = minimized ? 'Expand' : 'Minimize';
      button.setAttribute('aria-expanded', minimized ? 'false' : 'true');
    }

    function escapeHtml(value) {
      return String(value || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    function showOutput(v) {
      outputEl.style.display = 'block';
      outputEl.textContent = typeof v === 'string' ? v : JSON.stringify(v, null, 2);
    }

    function selectedWorkflow() {
      return workflowEl.value;
    }

    async function api(path, options) {
      const response = await fetch(path, options);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || ('Request failed (' + response.status + ')'));
      return data;
    }

    function parseDurationToSeconds(value) {
      if (!value) return null;
      const text = String(value).trim().toLowerCase();
      if (!text || text === '-') return null;
      const match = text.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h)?$/);
      if (!match) return null;
      const amount = Number(match[1]);
      const unit = match[2] || 's';
      if (unit === 'ms') return amount / 1000;
      if (unit === 'm') return amount * 60;
      if (unit === 'h') return amount * 3600;
      return amount;
    }

    function formatLocalDateTime(value) {
      if (!value) return '';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }

    function toFilterTimestamp(dateValue, timeValue, isEnd) {
      if (!dateValue) return NaN;
      const time = (timeValue || (isEnd ? '23:59' : '00:00')).trim();
      const m = time.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
      if (!m) return NaN;
      const ms = Date.parse(dateValue + 'T' + m[1] + ':' + m[2] + ':00');
      return Number.isNaN(ms) ? NaN : (isEnd ? (ms + 59999) : ms);
    }

    function normalizeTimeValue(value, fallback) {
      const v = String(value || '').trim();
      if (!v) return fallback;
      if (/^\d{2}:\d{2}$/.test(v)) return v;
      return fallback;
    }

    function renderTimeOptions(selectedValue) {
      const selected = normalizeTimeValue(selectedValue, '00:00');
      let html = '';
      for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m++) {
          const hh = String(h).padStart(2, '0');
          const mm = String(m).padStart(2, '0');
          const value = hh + ':' + mm;
          html += '<option value="' + value + '"' + (value === selected ? ' selected' : '') + '>' + value + '</option>';
        }
      }
      return html;
    }

    function matchesDurationFilter(durationSeconds, filterText) {
      const filter = (filterText || '').trim().toLowerCase();
      if (!filter) return true;
      if (durationSeconds === null) return false;
      const m = filter.match(/^(<=|>=|=|<|>)?\s*(\d+(?:\.\d+)?)\s*(ms|s|m|h)?$/);
      if (!m) return true;
      const op = m[1] || '=';
      const targetSeconds = parseDurationToSeconds(String(m[2]) + (m[3] || 's'));
      if (targetSeconds === null) return true;
      if (op === '>') return durationSeconds > targetSeconds;
      if (op === '<') return durationSeconds < targetSeconds;
      if (op === '>=') return durationSeconds >= targetSeconds;
      if (op === '<=') return durationSeconds <= targetSeconds;
      return durationSeconds === targetSeconds;
    }

    function updateFilterStateFromInputs() {
      runFilterState.quickRunId = (runIdSearchEl && runIdSearchEl.value ? runIdSearchEl.value : '').trim().toLowerCase();
      runFilterState.runId = ((document.getElementById('runFilterRunId') || {}).value || '').trim().toLowerCase();
      runFilterState.status = ((document.getElementById('runFilterStatus') || {}).value || '').trim().toLowerCase();
      runFilterState.startFromDate = ((document.getElementById('runFilterStartFromDate') || {}).value || '').trim();
      runFilterState.startFromTime = ((document.getElementById('runFilterStartFromTime') || {}).value || '').trim();
      runFilterState.startToDate = ((document.getElementById('runFilterStartToDate') || {}).value || '').trim();
      runFilterState.startToTime = ((document.getElementById('runFilterStartToTime') || {}).value || '').trim();
      runFilterState.duration = ((document.getElementById('runFilterDuration') || {}).value || '').trim().toLowerCase();
    }

    function composeFilterIso(dateValue, timeValue, isEnd) {
      if (!dateValue) return '';
      const time = normalizeTimeValue(timeValue, isEnd ? '23:59' : '00:00');
      const m = time.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
      if (!m) return '';
      const dt = new Date(
        Number(dateValue.slice(0, 4)),
        Number(dateValue.slice(5, 7)) - 1,
        Number(dateValue.slice(8, 10)),
        Number(m[1]),
        Number(m[2]),
        isEnd ? 59 : 0,
        isEnd ? 999 : 0
      );
      return Number.isNaN(dt.getTime()) ? '' : dt.toISOString();
    }

    function buildRunsQuery(failedOnly) {
      const params = new URLSearchParams();
      params.set('top', '1000');
      if (failedOnly) params.set('filter', "status eq 'Failed'");
      if (runFilterState.quickRunId) params.set('quickRunId', runFilterState.quickRunId);
      if (runFilterState.runId) params.set('runId', runFilterState.runId);
      if (runFilterState.status) params.set('status', runFilterState.status);
      const startFromIso = composeFilterIso(runFilterState.startFromDate, runFilterState.startFromTime, false);
      const startToIso = composeFilterIso(runFilterState.startToDate, runFilterState.startToTime, true);
      if (startFromIso) params.set('startFrom', startFromIso);
      if (startToIso) params.set('startTo', startToIso);
      if (runFilterState.duration) params.set('duration', runFilterState.duration);
      return params.toString();
    }

    async function loadRunsFromServer(failedOnly) {
      if (!selectedWorkflow()) { showOutput('No workflow selected. Click Refresh Workflows.'); return; }
      const modeLabel = failedOnly ? 'failed runs' : 'runs';
      showOutput('Loading ' + modeLabel + '...');
      currentFailedOnly = failedOnly;
      const query = buildRunsQuery(failedOnly);
      const data = await api('/api/workflows/' + encodeURIComponent(selectedWorkflow()) + '/runs?' + query);
      renderRuns(data.value || [], failedOnly);
    }

    async function applyServerFilters() {
      updateFilterStateFromInputs();
      await loadRunsFromServer(currentFailedOnly);
    }

    async function clearServerFilters() {
      runFilterState.runId = '';
      runFilterState.status = '';
      runFilterState.startFromDate = '';
      runFilterState.startFromTime = '00:00';
      runFilterState.startToDate = '';
      runFilterState.startToTime = '23:59';
      runFilterState.duration = '';
      if (runIdSearchEl) runIdSearchEl.value = '';
      runFilterState.quickRunId = '';
      await loadRunsFromServer(currentFailedOnly);
    }

    function renderRunTable() {
      if (!currentRuns.length) {
        resultsEl.innerHTML = '<div class="card">No runs found.</div>';
        return;
      }

      let html = '<div class="card" data-card="runs"><div class="card-header"><h3 class="card-title">Runs</h3><button type="button" class="card-toggle" onclick="toggleCard(this)">Minimize</button></div><div class="card-body"><div class="row">' +
        '<div style="min-width:220px;flex:1 1 220px;"><label class="muted">Run ID</label><input id="runFilterRunId" type="text" value="' + escapeHtml(runFilterState.runId) + '" placeholder="Filter Run ID" /></div>' +
        '<div style="min-width:160px;flex:1 1 160px;"><label class="muted">Status</label><select id="runFilterStatus"><option value="">All</option>';
      const statuses = Array.from(new Set(currentRuns.map((run) => String((run.properties || {}).status || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
      statuses.forEach((statusValue) => {
        const selected = statusValue.toLowerCase() === runFilterState.status ? ' selected' : '';
        html += '<option value="' + escapeHtml(statusValue.toLowerCase()) + '"' + selected + '>' + escapeHtml(statusValue) + '</option>';
      });
      html += '</select></div>' +
        '<div style="min-width:420px;flex:1 1 420px;"><label class="muted">Start (calendar span, 24h)</label><div class="row">' +
          '<div style="display:flex;gap:6px;align-items:center;"><span class="muted">From</span><input id="runFilterStartFromDate" type="date" value="' + escapeHtml(runFilterState.startFromDate) + '" /><select id="runFilterStartFromTime" style="width:110px;">' + renderTimeOptions(runFilterState.startFromTime || '00:00') + '</select></div>' +
          '<div style="display:flex;gap:6px;align-items:center;"><span class="muted">To</span><input id="runFilterStartToDate" type="date" value="' + escapeHtml(runFilterState.startToDate) + '" /><select id="runFilterStartToTime" style="width:110px;">' + renderTimeOptions(runFilterState.startToTime || '23:59') + '</select></div>' +
        '</div></div>' +
        '<div style="min-width:160px;flex:1 1 160px;"><label class="muted">Duration</label><input id="runFilterDuration" type="text" value="' + escapeHtml(runFilterState.duration) + '" placeholder="e.g. >4s, <4m, >=0.5s" /></div>' +
        '<div class="row" style="align-self:flex-end;"><button class="primary" onclick="applyServerFilters()">Apply Filters</button><button class="accent" onclick="clearServerFilters()">Clear Filters</button></div>' +
      '</div><table><tr><th>Run ID</th><th>Status</th><th>Start</th><th>Duration</th><th>Action</th></tr>';

      currentRuns.forEach((run) => {
        const p = run.properties || {};
        const start = formatLocalDateTime(p.startTime);
        const durationSeconds = p.endTime && p.startTime ? ((new Date(p.endTime) - new Date(p.startTime)) / 1000) : null;
        const duration = durationSeconds !== null ? (durationSeconds.toFixed(1) + 's') : '-';
        html += '<tr data-runid="' + escapeHtml(run.name) + '" data-status="' + escapeHtml(p.status || '') + '" data-start="' + escapeHtml(start) + '" data-start-iso="' + escapeHtml(p.startTime || '') + '" data-duration-seconds="' + (durationSeconds === null ? '' : durationSeconds) + '"><td>' + escapeHtml(run.name) + '</td><td>' + escapeHtml(p.status || '') + '</td><td>' + escapeHtml(start) + '</td><td>' + escapeHtml(duration) + '</td><td><button class="primary" onclick="resubmitRun(\\'' + run.name + '\\')">Resubmit</button> <button class="danger" onclick="cancelRun(\\'' + run.name + '\\')">Cancel</button></td></tr>';
      });
      html += '</table></div></div>';
      resultsEl.innerHTML = html;
      if (currentFailedOnly) showOutput('Loaded ' + currentRuns.length + ' failed run(s).'); else outputEl.style.display = 'none';
    }

    async function refreshWorkflows() {
      try {
        const data = await api('/api/workflows');
        const items = Array.isArray(data.value) ? data.value : (Array.isArray(data) ? data : []);
        workflowEl.innerHTML = '';
        items.forEach((item) => {
          const option = document.createElement('option');
          option.value = item.name;
          option.textContent = item.name;
          workflowEl.appendChild(option);
        });
        if (!items.length) {
          showOutput('No workflows returned by API. Retrying...');
          setTimeout(refreshWorkflows, 5000);
        }

      } catch (err) {
        showOutput('Workflow list failed: ' + err.message + ' (auto-retrying)');
        setTimeout(refreshWorkflows, 5000);
      }
    }

    function renderRuns(runs, failedOnly = false) {
      currentRuns = Array.isArray(runs) ? runs.slice() : [];
      currentFailedOnly = failedOnly;
      renderRunTable();
    }

    async function listRuns() {
      try {
        await loadRunsFromServer(false);
      } catch (err) {
        showOutput('Failed to load runs: ' + err.message);
      }
    }

    async function listFailedRuns() {
      try {
        await loadRunsFromServer(true);
      } catch (err) {
        showOutput('Failed to load failed runs: ' + err.message);
      }
    }

    async function resubmitRun(runId) {
      if (!selectedWorkflow()) { showOutput('No workflow selected. Click Refresh Workflows.'); return; }
      showOutput('Resubmitting ' + runId + '...');
      const data = await api('/api/workflows/' + encodeURIComponent(selectedWorkflow()) + '/runs/' + encodeURIComponent(runId) + '/resubmit', { method: 'POST' });
      showOutput(data);
      setTimeout(listRuns, 1500);
    }

    async function cancelRun(runId) {
      if (!selectedWorkflow()) { showOutput('No workflow selected. Click Refresh Workflows.'); return; }
      showOutput('Canceling ' + runId + '...');
      const data = await api('/api/workflows/' + encodeURIComponent(selectedWorkflow()) + '/runs/' + encodeURIComponent(runId) + '/cancel', { method: 'POST' });
      showOutput(data);
      setTimeout(listRuns, 1500);
    }

    async function resubmitFailed() {
      if (!selectedWorkflow()) { showOutput('No workflow selected. Click Refresh Workflows.'); return; }
      showOutput('Retrying failed runs...');
      const data = await api('/api/workflows/' + encodeURIComponent(selectedWorkflow()) + '/resubmit-failed', { method: 'POST' });
      showOutput(data);
      setTimeout(listRuns, 2000);
    }

    async function triggerWorkflow() {
      if (!selectedWorkflow()) { showOutput('No workflow selected. Click Refresh Workflows.'); return; }
      showOutput('Triggering ' + selectedWorkflow() + '...');
      const data = await api('/api/workflows/' + encodeURIComponent(selectedWorkflow()) + '/trigger', { method: 'POST' });
      showOutput(data);
      setTimeout(listRuns, 2000);
    }

    async function triggerRemote() {
      if (!selectedWorkflow()) { showOutput('No workflow selected. Click Refresh Workflows.'); return; }
      showOutput('Sending remote trigger for ' + selectedWorkflow() + '...');
      let payload = {};
      try { payload = JSON.parse(document.getElementById('payload').value || '{}'); } catch { throw new Error('Payload must be valid JSON'); }
      const data = await api('/api/workflows/' + encodeURIComponent(selectedWorkflow()) + '/trigger-remote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showOutput(data);
      setTimeout(listRuns, 2000);
    }

    async function getRemoteTriggerUrl() {
      if (!selectedWorkflow()) { showOutput('No workflow selected. Click Refresh Workflows.'); return; }
      showOutput('Loading callback URL for ' + selectedWorkflow() + '...');
      const data = await api('/api/workflows/' + encodeURIComponent(selectedWorkflow()) + '/callback-url');
      const callback = data.callbackUrl && data.callbackUrl.value ? data.callbackUrl.value : JSON.stringify(data.callbackUrl || {}, null, 2);
      resultsEl.innerHTML = '<div class="card" data-card="callback"><div class="card-header"><h3 class="card-title">Callback URL</h3><button type="button" class="card-toggle" onclick="toggleCard(this)">Minimize</button></div><div class="card-body"><div class="muted">Trigger: ' + (data.trigger || '') + '</div><textarea readonly>' + callback + '</textarea></div></div>';
      showOutput('Callback URL loaded.');
    }

    runIdSearchEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyServerFilters().catch(err => showOutput('Failed to apply filters: ' + err.message));
      }
    });
    window.addEventListener('focus', () => refreshWorkflows().catch(() => {}));
    setInterval(() => refreshWorkflows().catch(() => {}), 30000);
    initCards();
    refreshWorkflows().catch(err => showOutput(err.message));
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
  console.log(`Workflow Manager listening on http://localhost:${PORT}`);
  console.log(`Using Logic Apps base URL ${CONFIG.logicAppBase}`);
});
