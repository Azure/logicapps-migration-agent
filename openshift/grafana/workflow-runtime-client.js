const http = require('http');
const https = require('https');
const crypto = require('crypto');

function createPlatformToken(credentials) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    aud: `https://${credentials.siteName}.azurewebsites.net`,
    iss: 'https://appservice.core.azurewebsites.net',
    nbf: now - 30,
    exp: now + 300
  })}`;
  const rawKey = credentials.key.trim();
  const key = /^[0-9a-f]{64}$/i.test(rawKey)
    ? Buffer.from(rawKey, 'hex')
    : Buffer.from(rawKey, 'base64');
  return `${unsigned}.${crypto.createHmac('sha256', key).update(unsigned).digest('base64url')}`;
}

function createWorkflowRuntimeClient(config, dependencies) {
  const credentialsByApp = new Map();
  const refreshByApp = new Map();

  async function refreshCredentials(appName) {
    if (refreshByApp.has(appName)) return refreshByApp.get(appName);
    const refresh = (async () => {
      const output = await dependencies.runOc([
        '-n', config.namespace, 'get', 'pods',
        '-l', `containerapps.io/app-name=${appName}`,
        '--field-selector=status.phase=Running', '-o', 'json'
      ]);
      const pods = JSON.parse(output).items || [];
      const pod = pods.find(item => item.status?.conditions?.some(
        condition => condition.type === 'Ready' && condition.status === 'True')) || pods[0];
      if (!pod?.metadata?.name) {
        throw new Error(`Cannot refresh authentication: no running pod for app '${appName}'.`);
      }
      const values = (await dependencies.runOc([
        '-n', config.namespace, 'exec', '-c', 'logicapps-container', pod.metadata.name,
        '--', 'printenv', 'WEBSITE_AUTH_ENCRYPTION_KEY', 'WEBSITE_SITE_NAME'
      ])).trim().split(/\r?\n/).map(value => value.trim());
      if (values.length !== 2 || !values[0] || !values[1]) {
        throw new Error(`Cannot refresh authentication: platform credentials are missing for app '${appName}'.`);
      }
      const credentials = { key: values[0], siteName: values[1] };
      credentialsByApp.set(appName, credentials);
      return credentials;
    })();
    refreshByApp.set(appName, refresh);
    try {
      return await refresh;
    } finally {
      refreshByApp.delete(appName);
    }
  }

  function send(method, target, body, token, signal) {
    return new Promise((resolve, reject) => {
      const bodyStr = body === undefined || body === null ? '' : JSON.stringify(body);
      const transport = target.protocol === 'https:' ? https : http;
      const request = transport.request({
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: target.pathname + target.search,
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          ...(token ? { 'x-ms-site-token': token } : {})
        },
        timeout: 15000,
        signal,
        rejectUnauthorized: false
      }, response => {
        let data = '';
        response.on('data', chunk => { data += chunk; });
        response.on('error', reject);
        response.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (error) {
            if (!(error instanceof SyntaxError)) return reject(error);
          }
          resolve({ status: response.statusCode, body: data, json });
        });
      });
      request.on('timeout', () => { request.destroy(new Error('Request timeout')); });
      request.on('error', reject);
      if (bodyStr) request.write(bodyStr);
      request.end();
    });
  }

  async function request(method, urlOrPath, body, requestedApp, options = {}) {
    const appName = requestedApp || config.appName;
    if (/^https?:\/\//i.test(urlOrPath)) {
      return send(method, new URL(urlOrPath), body, '', options.signal);
    }
    const target = new URL(urlOrPath, await dependencies.getBaseUrl(appName));
    let credentials = credentialsByApp.get(appName);
    if (!credentials && appName === config.appName && config.platformAuthKey && config.platformSiteName) {
      credentials = { key: config.platformAuthKey, siteName: config.platformSiteName };
    }
    if (credentials) {
      target.searchParams.delete('code');
    } else {
      const key = await dependencies.getMasterKey(appName);
      if (key) target.searchParams.set('code', key);
    }
    const result = await send(method, target, body, credentials ? createPlatformToken(credentials) : '', options.signal);
    if (result.status !== 401) return result;

    options.signal?.throwIfAborted();
    credentials = await refreshCredentials(appName);
    options.signal?.throwIfAborted();
    target.searchParams.delete('code');
    const retried = await send(method, target, body, createPlatformToken(credentials), options.signal);
    if (retried.status === 401) {
      credentialsByApp.delete(appName);
      throw new Error(`Runtime authentication was rejected for app '${appName}' after refreshing its platform credentials.`);
    }
    return retried;
  }

  return { request };
}

module.exports = { createWorkflowRuntimeClient, createPlatformToken };
