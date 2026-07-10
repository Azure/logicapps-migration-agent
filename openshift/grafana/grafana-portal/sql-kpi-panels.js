// Repoints the 5 top KPI panels to the mssql datasource using DYNAMIC table
// discovery (union built from sys.tables at query time). This is reliable:
//  - served by Grafana's mssql datasource straight to local SQL (no Node run
//    manager, no 8088 tunnel to die, no 100s scan),
//  - immune to Logic Apps dropping/rolling run tables (the original static
//    union broke when a referenced table vanished -> all KPIs blanked).
const http = require('http');

const HOST = '127.0.0.1', PORT = 3000;
const AUTH = 'Basic ' + Buffer.from('admin:admin').toString('base64');
const UID = 'logicapps-monitor-psrivas-la1001';
const API = `/apis/dashboard.grafana.app/v2beta1/namespaces/default/dashboards/${UID}`;

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

// Count-over-time trend (bucketed inside dynamic SQL; time bounds hoisted to
// @from/@to so no $__timeGroup text leaks into the dynamic literal).
function trendSql(statusPredicate) {
  return `SET NOCOUNT ON;
DECLARE @from DATETIME = $__timeFrom();
DECLARE @to   DATETIME = $__timeTo();
DECLARE @bmin INT = CASE WHEN DATEDIFF(MINUTE,@from,@to)<=0 THEN 1 ELSE (DATEDIFF(MINUTE,@from,@to)/120)+1 END;
DECLARE @union NVARCHAR(MAX)=N'';
SELECT @union = @union + CASE WHEN @union=N'' THEN N'' ELSE N' UNION ALL ' END +
   N'SELECT CreatedTime,[Status] FROM [dt].'+QUOTENAME(t.name)
FROM sys.tables t JOIN sys.schemas s ON t.schema_id=s.schema_id
WHERE s.name='dt' AND t.name LIKE 'flow%runs';
DECLARE @sql NVARCHAR(MAX)=
  N'SELECT DATEADD(MINUTE,(DATEDIFF(MINUTE,@from,CreatedTime)/@bmin)*@bmin,@from) AS time, COUNT(*) AS value
    FROM ('+@union+N') x WHERE CreatedTime>=@from AND CreatedTime<@to ${statusPredicate}
    GROUP BY DATEADD(MINUTE,(DATEDIFF(MINUTE,@from,CreatedTime)/@bmin)*@bmin,@from) ORDER BY 1';
EXEC sp_executesql @sql, N'@from DATETIME,@to DATETIME,@bmin INT',@from,@to,@bmin;`;
}

const AVG_SQL = `SET NOCOUNT ON;
DECLARE @from DATETIME=$__timeFrom(),@to DATETIME=$__timeTo();
DECLARE @union NVARCHAR(MAX)=N'';
SELECT @union=@union+CASE WHEN @union=N'' THEN N'' ELSE N' UNION ALL ' END+
   N'SELECT CreatedTime,EndTime FROM [dt].'+QUOTENAME(t.name)
FROM sys.tables t JOIN sys.schemas s ON t.schema_id=s.schema_id
WHERE s.name='dt' AND t.name LIKE 'flow%runs';
DECLARE @sql NVARCHAR(MAX)=
  N'SELECT CAST(AVG(CASE WHEN EndTime IS NOT NULL THEN DATEDIFF(MILLISECOND,CreatedTime,EndTime)/1000.0 END) AS DECIMAL(10,2)) AS value
    FROM ('+@union+N') x WHERE CreatedTime>=@from AND CreatedTime<@to';
EXEC sp_executesql @sql,N'@from DATETIME,@to DATETIME',@from,@to;`;

const RATE_SQL = `SET NOCOUNT ON;
DECLARE @from DATETIME=$__timeFrom(),@to DATETIME=$__timeTo();
DECLARE @union NVARCHAR(MAX)=N'';
SELECT @union=@union+CASE WHEN @union=N'' THEN N'' ELSE N' UNION ALL ' END+
   N'SELECT CreatedTime,[Status] FROM [dt].'+QUOTENAME(t.name)
FROM sys.tables t JOIN sys.schemas s ON t.schema_id=s.schema_id
WHERE s.name='dt' AND t.name LIKE 'flow%runs';
DECLARE @sql NVARCHAR(MAX)=
  N'SELECT CAST(100.0*SUM(CASE WHEN [Status]=''Succeeded'' THEN 1 ELSE 0 END)/NULLIF(SUM(CASE WHEN [Status] IN(''Succeeded'',''Failed'') THEN 1 ELSE 0 END),0) AS DECIMAL(5,1)) AS value
    FROM ('+@union+N') x WHERE CreatedTime>=@from AND CreatedTime<@to';
EXEC sp_executesql @sql,N'@from DATETIME,@to DATETIME',@from,@to;`;

// key -> { rawSql, format, calc, graphMode, unit, decimals }
const PANELS = {
  'panel-1': { rawSql: trendSql(''),                              format: 'time_series', calc: 'sum',         graphMode: 'area', unit: 'none',    decimals: 0 },
  'panel-2': { rawSql: trendSql("AND [Status]=''Succeeded''"),    format: 'time_series', calc: 'sum',         graphMode: 'area', unit: 'none',    decimals: 0 },
  'panel-3': { rawSql: trendSql("AND [Status]=''Failed''"),       format: 'time_series', calc: 'sum',         graphMode: 'area', unit: 'none',    decimals: 0 },
  'panel-4': { rawSql: AVG_SQL,                                   format: 'table',       calc: 'lastNotNull', graphMode: 'none', unit: 's',       decimals: 2 },
  'panel-6': { rawSql: RATE_SQL,                                  format: 'table',       calc: 'lastNotNull', graphMode: 'none', unit: 'percent', decimals: 1 }
};

function mssqlQuery(rawSql, format) {
  // group:'' + no datasource => the default datasource (LogicApp-SQL / mssql),
  // matching the dashboard's original working SQL panels.
  return { kind: 'DataQuery', group: '', version: 'v0', spec: { format, rawSql } };
}

(async () => {
  const get = await req('GET', API);
  if (get.status !== 200) { console.error('GET failed', get.status); process.exit(1); }
  const obj = get.json;
  const els = obj.spec.elements;

  for (const [key, cfg] of Object.entries(PANELS)) {
    const el = els[key];
    if (!el) { console.warn('missing', key); continue; }
    const q = el.spec.data.spec.queries;
    q.length = 0;
    q.push({ kind: 'PanelQuery', spec: { query: mssqlQuery(cfg.rawSql, cfg.format), refId: 'A', hidden: false } });
    const viz = el.spec.vizConfig.spec;
    viz.options = viz.options || {};
    viz.options.reduceOptions = { calcs: [cfg.calc], fields: '/^value$/', values: false };
    viz.options.graphMode = cfg.graphMode;
    viz.options.colorMode = 'value';
    viz.options.textMode = 'value';
    viz.options.text = { valueSize: 26, titleSize: 12 };
    viz.fieldConfig = viz.fieldConfig || { defaults: {}, overrides: [] };
    viz.fieldConfig.defaults = viz.fieldConfig.defaults || {};
    viz.fieldConfig.defaults.unit = cfg.unit;
    viz.fieldConfig.defaults.decimals = cfg.decimals;
    console.log(`  ${key} '${el.spec.title}' -> mssql dynamic (${cfg.format}, calc=${cfg.calc})`);
  }

  const put = await req('PUT', API, obj);
  if (put.status >= 200 && put.status < 300) console.log('PUT ok', put.status);
  else { console.error('PUT failed', put.status, JSON.stringify(put.json)); process.exit(1); }
})();
