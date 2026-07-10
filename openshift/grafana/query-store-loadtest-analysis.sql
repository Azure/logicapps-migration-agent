/**********************************************************************************************
  Query Store - Load Test Analysis Toolkit
  Database : logicapp   (SQL Server 2019, Query Store enabled READ_WRITE, 1-min intervals,
                         QUERY_CAPTURE_MODE = ALL, WAIT_STATS_CAPTURE_MODE = ON)

  Usage:
    * Run section [0] IMMEDIATELY BEFORE the load test to clear to a clean baseline.
    * Run sections [1]-[7] DURING or AFTER the load test to analyse.
    * All timing columns from Query Store are in MICROSECONDS; queries below convert to ms.

  Connect example:
    sqlcmd -S 10.26.1.71 -U logicappsuser -d logicapp -C -Q "..."
**********************************************************************************************/

------------------------------------------------------------------------------------------------
-- [0] RESET BASELINE  (run right before the load test starts)
------------------------------------------------------------------------------------------------
-- ALTER DATABASE [logicapp] SET QUERY_STORE CLEAR;

------------------------------------------------------------------------------------------------
-- [1] HEALTH / CONFIG CHECK  (confirm QS is capturing before you start)
------------------------------------------------------------------------------------------------
SELECT actual_state_desc, desired_state_desc, readonly_reason,
       interval_length_minutes, query_capture_mode_desc, wait_stats_capture_mode_desc,
       flush_interval_seconds, current_storage_size_mb, max_storage_size_mb
FROM sys.database_query_store_options;

------------------------------------------------------------------------------------------------
-- [2] TOP QUERIES BY TOTAL DURATION (overall load contributors)
--     Total impact = avg_duration * executions. Best "where is the DB spending time" view.
------------------------------------------------------------------------------------------------
SELECT TOP 25
    q.query_id,
    SUBSTRING(t.query_sql_text, 1, 160)                              AS sql_text,
    SUM(rs.count_executions)                                         AS execs,
    CAST(SUM(rs.avg_duration    * rs.count_executions)/1000.0 AS DECIMAL(18,1)) AS total_ms,
    CAST(AVG(rs.avg_duration)   /1000.0 AS DECIMAL(12,2))            AS avg_ms,
    CAST(MAX(rs.max_duration)   /1000.0 AS DECIMAL(12,2))            AS max_ms,
    CAST(AVG(rs.avg_cpu_time)   /1000.0 AS DECIMAL(12,2))            AS avg_cpu_ms,
    CAST(AVG(rs.avg_logical_io_reads) AS BIGINT)                     AS avg_logical_reads,
    CAST(AVG(rs.avg_rowcount)   AS BIGINT)                           AS avg_rows
FROM sys.query_store_runtime_stats rs
JOIN sys.query_store_plan        p ON rs.plan_id = p.plan_id
JOIN sys.query_store_query       q ON p.query_id = q.query_id
JOIN sys.query_store_query_text  t ON q.query_text_id = t.query_text_id
GROUP BY q.query_id, t.query_sql_text
ORDER BY total_ms DESC;

------------------------------------------------------------------------------------------------
-- [3] TOP QUERIES BY CPU  (CPU-bound hotspots under load)
------------------------------------------------------------------------------------------------
SELECT TOP 25
    q.query_id,
    SUBSTRING(t.query_sql_text, 1, 160)                              AS sql_text,
    SUM(rs.count_executions)                                         AS execs,
    CAST(SUM(rs.avg_cpu_time * rs.count_executions)/1000.0 AS DECIMAL(18,1)) AS total_cpu_ms,
    CAST(AVG(rs.avg_cpu_time)/1000.0 AS DECIMAL(12,2))               AS avg_cpu_ms
FROM sys.query_store_runtime_stats rs
JOIN sys.query_store_plan        p ON rs.plan_id = p.plan_id
JOIN sys.query_store_query       q ON p.query_id = q.query_id
JOIN sys.query_store_query_text  t ON q.query_text_id = t.query_text_id
GROUP BY q.query_id, t.query_sql_text
ORDER BY total_cpu_ms DESC;

