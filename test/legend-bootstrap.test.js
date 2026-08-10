import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createInitialEditableState } from '../src/model.js';
import { editableStateStorageKey } from '../src/persistence.js';

const ROOT_PATH = fileURLToPath(new URL('../', import.meta.url));

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function colorChannels(hex) {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16)
  ];
}

test('ships the model defaults as visible initial legend markup and colors', async () => {
  const [html, styles] = await Promise.all([
    readFile(path.join(ROOT_PATH, 'index.html'), 'utf8'),
    readFile(path.join(ROOT_PATH, 'styles.css'), 'utf8')
  ]);
  const state = createInitialEditableState();
  const legendStart = html.indexOf('<div class="legend-wrapper" id="legendContainer">');
  const legendEnd = html.indexOf('<div class="chart-frame">', legendStart);
  const legendMarkup = html.slice(legendStart, legendEnd);
  const labels = [...legendMarkup.matchAll(
    /<span class="editable-label" id="label-(\d+)">([^<]+)<\/span>/g
  )].map(match => ({ id: Number(match[1]), name: match[2] }));

  assert.notEqual(legendStart, -1);
  assert.notEqual(legendEnd, -1);
  assert.deepEqual(labels, state.legends);
  assert.equal(
    [...legendMarkup.matchAll(/<div class="legend-item"/g)].length,
    state.legends.length
  );

  for (const legend of state.legends) {
    const color = state.colors[legend.id];
    const [red, green, blue] = colorChannels(color.hex);
    const escapedName = escapeRegularExpression(legend.name);

    assert.match(
      legendMarkup,
      new RegExp(`id="item-${legend.id}" data-legend-id="${legend.id}"`)
    );
    assert.match(
      legendMarkup,
      new RegExp(`id="disp-${legend.id}" style="background-color: var\\(--color-${legend.id}-a\\)"`)
    );
    assert.match(
      legendMarkup,
      new RegExp(`aria-label="${escapedName} 범례 삭제"`)
    );
    assert.match(
      styles,
      new RegExp(`--color-${legend.id}:\\s*${escapeRegularExpression(color.hex)};`, 'i')
    );
    assert.match(
      styles,
      new RegExp(
        `--color-${legend.id}-a:\\s*rgba\\(${red},\\s*${green},\\s*${blue},\\s*${color.alpha}\\);`
      )
    );
  }

  assert.ok(
    legendMarkup.lastIndexOf('class="legend-item"')
      < legendMarkup.indexOf('class="btn-add-legend"')
  );
});

test('starts the app early and guards persisted chart restoration', async () => {
  const [html, styles, app] = await Promise.all([
    readFile(path.join(ROOT_PATH, 'index.html'), 'utf8'),
    readFile(path.join(ROOT_PATH, 'styles.css'), 'utf8'),
    readFile(path.join(ROOT_PATH, 'app.js'), 'utf8')
  ]);
  const headEnd = html.indexOf('</head>');
  const bodyStart = html.indexOf('<body>');
  const appScriptIndex = html.indexOf('src="./app.js?');

  assert.match(
    html,
    new RegExp(`sessionStorage\\.getItem\\('${escapeRegularExpression(editableStateStorageKey)}'\\)`)
  );
  assert.ok(appScriptIndex > 0 && appScriptIndex < headEnd);
  assert.doesNotMatch(html.slice(bodyStart), /src="\.\/app\.js\?/);
  assert.match(styles, /\.is-restoring-chart-state \.legend-wrapper\s*\{\s*visibility:\s*hidden;\s*\}/);
  assert.match(styles, /\.is-restoring-chart-state \.chart-frame\s*\{\s*visibility:\s*hidden;\s*\}/);
  assert.match(app, /finally\s*\{\s*document\.documentElement\.classList\.remove\('is-restoring-chart-state'\);/);
});
