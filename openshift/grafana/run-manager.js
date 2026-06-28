const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3001);
// Use a local port-forward endpoint (for example 8088 -> pod port 80)
const LOGIC_APP_BASE = process.env.LOGIC_APP_BASE || 'http://localhost:8088';
const MASTER_KEY = process.env.MASTER_KEY || '<LOGICAPPS_MASTER_KEY>';

function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, LOGIC_APP_BASE);
    const bodyStr = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) },
      timeout: 15000
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    // GET /api/workflows - list all workflows
    if (path === '/api/workflows' && req.method === 'GET') {
      const result = await makeRequest('GET',
        `/runtime/webhooks/workflow/api/management/workflows?api-version=2020-05-01-preview&code=${MASTER_KEY}`);
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(result.body);
    }
    // GET /api/workflows/:name/runs - list runs
    else if (path.match(/^\/api\/workflows\/([^/]+)\/runs$/) && req.method === 'GET') {
      const workflow = path.match(/^\/api\/workflows\/([^/]+)\/runs$/)[1];
      const top = url.searchParams.get('top') || '20';
      const filter = url.searchParams.get('filter') || '';
      let apiPath = `/runtime/webhooks/workflow/api/management/workflows/${workflow}/runs?api-version=2020-05-01-preview&code=${MASTER_KEY}&$top=${top}`;
      if (filter) apiPath += `&$filter=${encodeURIComponent(filter)}`;
      const result = await makeRequest('GET', apiPath);
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(result.body);
    }
    // POST /api/workflows/:name/runs/:runId/resubmit - resubmit a run via trigger histories
    else if (path.match(/^\/api\/workflows\/([^/]+)\/runs\/([^/]+)\/resubmit$/) && req.method === 'POST') {
      const [, workflow, runId] = path.match(/^\/api\/workflows\/([^/]+)\/runs\/([^/]+)\/resubmit$/);
      // Get the run to find its trigger name
      const runResult = await makeRequest('GET',
        `/runtime/webhooks/workflow/api/management/workflows/${workflow}/runs/${runId}?api-version=2020-05-01-preview&code=${MASTER_KEY}`);
      const run = JSON.parse(runResult.body);
      const triggerName = run.properties && run.properties.trigger && run.properties.trigger.name;
      if (!triggerName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Could not determine trigger name for this run' }));
        return;
      }
      const result = await makeRequest('POST',
        `/runtime/webhooks/workflow/api/management/workflows/${workflow}/triggers/${encodeURIComponent(triggerName)}/histories/${runId}/resubmit?api-version=2020-05-01-preview&code=${MASTER_KEY}`);
      const ok = result.status === 202;
      res.writeHead(ok ? 200 : result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: ok ? `Resubmitted run ${runId} via trigger '${triggerName}'` : `Resubmit failed (${result.status})`, status: result.status, error: ok ? undefined : result.body }));
    }
    // POST /api/workflows/:name/resubmit-failed - resubmit all failed runs via trigger histories
    else if (path.match(/^\/api\/workflows\/([^/]+)\/resubmit-failed$/) && req.method === 'POST') {
      const workflow = path.match(/^\/api\/workflows\/([^/]+)\/resubmit-failed$/)[1];
      const runsResult = await makeRequest('GET',
        `/runtime/webhooks/workflow/api/management/workflows/${workflow}/runs?api-version=2020-05-01-preview&code=${MASTER_KEY}&$top=50&$filter=status eq 'Failed'`);
      const runs = JSON.parse(runsResult.body);
      if (!runs.value || runs.value.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: `No failed runs found for ${workflow}`, results: [] }));
        return;
      }
      const results = [];
      for (const run of runs.value) {
        const runName = run.name;
        const triggerName = run.properties && run.properties.trigger && run.properties.trigger.name;
        if (triggerName) {
          const r = await makeRequest('POST',
            `/runtime/webhooks/workflow/api/management/workflows/${workflow}/triggers/${encodeURIComponent(triggerName)}/histories/${runName}/resubmit?api-version=2020-05-01-preview&code=${MASTER_KEY}`);
          results.push({ runId: runName, status: r.status, trigger: triggerName });
        } else {
          results.push({ runId: runName, status: 'skipped', reason: 'no trigger name found' });
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: `Resubmitted ${results.filter(r => r.status === 202).length}/${results.length} failed runs for ${workflow}`, results }));
    }
    // POST /api/workflows/:name/trigger - manually trigger a workflow (uses actual trigger name)
    else if (path.match(/^\/api\/workflows\/([^/]+)\/trigger$/) && req.method === 'POST') {
      const workflow = path.match(/^\/api\/workflows\/([^/]+)\/trigger$/)[1];
      // Get workflow details to find the trigger name
      const wfResult = await makeRequest('GET',
        `/runtime/webhooks/workflow/api/management/workflows/${workflow}?api-version=2020-05-01-preview&code=${MASTER_KEY}`);
      const wfData = JSON.parse(wfResult.body);
      const triggers = wfData.triggers || (wfData.properties && wfData.properties.triggers) || {};
      const triggerNames = Object.keys(triggers);
      const triggerName = triggerNames.length > 0 ? triggerNames[0] : 'manual';
      const result = await makeRequest('POST',
        `/runtime/webhooks/workflow/api/management/workflows/${workflow}/triggers/${encodeURIComponent(triggerName)}/run?api-version=2020-05-01-preview&code=${MASTER_KEY}`);
      const ok = result.status === 200 || result.status === 202;
      res.writeHead(ok ? 200 : result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: ok ? `Triggered ${workflow} via '${triggerName}'` : `Trigger failed (${result.status})`, status: result.status, trigger: triggerName, error: ok ? undefined : result.body }));
    }
    // GET /api/workflows/:name/callback-url - get the remote trigger callback URL
    else if (path.match(/^\/api\/workflows\/([^/]+)\/callback-url$/) && req.method === 'GET') {
      const workflow = path.match(/^\/api\/workflows\/([^/]+)\/callback-url$/)[1];
      // Get workflow to find trigger name
      const wfResult = await makeRequest('GET',
        `/runtime/webhooks/workflow/api/management/workflows/${workflow}?api-version=2020-05-01-preview&code=${MASTER_KEY}`);
      const wfData = JSON.parse(wfResult.body);
      const triggers = wfData.triggers || (wfData.properties && wfData.properties.triggers) || {};
      const triggerNames = Object.keys(triggers);
      const triggerName = triggerNames.length > 0 ? triggerNames[0] : 'manual';
      // Get callback URL
      const cbResult = await makeRequest('POST',
        `/runtime/webhooks/workflow/api/management/workflows/${workflow}/triggers/${encodeURIComponent(triggerName)}/listCallbackUrl?api-version=2020-05-01-preview&code=${MASTER_KEY}`);
      res.writeHead(cbResult.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ workflow, trigger: triggerName, callbackUrl: JSON.parse(cbResult.body) }));
    }
    // GET / - dashboard with buttons
    else if (path === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Logic Apps Run Manager</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #f4f5f5; --bg-card: #ffffff; --border: #e4e4e7; --text: #1f1f1f;
    --text-secondary: #6e6e78; --text-muted: #464650; --hover-bg: #eef2fb;
    --input-bg: #ffffff; --input-border: #c7c7cc; --output-bg: #f8f8f8;
    --th-color: #3871dc; --green: #1a7f4b; --red: #e02f44; --orange: #d48806;
  }
  body.dark {
    --bg: transparent; --bg-card: #1e1e2e; --border: #2c3235; --text: #ccccdc;
    --text-secondary: #8e8ea0; --text-muted: #8e8ea0; --hover-bg: #262633;
    --input-bg: #09090b; --input-border: #2c3235; --output-bg: #09090b;
    --th-color: #6e9fff; --green: #73bf69; --red: #f2495c; --orange: #ff9830;
  }
  body { font-family: Inter, Helvetica, Arial, sans-serif; background: var(--bg); color: var(--text); padding: 12px 16px; font-size: 13px; line-height: 1.5; }
  h1 { color: var(--text); font-size: 16px; font-weight: 500; margin-bottom: 12px; }
  .section { background: var(--bg-card); border: 1px solid var(--border); border-radius: 4px; padding: 12px; margin-bottom: 10px; }
  .btn { padding: 5px 12px; margin: 0 4px 4px 0; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-family: inherit; transition: opacity 0.15s; }
  .btn:hover { opacity: 0.85; }
  .btn-primary { background: #3871dc; color: #fff; }
  .btn-danger { background: #e02f44; color: #fff; }
  .btn-success { background: #1a7f4b; color: #fff; }
  .btn-sm { padding: 3px 8px; font-size: 12px; }
  select { padding: 5px 8px; font-size: 13px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--input-border); font-family: inherit; min-width: 180px; }
  select:focus { border-color: #3871dc; outline: none; box-shadow: 0 0 0 2px rgba(56,113,220,0.2); }
  #output { background: var(--output-bg); border: 1px solid var(--border); padding: 8px 10px; border-radius: 4px; margin-top: 8px; white-space: pre-wrap; font-family: 'Roboto Mono', monospace; font-size: 12px; max-height: 200px; overflow-y: auto; color: var(--text-muted); }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; color: var(--th-color); font-weight: 500; font-size: 12px; padding: 6px 8px; border-bottom: 2px solid var(--border); }
  td { padding: 5px 8px; border-bottom: 1px solid var(--border); font-size: 12px; color: var(--text); }
  tr:hover { background: var(--hover-bg); }
  .status-succeeded { color: var(--green); font-weight: 500; }
  .status-failed { color: var(--red); font-weight: 500; }
  .status-running { color: var(--orange); font-weight: 500; }
  .inline-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .label { color: var(--text-secondary); font-size: 12px; }
</style></head><body>
<script>
// Auto-detect Grafana theme from parent frame
(function() {
  try {
    var parentBody = window.parent.document.body;
    if (parentBody && parentBody.classList.contains('theme-dark')) {
      document.body.classList.add('dark');
    }
  } catch(e) {
    // Cross-origin — fall back to checking prefers-color-scheme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.body.classList.add('dark');
    }
  }
  // Also accept ?theme=dark query param
  if (new URLSearchParams(window.location.search).get('theme') === 'dark') {
    document.body.classList.add('dark');
  }
})();
</script>
<h1>⚡ Run Manager</h1>
<div class="section">
  <div class="inline-row">
    <span class="label">Workflow</span>
    <select id="workflow"></select>
    <button class="btn btn-primary" onclick="listRuns()">List Runs</button>
    <button class="btn btn-danger" onclick="listFailedRuns()">Failed Runs</button>
    <button class="btn btn-danger" onclick="resubmitFailed()">Retry All Failed</button>
    <button class="btn btn-success" onclick="triggerWorkflow()">Trigger</button>
    <button class="btn btn-success" onclick="getRemoteTriggerUrl()" style="background:#6f42c1;">Remote URL</button>
  </div>
</div>
<div id="output" style="display:none;"></div>
<div id="runs-table"></div>
<script>
const wf = () => document.getElementById('workflow').value;
const outEl = document.getElementById('output');
function out(msg) { outEl.style.display='block'; outEl.textContent = typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2); }

// Auto-populate workflow dropdown from API
fetch('/api/workflows').then(r=>r.json()).then(data => {
  const sel = document.getElementById('workflow');
  (Array.isArray(data) ? data : []).forEach(w => {
    const opt = document.createElement('option');
    opt.value = w.name; opt.textContent = w.name;
    sel.appendChild(opt);
  });
}).catch(() => {});

function statusClass(s) { return s==='Succeeded'?'status-succeeded':s==='Failed'?'status-failed':'status-running'; }

async function resubmitFailed() {
  out('Resubmitting failed runs for ' + wf() + '...');
  const r = await fetch('/api/workflows/' + wf() + '/resubmit-failed', { method: 'POST' });
  out(await r.json());
  setTimeout(listRuns, 1500);
}
async function listRuns() {
  out('Loading...');
  const r = await fetch('/api/workflows/' + wf() + '/runs?top=20');
  const data = await r.json();
  const runs = data.value || [];
  if (!runs.length) { out('No runs found'); document.getElementById('runs-table').innerHTML=''; return; }
  let html = '<table><tr><th>Run ID</th><th>Status</th><th>Start</th><th>Duration</th><th></th></tr>';
  runs.forEach(run => {
    const p = run.properties, st = p.status;
    const start = (p.startTime||'').replace('T',' ').substr(0,19);
    const dur = p.endTime && p.startTime ? ((new Date(p.endTime)-new Date(p.startTime))/1000).toFixed(1)+'s' : '-';
    html += '<tr><td>' + run.name.substr(0,22) + '…</td><td class="' + statusClass(st) + '">' + st + '</td><td>' + start + '</td><td>' + dur + '</td><td><button class="btn btn-primary btn-sm" onclick="resubmitRun(\\'' + run.name + '\\')">Resubmit</button></td></tr>';
  });
  html += '</table>';
  document.getElementById('runs-table').innerHTML = html;
  outEl.style.display='none';
}
async function listFailedRuns() {
  out('Loading...');
  const r = await fetch('/api/workflows/' + wf() + "/runs?top=50&filter=status eq 'Failed'");
  const data = await r.json();
  const runs = data.value || [];
  if (!runs.length) { out('No failed runs found ✓'); document.getElementById('runs-table').innerHTML=''; return; }
  let html = '<table><tr><th>Run ID</th><th>Start</th><th></th></tr>';
  runs.forEach(run => {
    const start = (run.properties.startTime||'').replace('T',' ').substr(0,19);
    html += '<tr><td>' + run.name.substr(0,25) + '…</td><td>' + start + '</td><td><button class="btn btn-danger btn-sm" onclick="resubmitRun(\\'' + run.name + '\\')">Resubmit</button></td></tr>';
  });
  html += '</table>';
  document.getElementById('runs-table').innerHTML = html;
  outEl.style.display='none';
}
async function resubmitRun(runId) {
  out('Resubmitting ' + runId + '...');
  const r = await fetch('/api/workflows/' + wf() + '/runs/' + runId + '/resubmit', { method: 'POST' });
  out(await r.json());
  setTimeout(listRuns, 1500);
}
async function triggerWorkflow() {
  out('Triggering ' + wf() + '...');
  const r = await fetch('/api/workflows/' + wf() + '/trigger', { method: 'POST' });
  out(await r.json());
  setTimeout(listRuns, 2000);
}
async function getRemoteTriggerUrl() {
  out('Getting remote trigger URL for ' + wf() + '...');
  const r = await fetch('/api/workflows/' + wf() + '/callback-url');
  const data = await r.json();
  if (data.callbackUrl && data.callbackUrl.value) {
    const url = data.callbackUrl.value;
    const method = data.callbackUrl.method || 'POST';
    let html = '<div class="section"><h2 style="color:var(--text-secondary);margin-bottom:6px;">Remote Trigger URL - ' + wf() + '</h2>';
    html += '<p style="margin-bottom:6px;"><strong>Method:</strong> ' + method + '</p>';
    html += '<input type="text" value="' + url + '" readonly style="width:100%;padding:6px 8px;font-size:11px;font-family:monospace;background:var(--output-bg);color:var(--text);border:1px solid var(--border);border-radius:4px;" onclick="this.select()" />';
    html += '<p style="margin-top:6px;color:var(--text-secondary);font-size:11px;">Use this URL to trigger the workflow from any external system (e.g. curl, Postman, CI/CD pipeline).</p>';
    html += '<button class="btn btn-primary btn-sm" style="margin-top:6px;" onclick="navigator.clipboard.writeText(\\'' + url.replace(/'/g,"\\\\'") + '\\');out(\\'Copied to clipboard!\\')">Copy URL</button>';
    html += '</div>';
    document.getElementById('runs-table').innerHTML = html;
    out('Remote URL retrieved for trigger: ' + data.trigger);
  } else {
    out(data);
  }
}
</script></body></html>`);
    }
    else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found', availableEndpoints: [
        'GET /', 'GET /api/workflows', 'GET /api/workflows/:name/runs',
        'POST /api/workflows/:name/runs/:runId/resubmit',
        'POST /api/workflows/:name/resubmit-failed',
        'POST /api/workflows/:name/trigger'
      ]}));
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Logic Apps Run Manager listening on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  GET  /                                    - Web UI');
  console.log('  GET  /api/workflows                      - List workflows');
  console.log('  GET  /api/workflows/:name/runs           - List runs');
  console.log('  POST /api/workflows/:name/runs/:id/resubmit - Resubmit run');
  console.log('  POST /api/workflows/:name/resubmit-failed   - Resubmit all failed');
  console.log('  POST /api/workflows/:name/trigger           - Trigger workflow');
});
