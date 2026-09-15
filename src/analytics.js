/*
 * Source provenance: cortis-rps-chart:en-chovy:cpal-1.0:7f3c1a9e
 * Original source: https://github.com/en-chovy/cortis-rps-chart
 */

const SESSION_KEY = 'cortis-rps-chart:analytics-session';
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

function hostnameOf(value) {
  if (!value) return '';
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function classifyRuntime(userAgent = '', webdriver = false) {
  for (const [family, pattern] of AGENT_USER_AGENTS) {
    if (pattern.test(userAgent)) return { actor: 'agent', family };
  }
  if (webdriver || AUTOMATION_USER_AGENT.test(userAgent)) {
    return { actor: 'automation', family: 'browser-automation' };
  }
  return { actor: 'human', family: 'browser' };
}

export function getAcquisition(locationUrl, referrer = '') {
  const url = new URL(locationUrl);
  const campaignSource = clean(url.searchParams.get('utm_source') ?? '', 80);
  const campaignMedium = clean(url.searchParams.get('utm_medium') ?? '', 80);
  const campaignName = clean(url.searchParams.get('utm_campaign') ?? '', 80);
  const referrerHost = hostnameOf(referrer);

  if (campaignSource) {
    return {
      source: campaignSource,
      medium: campaignMedium || 'campaign',
      campaign: campaignName,
      referrerHost
    };
  }
  if (referrerHost) {
    return {
      source: referrerHost,
      medium: 'referral',
      campaign: '',
      referrerHost
    };
  }
  return { source: 'direct', medium: 'none', campaign: '', referrerHost: '' };
}

export function classifyHost(locationUrl, canonicalUrl) {
  try {
    const current = new URL(locationUrl);
    const canonical = new URL(canonicalUrl);
    return current.origin === canonical.origin && current.pathname.startsWith(canonical.pathname)
      ? 'official'
      : 'mirror';
  } catch {
    return 'unknown';
  }
}

function createSessionId(storage, cryptoApi) {
  try {
    const saved = storage?.getItem(SESSION_KEY);
    if (saved) return saved;
    const id = cryptoApi?.randomUUID?.();
    if (!id) return '';
    storage?.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return '';
  }
}

export function createPageView({
  locationUrl,
  canonicalUrl,
  referrer = '',
  userAgent = '',
  webdriver = false,
  language = '',
  sessionId = ''
}) {
  const url = new URL(locationUrl);
  const runtime = classifyRuntime(userAgent, webdriver);
  return {
    schema: 1,
    event: 'pageview',
    actor: runtime.actor,
    agentFamily: runtime.family,
    source: getAcquisition(locationUrl, referrer),
    page: {
      host: clean(url.hostname, 120),
      path: clean(url.pathname, 240),
      status: classifyHost(locationUrl, canonicalUrl)
    },
    language: clean(language, 24),
    sessionId: clean(sessionId, 80),
    provenance: 'cortis-rps-chart:en-chovy:cpal-1.0:7f3c1a9e'
  };
}

export function shouldRespectPrivacyPreference(navigatorApi) {
  return navigatorApi?.doNotTrack === '1' || navigatorApi?.globalPrivacyControl === true;
}

export async function sendAnalyticsEvent(endpoint, event, fetchApi = globalThis.fetch) {
  if (!endpoint || typeof fetchApi !== 'function') return false;
  try {
    const response = await fetchApi(endpoint, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(event)
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function initAnalytics({ documentApi = document, windowApi = window } = {}) {
  const endpoint = clean(
    documentApi.querySelector('meta[name="cortis-analytics-endpoint"]')?.content,
    500
  );
  if (!endpoint || shouldRespectPrivacyPreference(windowApi.navigator)) return false;

  const canonicalUrl = documentApi.querySelector('link[rel="canonical"]')?.href ?? '';
  const sessionId = createSessionId(windowApi.sessionStorage, windowApi.crypto);
  const event = createPageView({
    locationUrl: windowApi.location.href,
    canonicalUrl,
    referrer: documentApi.referrer,
    userAgent: windowApi.navigator.userAgent,
    webdriver: windowApi.navigator.webdriver,
    language: windowApi.navigator.language,
    sessionId
  });
  void sendAnalyticsEvent(endpoint, event, windowApi.fetch.bind(windowApi));
  return true;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  initAnalytics();
}
