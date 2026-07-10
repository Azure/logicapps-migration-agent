// Adds two mssql time-series panels to the "Resource Metrics" tab:
//   panel-97 "Total Runs Over Time"    -> dynamic union over all [dt].flow%runs
//   panel-98 "Total Action Executions Over Time" -> dynamic union over flow%actions
// Both use dynamic table discovery (sys.tables) so they never break when Logic
// Apps rolls/drops per-flow tables. Bucketed to ~120 points across the range.
const http = require('http');

const HOST = '127.0.0.1', PORT = 3000;
const AUTH = 'Basic ' + Buffer.from('admin:admin').toString('base64');
const UID = 'logicapps-monitor-psrivas-la1001';
const API = `/apis/dashboard.grafana.app/v2beta1/namespaces/default/dashboards/${UID}`;
const TAB = 'Resource Metrics';
const PANELH = 8;

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

// Count-over-time trend across a dynamically discovered union of tables.
// tableLike: 'flow%runs' | 'flow%actions'; valueCol: legend/series name.
function totalTrendSql(tableLike, valueCol) {
  return `SET NOCOUNT ON;
DECLARE @from DATETIME = $__timeFrom();
DECLARE @to   DATETIME = $__timeTo();
DECLARE @bmin INT = CASE WHEN DATEDIFF(MINUTE,@from,@to)<=0 THEN 1 ELSE (DATEDIFF(MINUTE,@from,@to)/120)+1 END;
DECLARE @union NVARCHAR(MAX)=N'';
SELECT @union = @union + CASE WHEN @union=N'' THEN N'' ELSE N' UNION ALL ' END +
   N'SELECT CreatedTime FROM [dt].'+QUOTENAME(t.name)
FROM sys.tables t JOIN sys.schemas s ON t.schema_id=s.schema_id
WHERE s.name='dt' AND t.name LIKE '${tableLike}';
IF @union=N'' SET @union=N'SELECT CAST(NULL AS DATETIME) AS CreatedTime WHERE 1=0';
DECLARE @sql NVARCHAR(MAX)=
  N'SELECT DATEADD(MINUTE,(DATEDIFF(MINUTE,@from,CreatedTime)/@bmin)*@bmin,@from) AS time, COUNT(*) AS [${valueCol}]
    FROM ('+@union+N') x WHERE CreatedTime>=@from AND CreatedTime<@to
    GROUP BY DATEADD(MINUTE,(DATEDIFF(MINUTE,@from,CreatedTime)/@bmin)*@bmin,@from) ORDER BY 1';
EXEC sp_executesql @sql, N'@from DATETIME,@to DATETIME,@bmin INT',@from,@to,@bmin;`;
}

function mssqlQuery(rawSql) {
  return { kind: 'DataQuery', group: '', version: 'v0', spec: { format: 'time_series', rawSql } };
}

const NEW = [
  { key: 'panel-97', title: 'Total Runs Over Time',
    sql: totalTrendSql('flow%runs', 'Runs'), color: 'blue' },
  { key: 'panel-98', title: 'Total Action Executions Over Time',
    sql: totalTrendSql('flow%actions', 'Actions'), color: 'purple' }
];

(async () => {
  const get = await req('GET', API);
  if (get.status !== 200) { console.error('GET failed', get.status); process.exit(1); }
  const obj = get.json;
  const els = obj.spec.elements;

  // Find any existing time-series element to clone its viz structure.
  let tmplKey = Object.keys(els).find(k => els[k].spec.vizConfig &&
    els[k].spec.vizConfig.group === 'timeseries');
  if (!tmplKey) { console.error('no timeseries template element found'); process.exit(1); }
  console.log('cloning viz structure from', tmplKey);

  const tab = obj.spec.layout.spec.tabs.find(t => t.spec.title === TAB);
  if (!tab) { console.error('tab not found:', TAB); process.exit(1); }
  const items = tab.spec.layout.spec.items;
  let nextY = items.reduce((m, i) => Math.max(m, i.spec.y + i.spec.height), 0);

  for (const p of NEW) {
    const el = JSON.parse(JSON.stringify(els[tmplKey]));
    el.spec.title = p.title;
    el.spec.description = '';
    el.spec.data.spec.queries = [
      { kind: 'PanelQuery', spec: { refId: 'A', hidden: false, query: mssqlQuery(p.sql) } }
    ];
    el.spec.data.spec.transformations = [];
    el.spec.vizConfig.group = 'timeseries';
    const viz = el.spec.vizConfig.spec;
    viz.options = {
      legend: { showLegend: true, displayMode: 'list', placement: 'bottom', calcs: ['sum', 'max'] },
      tooltip: { mode: 'multi', sort: 'desc' }
    };
    viz.fieldConfig = { defaults: {
      unit: 'none', decimals: 0, color: { mode: 'fixed', fixedColor: p.color },
      custom: { drawStyle: 'bars', fillOpacity: 40, lineWidth: 1,
        gradientMode: 'opacity', showPoints: 'never', stacking: { mode: 'none' } }
    }, overrides: [] };

    els[p.key] = el;
    items.push({ kind: 'GridLayoutItem', spec: {
      x: 0, y: nextY, width: 24, height: PANELH,
      element: { kind: 'ElementReference', name: p.key } } });
    console.log(`added ${p.key} '${p.title}' at y=${nextY} h=${PANELH}`);
    nextY += PANELH;
  }

  const put = await req('PUT', API, obj);
  if (put.status >= 200 && put.status < 300) console.log('PUT ok', put.status);
  else { console.error('PUT failed', put.status, JSON.stringify(put.json)); process.exit(1); }
})();
