// Adds a per-POD health table (each pod in the Logic Apps namespace with its
// Phase / Ready / Restarts) to the Overview & Health tab, right under the
// per-namespace "Pod Health per Namespace" table.
const http = require('http');

const HOST = '127.0.0.1', PORT = 3000;
const AUTH = 'Basic ' + Buffer.from('admin:admin').toString('base64');
const UID = 'logicapps-monitor-psrivas-la1001';
const API = `/apis/dashboard.grafana.app/v2beta1/namespaces/default/dashboards/${UID}`;
const PROM = 'P37373C58A51F102A';
const NS = 'logicapps-aca-ns';
const NEWKEY = 'panel-96';
const TAB = 'Overview & Health';
const NEWH = 12;

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

function promQuery(refId, expr) {
  return { kind: 'PanelQuery', spec: { refId, hidden: false, query: {
    kind: 'DataQuery', group: 'prometheus', version: 'v0',
    datasource: { name: PROM },
    spec: { expr, format: 'table', instant: true, legendFormat: '' } } } };
}

(async () => {
  const get = await req('GET', API);
  if (get.status !== 200) { console.error('GET failed', get.status); process.exit(1); }
  const obj = get.json;
  const els = obj.spec.elements;

  // Clone the per-namespace table element as a structural template.
  const tmpl = JSON.parse(JSON.stringify(els['panel-13']));
  tmpl.spec.title = 'Pod Health (per Pod)';

  tmpl.spec.data.spec.queries = [
    promQuery('A', `kube_pod_status_phase{namespace="${NS}"} == 1`),
    promQuery('B', `sum by (pod) (kube_pod_container_status_restarts_total{namespace="${NS}"})`),
    promQuery('C', `kube_pod_status_ready{namespace="${NS}",condition="true"} == 1`)
  ];

  tmpl.spec.data.spec.transformations = [
    { kind: 'joinByField', spec: { id: 'joinByField', options: { byField: 'pod', mode: 'outer' } } },
    { kind: 'organize', spec: { id: 'organize', options: {
      excludeByName: { 'Time': true, 'Time 1': true, 'Time 2': true, 'Time 3': true,
        'Value #A': true, 'condition': true, 'phase': false },
      indexByName: { 'namespace': 0, 'pod': 1, 'phase': 2, 'Value #C': 3, 'Value #B': 4 },
      renameByName: { 'namespace': 'Namespace', 'pod': 'Pod', 'phase': 'Phase',
        'Value #B': 'Restarts', 'Value #C': 'Ready' }
    } } },
    { kind: 'sortBy', spec: { id: 'sortBy', options: { sort: [{ field: 'Pod', desc: false }] } } }
  ];

  tmpl.spec.vizConfig.group = 'table';
  tmpl.spec.vizConfig.spec.options = { cellHeight: 'sm', showHeader: true, footer: { show: false } };
  tmpl.spec.vizConfig.spec.fieldConfig = {
    defaults: { custom: { align: 'left', filterable: true } },
    overrides: [
      { matcher: { id: 'byName', options: 'Ready' }, properties: [
        { id: 'mappings', value: [
          { type: 'value', options: { '1': { text: '\u2705 Ready', color: 'green', index: 0 } } },
          { type: 'special', options: { match: 'null', result: { text: '\u274C Not Ready', color: 'red', index: 1 } } },
          { type: 'value', options: { '0': { text: '\u274C Not Ready', color: 'red', index: 2 } } }
        ] },
        { id: 'custom.cellOptions', value: { type: 'color-background', mode: 'basic' } },
        { id: 'custom.align', value: 'center' } ] },
      { matcher: { id: 'byName', options: 'Phase' }, properties: [
        { id: 'mappings', value: [
          { type: 'value', options: {
            'Running':   { color: 'green',  index: 0 },
            'Succeeded': { color: 'blue',   index: 1 },
            'Pending':   { color: 'yellow', index: 2 },
            'Failed':    { color: 'red',    index: 3 } } }
        ] },
        { id: 'custom.cellOptions', value: { type: 'color-background', mode: 'basic' } },
        { id: 'custom.align', value: 'center' } ] },
      { matcher: { id: 'byName', options: 'Restarts' }, properties: [
        { id: 'custom.align', value: 'center' },
        { id: 'custom.cellOptions', value: { type: 'color-background', mode: 'gradient' } },
        { id: 'thresholds', value: { mode: 'absolute', steps: [
          { color: 'green', value: null }, { color: 'red', value: 1 } ] } },
        { id: 'noValue', value: '0' } ] }
    ]
  };

  els[NEWKEY] = tmpl;

  // Insert into the Overview & Health tab under panel-13; push lower panels down.
  const tab = obj.spec.layout.spec.tabs.find(t => t.spec.title === TAB);
  const items = tab.spec.layout.spec.items;
  const p13 = items.find(i => i.spec.element.name === 'panel-13');
  const insertY = p13.spec.y + p13.spec.height; // = 23
  for (const it of items) { if (it.spec.y >= insertY) it.spec.y += NEWH; }
  items.push({ kind: 'GridLayoutItem', spec: {
    x: 0, y: insertY, width: 24, height: NEWH,
    element: { kind: 'ElementReference', name: NEWKEY } } });

  console.log(`added ${NEWKEY} 'Pod Health (per Pod)' at y=${insertY} h=${NEWH}`);

  const put = await req('PUT', API, obj);
  if (put.status >= 200 && put.status < 300) console.log('PUT ok', put.status);
  else { console.error('PUT failed', put.status, JSON.stringify(put.json)); process.exit(1); }
})();
