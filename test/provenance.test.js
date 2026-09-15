import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../', import.meta.url);
const PROVENANCE_ID = 'cortis-rps-chart:en-chovy:cpal-1.0:7f3c1a9e';
const ATTRIBUTION = 'Based on cortis-rps-chart by en-chovy';

test('keeps attribution and machine-readable provenance on every public surface', async () => {
  const [html, notice, llms, provenance, browserAnalytics, worker] = await Promise.all([
    readFile(new URL('index.html', ROOT), 'utf8'),
    readFile(new URL('NOTICE', ROOT), 'utf8'),
    readFile(new URL('llms.txt', ROOT), 'utf8'),
    readFile(new URL('provenance.json', ROOT), 'utf8'),
    readFile(new URL('src/analytics.js', ROOT), 'utf8'),
    readFile(new URL('analytics-worker/src/worker.js', ROOT), 'utf8')
  ]);

  for (const surface of [html, notice, llms, provenance, browserAnalytics, worker]) {
    assert.match(surface, new RegExp(PROVENANCE_ID.replaceAll('.', '\\.')));
  }
  for (const surface of [html, notice, llms, provenance, worker]) {
    assert.match(surface, new RegExp(ATTRIBUTION));
  }
});

test('publishes the configured analytics collector URL', async () => {
  const html = await readFile(new URL('index.html', ROOT), 'utf8');
  assert.match(
    html,
    /<meta name="cortis-analytics-endpoint" content="https:\/\/cortis-rps-analytics\.0103x0214\.workers\.dev\/v1\/event">/
  );
});
