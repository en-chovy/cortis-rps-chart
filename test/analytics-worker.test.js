import assert from 'node:assert/strict';
import test from 'node:test';

import worker, { classifyUserAgent } from '../analytics-worker/src/worker.js';

function createEnv() {
  const points = [];
  return {
    env: {
      SITE_ID: 'cortis-rps-chart',
      ORIGIN_BASE_URL: '',
      ANALYTICS: { writeDataPoint: point => points.push(point) }
    },
    points
  };
}

test('classifies server-side agent user agents', () => {
  assert.deepEqual(classifyUserAgent('ClaudeBot/1.0'), { actor: 'agent', family: 'anthropic' });
  assert.deepEqual(classifyUserAgent('Mozilla/5.0'), { actor: 'human', family: 'browser' });
});

test('accepts a valid pageview and writes the documented analytics dimensions', async () => {
  const { env, points } = createEnv();
  const response = await worker.fetch(new Request('https://analytics.example/v1/event', {
    method: 'POST',
    headers: {
      Origin: 'https://en-chovy.github.io',
      'Content-Type': 'text/plain;charset=UTF-8',
      'User-Agent': 'Mozilla/5.0'
    },
    body: JSON.stringify({
      schema: 1,
      event: 'pageview',
      actor: 'human',
      agentFamily: 'browser',
      source: { source: 'x', medium: 'social', campaign: 'launch', referrerHost: 'x.com' },
      page: { host: 'en-chovy.github.io', path: '/cortis-rps-chart/', status: 'official' },
      language: 'ko-KR',
      sessionId: 'session-1',
      provenance: 'cortis-rps-chart:en-chovy:cpal-1.0:7f3c1a9e'
    })
  }), env);

  assert.equal(response.status, 204);
  assert.equal(points.length, 1);
  assert.deepEqual(points[0].indexes, ['cortis-rps-chart']);
  assert.deepEqual(points[0].blobs.slice(0, 6), [
    'pageview', 'human', 'browser', 'x', 'social', 'launch'
  ]);
  assert.deepEqual(points[0].doubles, [1]);
});

test('records dedicated agent context access without storing the full user agent', async () => {
  const { env, points } = createEnv();
  const response = await worker.fetch(new Request(
    'https://analytics.example/v1/agent?surface=agent-context&source=canonical',
    { headers: { 'User-Agent': 'ChatGPT-User/1.0' } }
  ), env);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.requiredAttribution, 'Based on cortis-rps-chart by en-chovy');
  assert.equal(points[0].blobs[0], 'agent_context');
  assert.equal(points[0].blobs[1], 'agent');
  assert.equal(points[0].blobs[2], 'openai');
  assert.doesNotMatch(JSON.stringify(points[0]), /ChatGPT-User/);
});

test('proxies the configured GitHub Pages subpath and records direct agent fetches', async () => {
  const { env, points } = createEnv();
  env.ORIGIN_BASE_URL = 'https://en-chovy.github.io/cortis-rps-chart/';
  const originalFetch = globalThis.fetch;
  let upstreamUrl = '';
  globalThis.fetch = async request => {
    upstreamUrl = request.url;
    return new Response('source', { headers: { 'Content-Type': 'text/javascript' } });
  };

  try {
    const response = await worker.fetch(new Request(
      'https://chart.example/src/model.js?version=1',
      { headers: { Accept: '*/*', 'User-Agent': 'ClaudeBot/1.0' } }
    ), env);

    assert.equal(response.status, 200);
    assert.equal(upstreamUrl, 'https://en-chovy.github.io/cortis-rps-chart/src/model.js?version=1');
    assert.equal(points[0].blobs[0], 'agent_request');
    assert.equal(points[0].blobs[2], 'anthropic');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects malformed or oversized browser events', async () => {
  const { env, points } = createEnv();
  const malformed = await worker.fetch(new Request('https://analytics.example/v1/event', {
    method: 'POST',
    body: '{'
  }), env);
  const oversizedByHeader = await worker.fetch(new Request('https://analytics.example/v1/event', {
    method: 'POST',
    headers: { 'Content-Length': '5000' },
    body: '{}'
  }), env);
  const oversizedStream = await worker.fetch(new Request('https://analytics.example/v1/event', {
    method: 'POST',
    body: 'x'.repeat(5000)
  }), env);

  assert.equal(malformed.status, 400);
  assert.equal(oversizedByHeader.status, 413);
  assert.equal(oversizedStream.status, 413);
  assert.equal(points.length, 0);
});
