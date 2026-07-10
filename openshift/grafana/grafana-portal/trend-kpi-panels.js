// Upgrades the count KPI stat panels (Total Runs, Succeeded, Failed) to the
// runs-API timeseries endpoint so they show a sparkline trend + an exact
// (non-abbreviated) total, with a smaller value font so the full number fits.
const http = require('http');

const HOST = '127.0.0.1', PORT = 3000;
const AUTH = 'Basic ' + Buffer.from('admin:admin').toString('base64');
const UID = 'logicapps-monitor-psrivas-la1001';
const API = `/apis/dashboard.grafana.app/v2beta1/namespaces/default/dashboards/${UID}`;
const TS_URL = 'http://host.docker.internal:3001/api/kpi/timeseries?window=24h';

// element key -> series field selector
const PANELS = {
  'panel-1': 'total',      // Total Runs
  'panel-2': 'succeeded',  // Succeeded
  'panel-3': 'failed'      // Failed
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

function trendQuery(selector) {
  return {
    kind: 'DataQuery',
    group: 'yesoreyeram-infinity-datasource',
    version: 'v0',
    datasource: { name: 'logicapps-kpi-api' },
    spec: {
      type: 'json', source: 'url', format: 'table', parser: 'backend', refId: 'A',
      url: TS_URL,
      url_options: { method: 'GET', data: '' },
      root_selector: 'series',
      json_options: { columnar: false, root_is_not_array: false },
      columns: [
        { selector: 'time', text: 'time', type: 'timestamp_epoch' },
        { selector, text: 'value', type: 'number' }
      ],
      filters: [], global_query_id: ''
    }
  };
}

(async () => {
  const get = await req('GET', API);
  if (get.status !== 200) { console.error('GET failed', get.status); process.exit(1); }
  const obj = get.json;
  const els = obj.spec.elements;

  for (const [key, selector] of Object.entries(PANELS)) {
    const el = els[key];
    if (!el) { console.warn('missing', key); continue; }
    const q = el.spec.data.spec.queries;
    q.length = 0;
    q.push({ kind: 'PanelQuery', spec: { query: trendQuery(selector), refId: 'A', hidden: false } });
    const viz = el.spec.vizConfig.spec;
    viz.options = viz.options || {};
    viz.options.reduceOptions = { calcs: ['sum'], fields: '/^value$/', values: false };
    viz.options.graphMode = 'area';          // sparkline trend
    viz.options.colorMode = 'value';
    viz.options.textMode = 'value';          // number only (panel title already names it)
    viz.options.justifyMode = 'auto';
    viz.options.text = { valueSize: 26, titleSize: 12 }; // smaller so exact number fits
    viz.fieldConfig = viz.fieldConfig || { defaults: {}, overrides: [] };
    viz.fieldConfig.defaults = viz.fieldConfig.defaults || {};
    viz.fieldConfig.defaults.unit = 'none';  // exact number, no 35K abbreviation
    viz.fieldConfig.defaults.decimals = 0;
    console.log(`  ${key} '${el.spec.title}' -> timeseries[${selector}] (trend + exact)`);
  }

  // Also normalise the two single-value KPI panels (Avg Duration, Success Rate)
  // so they render the number only (their column is named "value").
  for (const key of ['panel-4', 'panel-6']) {
    const el = els[key];
    if (!el) continue;
    const viz = el.spec.vizConfig.spec;
    viz.options = viz.options || {};
    viz.options.textMode = 'value';
    viz.options.text = { valueSize: 26, titleSize: 12 };
    console.log(`  ${key} '${el.spec.title}' -> value-only text`);
  }

  const put = await req('PUT', API, obj);
  if (put.status >= 200 && put.status < 300) console.log('PUT ok', put.status);
  else { console.error('PUT failed', put.status, JSON.stringify(put.json)); process.exit(1); }
})();
