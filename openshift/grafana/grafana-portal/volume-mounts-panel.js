// Repoints the "Volume Mounts" panel to the run-manager /api/volumes endpoint
// (via the Infinity datasource). Each row is a unique workflow subfolder mounted
// under /home/site/wwwroot, with a Health column tested by real folder access.
const http = require('http');

const HOST = '127.0.0.1', PORT = 3000;
const AUTH = 'Basic ' + Buffer.from('admin:admin').toString('base64');
const UID = 'logicapps-monitor-psrivas-la1001';
const API = `/apis/dashboard.grafana.app/v2beta1/namespaces/default/dashboards/${UID}`;
const VOL_URL = 'http://host.docker.internal:3001/api/volumes';
const PANEL = 'panel-19';

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const r = http.request({ host: HOST, port: PORT, path, method,
      headers: { Authorization: AUTH, 'Content-Type': 'application/json',
        'Accept': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      res => { let b = ''; res.on('data', c => b += c); res.on('end', () =>
        resolve({ status: res.statusCode, json: b ? JSON.parse(b) : null })); });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function volumesQuery() {
  return {
    kind: 'DataQuery',
    group: 'yesoreyeram-infinity-datasource',
    version: 'v0',
    datasource: { name: 'logicapps-kpi-api', uid: 'logicapps-kpi-api' },
    spec: {
      type: 'json', source: 'url', format: 'table', parser: 'backend', refId: 'A',
      url: VOL_URL,
      url_options: { method: 'GET', data: '' },
      root_selector: '',
      json_options: { columnar: false, root_is_not_array: false },
      columns: [
        { selector: 'Volume', text: 'Workflow', type: 'string' },
        { selector: 'MountPath', text: 'Mount Path', type: 'string' },
        { selector: 'Share', text: 'SMB Share', type: 'string' },
        { selector: 'Access', text: 'Access', type: 'string' },
        { selector: 'Health', text: 'Health', type: 'string' },
        { selector: 'Detail', text: 'Detail', type: 'string' },
        { selector: 'Files', text: 'Files', type: 'number' },
        { selector: 'Modified', text: 'Modified', type: 'string' }
      ],
      filters: [], global_query_id: ''
    }
  };
}

(async () => {
  const get = await req('GET', API);
  if (get.status !== 200) { console.error('GET failed', get.status); process.exit(1); }
  const obj = get.json;
  const el = obj.spec.elements[PANEL];
  if (!el) { console.error('missing', PANEL); process.exit(1); }

  const q = el.spec.data.spec.queries;
  q.length = 0;
  q.push({ kind: 'PanelQuery', spec: { query: volumesQuery(), refId: 'A', hidden: false } });

  // Keep it a table; add a colour-coded Health column + right-align Files.
  el.spec.vizConfig.group = 'table';
  const viz = el.spec.vizConfig.spec;
  viz.options = { cellHeight: 'sm', showHeader: true, footer: { show: false } };
  viz.fieldConfig = {
    defaults: { custom: { align: 'left', filterable: true } },
    overrides: [
      {
        matcher: { id: 'byName', options: 'Health' },
        properties: [
          { id: 'mappings', value: [
            { type: 'value', options: {
              'Healthy':   { text: '\u25CF Healthy',   color: 'green', index: 0 },
              'Unhealthy': { text: '\u25CF Unhealthy', color: 'red',   index: 1 }
            } }
          ] },
          { id: 'custom.cellOptions', value: { type: 'color-background', mode: 'basic' } },
          { id: 'custom.align', value: 'center' }
        ]
      },
      {
        matcher: { id: 'byName', options: 'Files' },
        properties: [ { id: 'custom.align', value: 'right' } ]
      }
    ]
  };
  console.log(`  ${PANEL} '${el.spec.title}' -> Infinity /api/volumes (health by folder access)`);

  const put = await req('PUT', API, obj);
  if (put.status >= 200 && put.status < 300) console.log('PUT ok', put.status);
  else { console.error('PUT failed', put.status, JSON.stringify(put.json)); process.exit(1); }
})();
