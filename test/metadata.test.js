import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const SITE_URL = 'https://en-chovy.github.io/cortis-rps-chart/';
const IMAGE_URL = `${SITE_URL}design/og/og-cortis-chart.png`;
const IMAGE_ALT = 'CORTIS RPS CHART — 콜페스 취향표, 간편하게 칠하는 나의 취향';
const IMAGE_PATH = new URL('../design/og/og-cortis-chart.png', import.meta.url);
const INDEX_PATH = new URL('../index.html', import.meta.url);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readMetaContent(html, attribute, key) {
  const pattern = new RegExp(
    `<meta\\s+${attribute}="${escapeRegExp(key)}"\\s+content="([^"]+)"\\s*/?>`
  );
  return html.match(pattern)?.[1] ?? null;
}

test('publishes complete social sharing metadata', async () => {
  const html = await readFile(INDEX_PATH, 'utf8');

  assert.match(html, new RegExp(`<link\\s+rel="canonical"\\s+href="${escapeRegExp(SITE_URL)}">`));
  assert.equal(readMetaContent(html, 'name', 'description'), '간편하게 칠하는 나의 취향');

  assert.equal(readMetaContent(html, 'property', 'og:locale'), 'ko_KR');
  assert.equal(readMetaContent(html, 'property', 'og:type'), 'website');
  assert.equal(readMetaContent(html, 'property', 'og:site_name'), 'CORTIS RPS CHART');
  assert.equal(readMetaContent(html, 'property', 'og:url'), SITE_URL);
  assert.equal(readMetaContent(html, 'property', 'og:title'), 'CORTIS RPS 취향표');
  assert.equal(readMetaContent(html, 'property', 'og:description'), '간편하게 칠하는 나의 취향');
  assert.equal(readMetaContent(html, 'property', 'og:image'), IMAGE_URL);
  assert.equal(readMetaContent(html, 'property', 'og:image:type'), 'image/png');
  assert.equal(readMetaContent(html, 'property', 'og:image:width'), '1200');
  assert.equal(readMetaContent(html, 'property', 'og:image:height'), '630');
  assert.equal(readMetaContent(html, 'property', 'og:image:alt'), IMAGE_ALT);

  assert.equal(readMetaContent(html, 'name', 'twitter:card'), 'summary_large_image');
  assert.equal(readMetaContent(html, 'name', 'twitter:title'), 'CORTIS RPS 취향표');
  assert.equal(readMetaContent(html, 'name', 'twitter:description'), '간편하게 칠하는 나의 취향');
  assert.equal(readMetaContent(html, 'name', 'twitter:image'), IMAGE_URL);
  assert.equal(readMetaContent(html, 'name', 'twitter:image:alt'), IMAGE_ALT);
});

test('publishes a 1200 by 630 PNG sharing image', async () => {
  const image = await readFile(IMAGE_PATH);

  assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(image.readUInt32BE(16), 1200);
  assert.equal(image.readUInt32BE(20), 630);
});