------------------------------------------------------------------------------------------------
-- [4] TOP QUERIES BY LOGICAL READS  (I/O / memory pressure candidates)
------------------------------------------------------------------------------------------------
SELECT TOP 25
    q.query_id,
    SUBSTRING(t.query_sql_text, 1, 160)                              AS sql_text,
    SUM(rs.count_executions)                                         AS execs,
    CAST(SUM(rs.avg_logical_io_reads * rs.count_executions) AS BIGINT) AS total_logical_reads,
    CAST(AVG(rs.avg_logical_io_reads) AS BIGINT)                     AS avg_logical_reads
FROM sys.query_store_runtime_stats rs
JOIN sys.query_store_plan        p ON rs.plan_id = p.plan_id
JOIN sys.query_store_query       q ON p.query_id = q.query_id
JOIN sys.query_store_query_text  t ON q.query_text_id = t.query_text_id
GROUP BY q.query_id, t.query_sql_text
ORDER BY total_logical_reads DESC;

------------------------------------------------------------------------------------------------
-- [5] MOST FREQUENT QUERIES  (chattiness - candidates for batching/caching)
------------------------------------------------------------------------------------------------
SELECT TOP 25
    q.query_id,
    SUBSTRING(t.query_sql_text, 1, 160)                              AS sql_text,
    SUM(rs.count_executions)                                         AS execs,
    CAST(AVG(rs.avg_duration)/1000.0 AS DECIMAL(12,2))              AS avg_ms
FROM sys.query_store_runtime_stats rs
JOIN sys.query_store_plan        p ON rs.plan_id = p.plan_id
JOIN sys.query_store_query       q ON p.query_id = q.query_id
JOIN sys.query_store_query_text  t ON q.query_text_id = t.query_text_id
GROUP BY q.query_id, t.query_sql_text
ORDER BY execs DESC;

------------------------------------------------------------------------------------------------
-- [6] WAIT STATISTICS BY CATEGORY  (the #1 load-test bottleneck view)
--     CPU, LOCK, LATCH, BUFFER IO, LOG, NETWORK, PARALLELISM, MEMORY ...
------------------------------------------------------------------------------------------------
SELECT
    ws.wait_category_desc,
    CAST(SUM(ws.total_query_wait_time_ms) AS BIGINT)                AS total_wait_ms,
    CAST(SUM(ws.avg_query_wait_time_ms * ws.count_executions)
         / NULLIF(SUM(ws.count_executions),0) AS DECIMAL(12,2))     AS avg_wait_ms,
    SUM(ws.count_executions)                                        AS execs
FROM sys.query_store_wait_stats ws
GROUP BY ws.wait_category_desc
ORDER BY total_wait_ms DESC;

------------------------------------------------------------------------------------------------
-- [7] THROUGHPUT OVER TIME  (executions & avg duration per 1-min QS interval)
--     Watch avg_ms climb as concurrency rises - the classic load-test curve.
------------------------------------------------------------------------------------------------
SELECT
    rsi.start_time,
    rsi.end_time,
    SUM(rs.count_executions)                                        AS execs_in_interval,
    CAST(SUM(rs.avg_duration * rs.count_executions)
         / NULLIF(SUM(rs.count_executions),0) / 1000.0 AS DECIMAL(12,2)) AS avg_ms,
    CAST(SUM(rs.avg_cpu_time * rs.count_executions)
         / NULLIF(SUM(rs.count_executions),0) / 1000.0 AS DECIMAL(12,2)) AS avg_cpu_ms
FROM sys.query_store_runtime_stats rs
JOIN sys.query_store_runtime_stats_interval rsi ON rs.runtime_stats_interval_id = rsi.runtime_stats_interval_id
WHERE rsi.start_time >= DATEADD(HOUR, -2, SYSUTCDATETIME())   -- last 2h; widen as needed
GROUP BY rsi.start_time, rsi.end_time
ORDER BY rsi.start_time;

------------------------------------------------------------------------------------------------
-- [8] (OPTIONAL) Inspect the full text + plan of one query found above
------------------------------------------------------------------------------------------------
-- DECLARE @query_id INT = 0;   -- set from sections [2]-[5]
-- SELECT t.query_sql_text
-- FROM sys.query_store_query q
-- JOIN sys.query_store_query_text t ON q.query_text_id = t.query_text_id
-- WHERE q.query_id = @query_id;
-- SELECT p.plan_id, TRY_CONVERT(XML, p.query_plan) AS query_plan
-- FROM sys.query_store_plan p WHERE p.query_id = @query_id;
