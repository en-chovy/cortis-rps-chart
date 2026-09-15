import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyHost,
  classifyRuntime,
  createPageView,
  getAcquisition,
  isLocalDevelopmentHost,
  sendAnalyticsEvent,
  shouldRespectPrivacyPreference
} from '../src/analytics.js';

test('classifies known AI agents separately from browser automation and people', () => {
  assert.deepEqual(classifyRuntime('Mozilla/5.0 (compatible; GPTBot/1.2)'), {
    actor: 'agent',
    family: 'openai'
  });
  assert.deepEqual(classifyRuntime('Mozilla/5.0 HeadlessChrome/130'), {
    actor: 'automation',
    family: 'browser-automation'
  });
  assert.deepEqual(classifyRuntime('Mozilla/5.0 Safari/605.1.15'), {
    actor: 'human',
    family: 'browser'
  });
  assert.equal(classifyRuntime('Mozilla/5.0 Safari/605.1.15', true).actor, 'automation');
});

test('prefers campaign parameters and stores only the referrer hostname', () => {
  assert.deepEqual(
    getAcquisition(
      'https://en-chovy.github.io/cortis-rps-chart/?utm_source=x&utm_medium=social&utm_campaign=launch',
      'https://example.com/private/path?secret=value'
    ),
    {
      source: 'x',
      medium: 'social',
      campaign: 'launch',
      referrerHost: 'example.com'
    }
  );
  assert.equal(getAcquisition('https://example.com/', '').source, 'direct');
});

test('marks unchanged copies running on another host as mirrors', () => {
  const canonical = 'https://en-chovy.github.io/cortis-rps-chart/';
  assert.equal(
    classifyHost('https://en-chovy.github.io/cortis-rps-chart/?from=x', canonical),
    'official'
  );
  assert.equal(classifyHost('https://copy.example/chart/', canonical), 'mirror');
});

test('creates a minimal pageview without query strings or full referrer URLs', () => {
  const event = createPageView({
    locationUrl: 'https://copy.example/chart/?utm_source=postype&private=1',
    canonicalUrl: 'https://en-chovy.github.io/cortis-rps-chart/',
    referrer: 'https://referrer.example/a/private/page?token=secret',
    userAgent: 'Mozilla/5.0 Safari/605.1.15',
    language: 'ko-KR',
    sessionId: 'session-1'
  });

  assert.equal(event.event, 'pageview');
  assert.equal(event.actor, 'human');
  assert.deepEqual(event.page, { host: 'copy.example', path: '/chart/', status: 'mirror' });
  assert.equal(event.source.referrerHost, 'referrer.example');
  assert.doesNotMatch(JSON.stringify(event), /private|token|secret/);
});

test('respects browser privacy signals', () => {
  assert.equal(shouldRespectPrivacyPreference({ doNotTrack: '1' }), true);
  assert.equal(shouldRespectPrivacyPreference({ globalPrivacyControl: true }), true);
  assert.equal(shouldRespectPrivacyPreference({ doNotTrack: '0' }), false);
});

test('does not collect local development and end-to-end test traffic', () => {
  assert.equal(isLocalDevelopmentHost('localhost'), true);
  assert.equal(isLocalDevelopmentHost('127.0.0.1'), true);
  assert.equal(isLocalDevelopmentHost('::1'), true);
  assert.equal(isLocalDevelopmentHost('en-chovy.github.io'), false);
});

test('sends analytics as a credential-free keepalive request', async () => {
  let received;
  const sent = await sendAnalyticsEvent('https://analytics.example/v1/event', { schema: 1 }, async (...args) => {
    received = args;
    return { ok: true };
  });

  assert.equal(sent, true);
  assert.equal(received[0], 'https://analytics.example/v1/event');
  assert.equal(received[1].credentials, 'omit');
  assert.equal(received[1].keepalive, true);
  assert.equal(received[1].headers['Content-Type'], 'text/plain;charset=UTF-8');
});
