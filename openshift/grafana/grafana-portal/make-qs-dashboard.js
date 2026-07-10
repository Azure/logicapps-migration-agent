const http = require('http');

const DS = { type: 'mssql', uid: 'PE70B8C5054295439' };
const t = (sql, fmt = 'table', refId = 'A') => ({ refId, datasource: DS, rawSql: sql, format: fmt });
const gp = (h, w, x, y) => ({ h, w, x, y });

let pid = 1;
const panels = [];
const add = (p) => { p.id = pid++; panels.push(p); };

add({ type: 'row', title: 'Query Store - Load Test', gridPos: gp(1, 24, 0, 0) });

add({
  type: 'timeseries', title: 'Query Executions / min (throughput)', datasource: DS, gridPos: gp(8, 12, 0, 1),
  fieldConfig: { defaults: { custom: { drawStyle: 'bars', fillOpacity: 40 }, unit: 'short' }, overrides: [] },
  options: { legend: { showLegend: false } },
  targets: [t(
    'SELECT rsi.start_time AS time, SUM(rs.count_executions) AS [Executions] ' +
    'FROM sys.query_store_runtime_stats rs ' +
    'JOIN sys.query_store_runtime_stats_interval rsi ON rs.runtime_stats_interval_id = rsi.runtime_stats_interval_id ' +
    'WHERE $__timeFilter(rsi.start_time) GROUP BY rsi.start_time ORDER BY rsi.start_time', 'time_series')]
});

add({
  type: 'timeseries', title: 'Avg Duration & CPU (ms) over time', datasource: DS, gridPos: gp(8, 12, 12, 1),
  fieldConfig: { defaults: { custom: { drawStyle: 'line', fillOpacity: 10 }, unit: 'ms' }, overrides: [] },
  options: { legend: { showLegend: true, placement: 'bottom' } },
  targets: [t(
    'SELECT rsi.start_time AS time, ' +
    'CAST(SUM(rs.avg_duration*rs.count_executions)/NULLIF(SUM(rs.count_executions),0)/1000.0 AS DECIMAL(12,2)) AS [Avg ms], ' +
    'CAST(SUM(rs.avg_cpu_time*rs.count_executions)/NULLIF(SUM(rs.count_executions),0)/1000.0 AS DECIMAL(12,2)) AS [CPU ms] ' +
    'FROM sys.query_store_runtime_stats rs ' +
    'JOIN sys.query_store_runtime_stats_interval rsi ON rs.runtime_stats_interval_id = rsi.runtime_stats_interval_id ' +
    'WHERE $__timeFilter(rsi.start_time) GROUP BY rsi.start_time ORDER BY rsi.start_time', 'time_series')]
});

add({
  type: 'table', title: 'Top Queries by Total Duration', datasource: DS, gridPos: gp(9, 24, 0, 9),
  options: { showHeader: true },
  targets: [t(
    'SELECT TOP 25 q.query_id AS [Query ID], SUBSTRING(t.query_sql_text,1,200) AS [SQL], ' +
    'SUM(rs.count_executions) AS [Execs], ' +
    'CAST(SUM(rs.avg_duration*rs.count_executions)/1000.0 AS DECIMAL(18,1)) AS [Total ms], ' +
    'CAST(AVG(rs.avg_duration)/1000.0 AS DECIMAL(12,2)) AS [Avg ms], ' +
    'CAST(MAX(rs.max_duration)/1000.0 AS DECIMAL(12,2)) AS [Max ms], ' +
    'CAST(AVG(rs.avg_cpu_time)/1000.0 AS DECIMAL(12,2)) AS [Avg CPU ms], ' +
    'CAST(AVG(rs.avg_logical_io_reads) AS BIGINT) AS [Avg Reads] ' +
    'FROM sys.query_store_runtime_stats rs ' +
    'JOIN sys.query_store_plan p ON rs.plan_id=p.plan_id ' +
    'JOIN sys.query_store_query q ON p.query_id=q.query_id ' +
    'JOIN sys.query_store_query_text t ON q.query_text_id=t.query_text_id ' +
    'GROUP BY q.query_id, t.query_sql_text ORDER BY [Total ms] DESC', 'table')]
});

add({
  type: 'table', title: 'Wait Statistics by Category', datasource: DS, gridPos: gp(9, 12, 0, 18),
  options: { showHeader: true },
  targets: [t(
    'SELECT ws.wait_category_desc AS [Wait Category], ' +
    'CAST(SUM(ws.total_query_wait_time_ms) AS BIGINT) AS [Total Wait ms], ' +
    'CAST(SUM(ws.avg_query_wait_time_ms*ws.count_executions)/NULLIF(SUM(ws.count_executions),0) AS DECIMAL(12,2)) AS [Avg Wait ms], ' +
    'SUM(ws.count_executions) AS [Execs] ' +
    'FROM sys.query_store_wait_stats ws GROUP BY ws.wait_category_desc ORDER BY [Total Wait ms] DESC', 'table')]
});

add({
  type: 'table', title: 'Most Frequent Queries', datasource: DS, gridPos: gp(9, 12, 12, 18),
  options: { showHeader: true },
  targets: [t(
    'SELECT TOP 25 q.query_id AS [Query ID], SUBSTRING(t.query_sql_text,1,160) AS [SQL], ' +
    'SUM(rs.count_executions) AS [Execs], ' +
    'CAST(AVG(rs.avg_duration)/1000.0 AS DECIMAL(12,2)) AS [Avg ms] ' +
    'FROM sys.query_store_runtime_stats rs ' +
    'JOIN sys.query_store_plan p ON rs.plan_id=p.plan_id ' +
    'JOIN sys.query_store_query q ON p.query_id=q.query_id ' +
    'JOIN sys.query_store_query_text t ON q.query_text_id=t.query_text_id ' +
    'GROUP BY q.query_id, t.query_sql_text ORDER BY [Execs] DESC', 'table')]
});

const dashboard = {
  uid: 'sql-loadtest-qs-psrivas',
  title: 'SQL Load Test - Query Store (psrivas-la1001)',
  tags: ['sql', 'loadtest', 'query-store'],
  timezone: 'browser', schemaVersion: 39, refresh: '30s',
  time: { from: 'now-1h', to: 'now' }, panels,
};

const body = JSON.stringify({ dashboard, overwrite: true, folderUid: '' });
const auth = 'Basic ' + Buffer.from('admin:admin').toString('base64');
const req = http.request({
  host: 'localhost', port: 3000, path: '/api/dashboards/db', method: 'POST',
  headers: { Authorization: auth, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, (res) => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => { console.log(res.statusCode, d); });
});
req.on('error', e => { console.error('ERR', e.message); process.exit(1); });
req.write(body); req.end();
