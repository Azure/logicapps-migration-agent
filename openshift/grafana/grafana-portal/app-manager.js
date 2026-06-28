const { execFile } = require('child_process');
const { promisify } = require('util');
const http = require('http');

const CONFIG = {"port":3002,"namespace":"<NAMESPACE>","appName":"<APP_NAME>","kubeconfigPath":"<KUBECONFIG_PATH>","kubeContext":"<KUBE_CONTEXT>","ocPath":"oc"};
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
    .card.collapsed{padding-top:8px;padding-bottom:8px;margin-bottom:6px}
    .card-header{display:flex;justify-content:space-between;align-items:center;gap:8px}
    .card-title{margin:0;font-size:14px}
    .card-toggle{border:none;border-radius:4px;background:var(--surface);color:var(--text);padding:4px 8px;cursor:pointer}
    .card.collapsed .card-body{display:none}
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
  <div class="card" data-card="actions">
   <div class="card-header"><h3 class="card-title">Actions</h3><button type="button" class="card-toggle" onclick="toggleCard(this)">Minimize</button></div>
   <div class="card-body">
   <div class="row">
     <button class="primary" onclick="refresh()">Refresh</button>
     <button class="danger" onclick="restartApp()">App Restart</button>
   </div>
   <div id="summary" class="muted" style="margin-top:8px;"></div>
   </div>
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
    function cardStateKey(card){ return 'logic-app-manager-card:' + card.getAttribute('data-card'); }
    function initCards(){ document.querySelectorAll('.card[data-card]').forEach((card) => { const minimized = localStorage.getItem(cardStateKey(card)) === '1'; card.classList.toggle('collapsed', minimized); const btn = card.querySelector('.card-toggle'); if (btn) { btn.textContent = minimized ? 'Expand' : 'Minimize'; btn.setAttribute('aria-expanded', minimized ? 'false' : 'true'); } }); }
    function toggleCard(button){ const card = button.closest('.card'); if (!card) return; const minimized = !card.classList.contains('collapsed'); card.classList.toggle('collapsed', minimized); localStorage.setItem(cardStateKey(card), minimized ? '1' : '0'); button.textContent = minimized ? 'Expand' : 'Minimize'; button.setAttribute('aria-expanded', minimized ? 'false' : 'true'); }
    function renderApp(data){
      summaryEl.textContent = 'Namespace: ' + data.namespace + ' | App: ' + data.appName + ' | Image: ' + (data.image || '-');
      let appHtml = '<div class="card" data-card="app-config"><div class="card-header"><h3 class="card-title">App Configuration</h3><button type="button" class="card-toggle" onclick="toggleCard(this)">Minimize</button></div><div class="card-body"><div><span class="pill">Image: ' + (data.image || '-') + '</span></div><div class="muted" style="margin-top:6px;">Command: ' + (data.command || '-') + '</div><div class="muted">Args: ' + (data.args || '-') + '</div><div style="margin-top:10px;"><strong>Environment Settings</strong><table><tr><th>Name</th><th>Value / Source</th><th>Type</th></tr>';
      (data.env || []).forEach(e => { appHtml += '<tr><td>' + e.name + '</td><td>' + (e.value || '-') + '</td><td>' + e.source + '</td></tr>'; });
      appHtml += '</table></div></div></div>';
      appEl.innerHTML = appHtml;
      let revHtml = '<div class="card" data-card="revisions"><div class="card-header"><h3 class="card-title">Revisions / Replicas / Health</h3><button type="button" class="card-toggle" onclick="toggleCard(this)">Minimize</button></div><div class="card-body"><table><tr><th>Revision</th><th>Replicas</th><th>Ready</th><th>Health</th><th>Restarts</th><th>Pods</th><th>Action</th></tr>';
      (data.revisions || []).forEach(r => { revHtml += '<tr><td>' + r.revision + '</td><td>' + r.replicas + '</td><td>' + r.readyReplicas + '</td><td>' + r.health + '</td><td>' + r.restartCount + '</td><td>' + (r.pods || []).join('<br/>') + '</td><td><button class="danger" onclick="restartRevision(\\'' + r.revision + '\\')">Restart Revision</button></td></tr>'; });
      revisionsEl.innerHTML = revHtml + '</table></div></div>';
      let repHtml = '<div class="card" data-card="replicas"><div class="card-header"><h3 class="card-title">Replicas</h3><button type="button" class="card-toggle" onclick="toggleCard(this)">Minimize</button></div><div class="card-body"><table><tr><th>Pod</th><th>Revision</th><th>Phase</th><th>Ready</th><th>Restarts</th><th>Node</th><th>Action</th></tr>';
      (data.replicas || []).forEach(r => { repHtml += '<tr><td>' + r.pod + '</td><td>' + r.revision + '</td><td>' + r.phase + '</td><td>' + (r.ready ? 'Yes' : 'No') + '</td><td>' + r.restarts + '</td><td>' + (r.node || '-') + '</td><td><button class="danger" onclick="restartReplica(\\'' + r.pod + '\\')">Restart Replica</button></td></tr>'; });
      replicasEl.innerHTML = repHtml + '</table></div></div>';
    }
    async function refresh(){ summaryEl.textContent = 'Loading...'; const data = await api('/api/app'); renderApp(data); }
    async function restartApp(){ if(!confirm('Restart the entire app?')) return; await api('/api/app/restart', { method:'POST' }); await refresh(); }
    async function restartRevision(revision){ if(!confirm('Restart revision ' + revision + '?')) return; await api('/api/revisions/' + encodeURIComponent(revision) + '/restart', { method:'POST' }); await refresh(); }
    async function restartReplica(pod){ if(!confirm('Restart replica ' + pod + '?')) return; await api('/api/pods/' + encodeURIComponent(pod) + '/restart', { method:'POST' }); await refresh(); }
    initCards();
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
