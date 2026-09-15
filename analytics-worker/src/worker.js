const MAX_BODY_BYTES = 4096;
const AGENT_USER_AGENTS = [
  ['openai', /GPTBot|ChatGPT-User|OAI-SearchBot/i],
  ['anthropic', /ClaudeBot|Claude-SearchBot|Claude-User/i],
  ['perplexity', /PerplexityBot/i],
  ['google-extended', /Google-Extended/i],
  ['common-crawl', /CCBot/i],
  ['apple', /Applebot-Extended/i],
  ['amazon', /Amazonbot/i],
  ['meta', /meta-externalagent/i],
  ['bytedance', /Bytespider/i],
  ['cohere', /cohere-ai/i],
  ['diffbot', /Diffbot/i]
];
const AUTOMATION_USER_AGENT = /HeadlessChrome|Playwright|Puppeteer|Selenium/i;

function clean(value, maximumLength = 120) {
  return typeof value === 'string' ? value.trim().slice(0, maximumLength) : '';
}

export function classifyUserAgent(userAgent = '') {
  for (const [family, pattern] of AGENT_USER_AGENTS) {
    if (pattern.test(userAgent)) return { actor: 'agent', family };
  }
  if (AUTOMATION_USER_AGENT.test(userAgent)) {
    return { actor: 'automation', family: 'browser-automation' };
  }
  return { actor: 'human', family: 'browser' };
}

function corsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': request.headers.get('Origin') ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...headers
    }
  });
}

async function readBoundedText(request, maximumBytes) {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel();
        throw new RangeError('payload_too_large');
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function record(env, event) {
  env.ANALYTICS.writeDataPoint({
    indexes: [clean(env.SITE_ID, 96)],
    blobs: [
      clean(event.event, 40),
      clean(event.actor, 24),
      clean(event.agentFamily, 48),
      clean(event.source?.source, 80),
      clean(event.source?.medium, 80),
      clean(event.source?.campaign, 80),
      clean(event.source?.referrerHost, 120),
      clean(event.page?.host, 120),
      clean(event.page?.path, 240),
      clean(event.page?.status, 24),
      clean(event.language, 24),
      clean(event.sessionId, 80),
      clean(event.surface, 80),
      clean(event.provenance, 120)
    ],
    doubles: [1]
  });
}

async function receiveBrowserEvent(request, env) {
  const bodyLength = Number(request.headers.get('Content-Length') ?? 0);
  if (bodyLength > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413, corsHeaders(request));

  let event;
  try {
    const text = await readBoundedText(request, MAX_BODY_BYTES);
    event = JSON.parse(text);
  } catch (error) {
    const status = error instanceof RangeError ? 413 : 400;
    return json({ error: status === 413 ? 'payload_too_large' : 'invalid_json' }, status, corsHeaders(request));
  }

  if (event?.schema !== 1 || event?.event !== 'pageview') {
    return json({ error: 'invalid_event' }, 422, corsHeaders(request));
  }

  const detected = classifyUserAgent(request.headers.get('User-Agent') ?? '');
  const reportedActor = ['human', 'automation', 'agent'].includes(event.actor)
    ? event.actor
    : 'unknown';
  record(env, {
    ...event,
    actor: detected.actor === 'human' ? reportedActor : detected.actor,
    agentFamily: detected.actor === 'human' ? event.agentFamily : detected.family
  });
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

function receiveAgentContext(request, env, url) {
  const detected = classifyUserAgent(request.headers.get('User-Agent') ?? '');
  record(env, {
    event: 'agent_context',
    actor: 'agent',
    agentFamily: detected.actor === 'human' ? 'unidentified' : detected.family,
    source: {
      source: clean(url.searchParams.get('source') ?? 'direct', 80),
      medium: 'agent',
      campaign: '',
      referrerHost: (() => {
        try { return new URL(request.headers.get('Referer') ?? '').hostname; } catch { return ''; }
      })()
    },
    page: { host: url.hostname, path: url.pathname, status: 'collector' },
    surface: clean(url.searchParams.get('surface') ?? 'unspecified', 80),
    provenance: 'cortis-rps-chart:en-chovy:cpal-1.0:7f3c1a9e'
  });

  return json({
    name: 'CORTIS RPS CHART',
    canonical: 'https://en-chovy.github.io/cortis-rps-chart/',
    source: 'https://github.com/en-chovy/cortis-rps-chart',
    license: 'CPAL-1.0',
    requiredAttribution: 'Based on cortis-rps-chart by en-chovy',
    provenance: 'cortis-rps-chart:en-chovy:cpal-1.0:7f3c1a9e'
  });
}

async function proxySite(request, env) {
  if (!env.ORIGIN_BASE_URL) return json({ error: 'not_found' }, 404);
  const incomingUrl = new URL(request.url);
  const originBaseUrl = new URL(env.ORIGIN_BASE_URL);
  const originPath = incomingUrl.pathname.replace(/^\/+/, '');
  const originUrl = new URL(`${originPath}${incomingUrl.search}`, originBaseUrl);
  if (
    originUrl.origin !== originBaseUrl.origin
    || !originUrl.pathname.startsWith(originBaseUrl.pathname)
  ) {
    return json({ error: 'invalid_origin_path' }, 400);
  }
  const upstream = await fetch(new Request(originUrl, request));

  const accept = request.headers.get('Accept') ?? '';
  const detected = classifyUserAgent(request.headers.get('User-Agent') ?? '');
  const isDocumentRequest = detected.actor !== 'human'
    || accept.includes('text/html')
    || incomingUrl.pathname.endsWith('.html');
  if (request.method === 'GET' && isDocumentRequest) {
    record(env, {
      event: detected.actor === 'human' ? 'document_request' : 'agent_request',
      actor: detected.actor,
      agentFamily: detected.family,
      source: {
        source: (() => {
          try { return new URL(request.headers.get('Referer') ?? '').hostname || 'direct'; } catch { return 'direct'; }
        })(),
        medium: 'server',
        campaign: clean(incomingUrl.searchParams.get('utm_campaign') ?? '', 80),
        referrerHost: ''
      },
      page: { host: incomingUrl.hostname, path: incomingUrl.pathname, status: 'official' },
      provenance: 'cortis-rps-chart:en-chovy:cpal-1.0:7f3c1a9e'
    });
  }

  return new Response(upstream.body, upstream);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === 'OPTIONS' && url.pathname === '/v1/event') {
        return new Response(null, { status: 204, headers: corsHeaders(request) });
      }
      if (request.method === 'POST' && url.pathname === '/v1/event') {
        return await receiveBrowserEvent(request, env);
      }
      if (request.method === 'GET' && url.pathname === '/v1/agent') {
        return receiveAgentContext(request, env, url);
      }
      if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'method_not_allowed' }, 405);
      return await proxySite(request, env);
    } catch (error) {
      console.error(JSON.stringify({
        message: 'analytics request failed',
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error)
      }));
      return json({ error: 'internal_error' }, 500);
    }
  }
};
