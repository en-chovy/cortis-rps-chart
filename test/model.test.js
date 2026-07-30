import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import {
  addLegend,
  createInitialEditableState,
  deleteLegend,
  getEditableState,
  paintCell,
  paintNameGroup,
  renameLegend,
  replaceEditableState,
  setLegendColor
} from '../src/model.js';

beforeEach(() => replaceEditableState(createInitialEditableState()));

test('keeps editable content in a DOM-independent state object', () => {
  const state = getEditableState();
  assert.equal(state.legends.length, 5);
  assert.equal(state.cells.length, 20);
  assert.deepEqual(state.colors[1], { hex: '#ffadad', alpha: 0.5 });
});

test('uses a name cell to paint only its child row or column cells', () => {
  paintNameGroup('row', 2, 1);

  let state = getEditableState();
  assert.equal('nameCells' in state, false);
  assert.deepEqual(state.cells, [null, null, null, null, null, null, null, null, 1, 1, 1, 1, null, null, null, null, null, null, null, null]);

  paintNameGroup('column', 4, 2);
  state = getEditableState();
  assert.deepEqual(state.cells, [null, null, null, 2, null, null, null, 2, 1, 1, 1, 2, null, null, null, 2, null, null, null, null]);
});

test('clears a name group without changing unrelated cells', () => {
  paintCell(0, 3);
  paintNameGroup('row', 4, 1);
  paintNameGroup('row', 4, null);

  const state = getEditableState();
  assert.equal(state.cells[0], 3);
  assert.deepEqual(state.cells.slice(16), [null, null, null, null]);
});

test('updates legends, colors, and cells without reading the DOM', () => {
  const id = addLegend('테스트');
  renameLegend(id, '수정됨');
  setLegendColor(id, { hex: '#123456', alpha: 0.75 });
  paintCell(0, id);

  const state = getEditableState();
  assert.deepEqual(state.legends.at(-1), { id: 6, name: '수정됨' });
  assert.deepEqual(state.colors[6], { hex: '#123456', alpha: 0.75 });
  assert.equal(state.cells[0], 6);
});

test('keeps legend names within the export-safe limit across mutations and restored state', () => {
  const longName = '가'.repeat(16);
  const id = addLegend(longName);
  assert.equal(getEditableState().legends.at(-1).name, '가'.repeat(15));

  renameLegend(id, ` ${'나'.repeat(16)} `);
  assert.equal(getEditableState().legends.at(-1).name, '나'.repeat(15));

  const restored = createInitialEditableState();
  restored.legends[0].name = longName;
  replaceEditableState(restored);
  assert.equal(getEditableState().legends[0].name, '가'.repeat(15));
});

test('clears only cells painted with a deleted legend', () => {
  paintCell(0, 1);
  paintCell(1, 2);
  paintCell(2, 1);
  deleteLegend(1);

  const state = getEditableState();
  assert.equal(state.legends.some(legend => legend.id === 1), false);
  assert.deepEqual(state.cells.slice(0, 3), [null, 2, null]);
  assert.deepEqual(state.colors[1], { hex: '#ffadad', alpha: 0.5 });
});
