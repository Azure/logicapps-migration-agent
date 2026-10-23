const crypto = require('crypto');

class RunQueryError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function readFilters(params) {
  const filters = {};
  for (const key of ['runId', 'status', 'start', 'duration', 'error']) {
    const value = (params.get(key) || '').trim();
    if (value.length > 500) throw new RunQueryError(400, `${key} filter must not exceed 500 characters.`);
    filters[key] = key === 'start' ? value.replace('T', ' ') : value;
  }
  if (filters.status && !/^[a-z]+$/i.test(filters.status)) {
    throw new RunQueryError(400, 'Status must be a workflow run status such as Failed or Succeeded.');
  }
  return filters;
}

function matchesRun(run, filters) {
  const properties = run.properties || {};
  let duration = '-';
  if (properties.startTime && properties.endTime) {
    const seconds = (Date.parse(properties.endTime) - Date.parse(properties.startTime)) / 1000;
    if (Number.isFinite(seconds)) duration = `${Math.max(0, seconds).toFixed(1)}s`;
  }
  const values = {
    runId: String(run.name || ''),
    status: String(properties.status || '-'),
    start: String(properties.startTime || '').replace('T', ' ').slice(0, 19),
    duration,
    error: String(properties.error?.message || '')
  };
  return Object.entries(filters).every(([key, term]) => {
    if (!term) return true;
    const value = values[key].toLowerCase();
    return key === 'status' ? value === term.toLowerCase() : value.includes(term.toLowerCase());
  });
}

function startTimePredicates(value) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2})(?::(\d{2})(?::(\d{2}))?)?)?$/);
  if (!match) return [];
  const date = `${match[1]}T${match[2] || '00'}:${match[3] || '00'}:${match[4] || '00'}Z`;
  const from = new Date(date);
  if (!Number.isFinite(from.getTime()) || from.toISOString().slice(0, 19) !== date.slice(0, 19)) {
    throw new RunQueryError(400, 'Start filter contains an invalid date or time.');
  }
  const span = match[4] ? 1000 : match[3] ? 60000 : match[2] ? 3600000 : 86400000;
  return [`startTime ge ${from.toISOString()}`, `startTime lt ${new Date(from.getTime() + span).toISOString()}`];
}

async function queryRuns({ params, workflow, appName, managementPath, makeRequest, signal }) {
  const filters = readFilters(params);
  const rawTop = params.get('top') || '100';
  if (!/^\d+$/.test(rawTop) || Number(rawTop) < 1 || Number(rawTop) > 1000) {
    throw new RunQueryError(400, 'top must be an integer between 1 and 1000.');
  }
  const top = Number(rawTop);
  const endpoint = `/runtime/webhooks/workflow/api/management/workflows/${encodeURIComponent(workflow)}/runs`;
  const predicates = [];
  const legacyFilter = (params.get('filter') || '').trim();
  if (legacyFilter) predicates.push(legacyFilter);
  if (filters.status) {
    const statuses = ['Succeeded', 'Failed', 'Running', 'Waiting', 'Cancelled', 'TimedOut', 'Skipped', 'Suspended', 'Aborted'];
    const status = statuses.find(value => value.toLowerCase() === filters.status.toLowerCase());
    if (!status) throw new RunQueryError(400, `Unsupported run status '${filters.status}'.`);
    predicates.push(`status eq '${status}'`);
  }
  predicates.push(...startTimePredicates(filters.start));
  const upstreamFilter = predicates.join(' and ');
  const fingerprint = crypto.createHash('sha256')
    .update(JSON.stringify({ workflow, appName, top, filters, upstreamFilter })).digest('hex');

  function normalizePath(value, remaining, invalidStatus = 502) {
    let url;
    try {
      if (typeof value !== 'string' || !value) throw new TypeError('Missing continuation URL');
      url = new URL(value, 'http://runtime.invalid');
    } catch {
      throw new RunQueryError(invalidStatus, 'Invalid run-history continuation link.');
    }
    if (url.pathname !== endpoint || url.hash) {
      throw new RunQueryError(invalidStatus, 'Run-history continuation does not belong to this workflow.');
    }
    url.searchParams.delete('code');
    url.searchParams.set('$top', String(remaining));
    if (upstreamFilter) url.searchParams.set('$filter', upstreamFilter);
    else url.searchParams.delete('$filter');
    return url.pathname + url.search;
  }

  let nextPath = managementPath(endpoint);
  const cursor = params.get('cursor');
  if (cursor) {
    if (cursor.length > 16384) throw new RunQueryError(400, 'Invalid run-history cursor.');
    let state;
    try {
      state = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    } catch {
      throw new RunQueryError(400, 'Invalid run-history cursor.');
    }
    if (!state || state.fingerprint !== fingerprint || typeof state.path !== 'string') {
      throw new RunQueryError(400, 'Run-history cursor does not match the selected filters.');
    }
    nextPath = normalizePath(state.path, top, 400);
  }
  const value = [];
  const visited = new Set();
  function pageIdentity(path) {
    const url = new URL(path, 'http://runtime.invalid');
    url.searchParams.delete('$top');
    url.searchParams.sort();
    return url.href;
  }
  while (nextPath && value.length < top) {
    signal?.throwIfAborted();
    const path = normalizePath(nextPath, top - value.length);
    const identity = pageIdentity(path);
    if (visited.has(identity)) throw new RunQueryError(502, 'Runtime repeated a run-history continuation link.');
    visited.add(identity);
    const result = await makeRequest('GET', path, undefined, appName, { signal });
    signal?.throwIfAborted();
    if (result.status !== 200) {
      throw new RunQueryError(result.status, result.json?.error?.message || `Run-history query failed (HTTP ${result.status}).`);
    }
    if (!Array.isArray(result.json?.value) || result.json.value.length > top - value.length ||
        result.json.value.some(run => !run || typeof run.name !== 'string')) {
      throw new RunQueryError(502, 'Runtime returned an invalid run-history page.');
    }
    for (const run of result.json.value) {
      if (matchesRun(run, filters)) value.push(run);
    }
    nextPath = result.json.nextLink ? normalizePath(result.json.nextLink, top - value.length || top) : '';
    if (nextPath && visited.has(pageIdentity(nextPath))) {
      throw new RunQueryError(502, 'Runtime repeated a run-history continuation link.');
    }
  }
  const nextCursor = nextPath
    ? Buffer.from(JSON.stringify({ path: nextPath, fingerprint })).toString('base64url')
    : null;
  return { value, nextCursor, hasMore: Boolean(nextCursor), filtered: true };
}

module.exports = { queryRuns, matchesRun, readFilters, RunQueryError };
