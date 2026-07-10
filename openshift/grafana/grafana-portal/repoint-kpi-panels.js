// Repoints the 5 top overview KPI stat panels from the fragile SQL static-union
// queries to the Workflow Manager runs-API aggregation endpoint via the Infinity
// datasource. Operates on the v2 (TabsLayout) dashboard so native tabs are kept.
const http = require('http');

const HOST = '127.0.0.1', PORT = 3000;
const AUTH = 'Basic ' + Buffer.from('admin:admin').toString('base64');
const UID = 'logicapps-monitor-psrivas-la1001';
const API = `/apis/dashboard.grafana.app/v2beta1/namespaces/default/dashboards/${UID}`;
const KPI_URL = 'http://host.docker.internal:3001/api/kpi/summary?window=24h';

// element key -> { selector, unit, decimals }
const PANELS = {
  'panel-1': { selector: 'totalRuns',      unit: 'short',   decimals: 0 }, // Total Runs
  'panel-2': { selector: 'succeeded',      unit: 'short',   decimals: 0 }, // Succeeded
  'panel-3': { selector: 'failed',         unit: 'short',   decimals: 0 }, // Failed
  'panel-4': { selector: 'avgDurationSec', unit: 's',       decimals: 2 }, // Avg Duration
  'panel-6': { selector: 'successRate',    unit: 'percent', decimals: 1 }  // Success Rate
};

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

function infinityQuery(selector) {
  return {
    kind: 'DataQuery',
    group: 'yesoreyeram-infinity-datasource',
    version: 'v0',
    datasource: { name: 'logicapps-kpi-api' },
    spec: {
      type: 'json',
      source: 'url',
      format: 'table',
      parser: 'backend',
      refId: 'A',
      url: KPI_URL,
      url_options: { method: 'GET', data: '' },
      root_selector: '',
      json_options: { columnar: false, root_is_not_array: true },
      columns: [{ selector, text: 'value', type: 'number' }],
      filters: [],
      global_query_id: ''
    }
  };
}

(async () => {
  const get = await req('GET', API);
  if (get.status !== 200) { console.error('GET failed', get.status, JSON.stringify(get.json)); process.exit(1); }
  const obj = get.json;
  const els = obj.spec.elements;

  let changed = 0;
  for (const [key, cfg] of Object.entries(PANELS)) {
    const el = els[key];
    if (!el) { console.warn('missing element', key); continue; }
    const title = el.spec.title;
    const q = el.spec.data.spec.queries;
    // Replace the single query with an Infinity query selecting one field.
    q.length = 0;
    q.push({ kind: 'PanelQuery', spec: { query: infinityQuery(cfg.selector), refId: 'A', hidden: false } });
    // Stat should show the single aggregated value.
    const viz = el.spec.vizConfig.spec;
    viz.options = viz.options || {};
    viz.options.reduceOptions = { calcs: ['lastNotNull'], fields: '', values: false };
    viz.options.graphMode = 'none';
    viz.options.textMode = 'value_and_name';
    viz.fieldConfig = viz.fieldConfig || { defaults: {}, overrides: [] };
    viz.fieldConfig.defaults = viz.fieldConfig.defaults || {};
    viz.fieldConfig.defaults.unit = cfg.unit;
    viz.fieldConfig.defaults.decimals = cfg.decimals;
    console.log(`  ${key} '${title}' -> Infinity[${cfg.selector}]`);
    changed++;
  }
  console.log(`changed ${changed} panels`);

  const put = await req('PUT', API, obj);
  if (put.status >= 200 && put.status < 300) {
    console.log('PUT ok', put.status, 'resourceVersion', put.json && put.json.metadata && put.json.metadata.resourceVersion);
  } else {
    console.error('PUT failed', put.status, JSON.stringify(put.json));
    process.exit(1);
  }
})();
