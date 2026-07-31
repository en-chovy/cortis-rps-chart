import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT_PATH = fileURLToPath(new URL('../', import.meta.url));
const FONT_RELATIVE_PATH = 'assets/fonts/pretendard/1.3.9';
const FONT_PATH = path.join(ROOT_PATH, FONT_RELATIVE_PATH);
const FONT_CSS_NAME = 'pretendardvariable-dynamic-subset.css';
const FONT_CSS_PATH = path.join(FONT_PATH, FONT_CSS_NAME);
const FONT_FILES_PATH = path.join(FONT_PATH, 'woff2-dynamic-subset');
const EXPECTED_FONT_FILE_COUNT = 92;
const EXPECTED_FONT_CSS_SHA256 = '2973bcae80262dcb630cfb793fbf6af29bd986c769ee54953fb3e5b3e32323ca';
const EXPECTED_FONT_FILES_SHA256 = '862cd8cec3918a4589ade1641ad9c0ab25e84e5ceb4018348376a3763e7d7f09';

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

test('loads the versioned local Pretendard stylesheet before app styles', async () => {
  const [html, appStyles] = await Promise.all([
    readFile(path.join(ROOT_PATH, 'index.html'), 'utf8'),
    readFile(path.join(ROOT_PATH, 'styles.css'), 'utf8')
  ]);
  const fontHref = `./${FONT_RELATIVE_PATH}/${FONT_CSS_NAME}`;
  const fontStylesheetIndex = html.indexOf(`href="${fontHref}"`);
  const appStylesheetIndex = html.indexOf('href="./styles.css?');

  assert.notEqual(fontStylesheetIndex, -1);
  assert.notEqual(appStylesheetIndex, -1);
  assert.ok(fontStylesheetIndex < appStylesheetIndex);
  assert.doesNotMatch(`${html}\n${appStyles}`, /cdn\.jsdelivr\.net|pretendard\.min\.css/i);
  assert.doesNotMatch(appStyles, /@import\b/);
  assert.match(appStyles, /"Pretendard Variable",\s*\n\s*Pretendard,/);
});

test('uses one cache version across the app module graph', async () => {
  const html = await readFile(path.join(ROOT_PATH, 'index.html'), 'utf8');
  const appVersion = html.match(/src="\.\/app\.js\?v=([^"]+)"/)?.[1];
  const styleVersion = html.match(/href="\.\/styles\.css\?v=([^"]+)"/)?.[1];
  const sourceFileNames = (await readdir(path.join(ROOT_PATH, 'src')))
    .filter(fileName => fileName.endsWith('.js'));
  const modulePaths = [
    path.join(ROOT_PATH, 'app.js'),
    ...sourceFileNames.map(fileName => path.join(ROOT_PATH, 'src', fileName))
  ];

  assert.ok(appVersion);
  assert.equal(styleVersion, appVersion);
  for (const modulePath of modulePaths) {
    const source = await readFile(modulePath, 'utf8');
    const relativeJavaScriptImports = [
      ...source.matchAll(/['"](\.{1,2}\/[^'"]+\.js(?:\?[^'"]*)?)['"]/g)
    ].map(match => match[1]);

    for (const importSpecifier of relativeJavaScriptImports) {
      const importVersion = importSpecifier.match(/[?&]v=([^&]+)$/)?.[1];
      assert.ok(
        importVersion,
        `${path.relative(ROOT_PATH, modulePath)} omits a module cache version: ${importSpecifier}`
      );
      assert.equal(
        importVersion,
        appVersion,
        `${path.relative(ROOT_PATH, modulePath)} uses a stale module cache version`
      );
    }
  }
});

test('ships every official variable dynamic subset referenced by the font CSS', async () => {
  const css = await readFile(FONT_CSS_PATH, 'utf8');
  const fontUrls = [...css.matchAll(/src:\s*url\(([^)]+)\)/g)].map(match => (
    match[1].replaceAll(/['"]/g, '')
  ));
  const referencedFiles = fontUrls.map(fontUrl => path.basename(fontUrl));
  const actualFiles = (await readdir(FONT_FILES_PATH))
    .filter(fileName => fileName.endsWith('.woff2'))
    .sort();

  assert.equal(countMatches(css, /@font-face\s*\{/g), EXPECTED_FONT_FILE_COUNT);
  assert.equal(countMatches(css, /font-display:\s*swap;/g), EXPECTED_FONT_FILE_COUNT);
  assert.equal(countMatches(css, /font-weight:\s*45 920;/g), EXPECTED_FONT_FILE_COUNT);
  assert.equal(countMatches(css, /unicode-range:/g), EXPECTED_FONT_FILE_COUNT);
  assert.equal(countMatches(css, /format\('woff2-variations'\)/g), EXPECTED_FONT_FILE_COUNT);
  assert.equal(fontUrls.length, EXPECTED_FONT_FILE_COUNT);
  assert.deepEqual(
    referencedFiles.map(fileName => Number(fileName.match(/\.subset\.(\d+)\.woff2$/)?.[1])),
    Array.from({ length: EXPECTED_FONT_FILE_COUNT }, (_, index) => index)
  );
  assert.ok(fontUrls.every(fontUrl => (
    fontUrl.startsWith('./woff2-dynamic-subset/')
    && !fontUrl.includes('://')
    && !fontUrl.startsWith('//')
  )));
  assert.deepEqual([...referencedFiles].sort(), actualFiles);

  let totalFontBytes = 0;
  const fontFilesHash = createHash('sha256');
  for (const fileName of actualFiles) {
    const font = await readFile(path.join(FONT_FILES_PATH, fileName));
    assert.equal(font.subarray(0, 4).toString('ascii'), 'wOF2', fileName);
    assert.ok(font.byteLength > 0, fileName);
    assert.ok(font.byteLength < 50 * 1024, fileName);
    totalFontBytes += font.byteLength;
    fontFilesHash.update(fileName);
    fontFilesHash.update('\0');
    fontFilesHash.update(font);
  }
  assert.ok(totalFontBytes < 3 * 1024 * 1024);
  assert.ok(gzipSync(css).byteLength < 16 * 1024);
  assert.equal(createHash('sha256').update(css).digest('hex'), EXPECTED_FONT_CSS_SHA256);
  assert.equal(fontFilesHash.digest('hex'), EXPECTED_FONT_FILES_SHA256);
});

test('keeps the upstream source record and OFL license with Pretendard', async () => {
  const [license, source] = await Promise.all([
    readFile(path.join(FONT_PATH, 'OFL.txt'), 'utf8'),
    readFile(path.join(FONT_PATH, 'SOURCE.md'), 'utf8')
  ]);

  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.match(license, /Reserved Font Name Pretendard/);
  assert.match(source, /pretendard@1\.3\.9/);
  assert.match(source, new RegExp(EXPECTED_FONT_CSS_SHA256));
  assert.match(source, new RegExp(EXPECTED_FONT_FILES_SHA256));
  assert.match(source, /unmodified copies/);
});
