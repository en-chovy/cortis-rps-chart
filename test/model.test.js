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
  assert.equal(state.nameCells.length, 10);
  assert.equal(state.cells.length, 20);
  assert.deepEqual(state.colors[1], { hex: '#ffadad', alpha: 0.5 });
});

test('paints a name cell and its entire row or column as one legend', () => {
  paintNameGroup('row', 2, 1);

  let state = getEditableState();
  assert.equal(state.nameCells[7], 1);
  assert.deepEqual(state.cells, [null, null, null, null, null, null, null, null, 1, 1, 1, 1, null, null, null, null, null, null, null, null]);

  paintNameGroup('column', 4, 2);
  state = getEditableState();
  assert.equal(state.nameCells[4], 2);
  assert.deepEqual(state.cells, [null, null, null, 2, null, null, null, 2, 1, 1, 1, 2, null, null, null, 2, null, null, null, null]);
});

test('clears a name group without changing unrelated cells', () => {
  paintCell(0, 3);
  paintNameGroup('row', 4, 1);
  paintNameGroup('row', 4, null);

  const state = getEditableState();
  assert.equal(state.nameCells[9], null);
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

test('preserves the current deleted-legend cell behavior for v3.1', () => {
  paintCell(0, 1);
  deleteLegend(1);

  const state = getEditableState();
  assert.equal(state.legends.some(legend => legend.id === 1), false);
  assert.equal(state.cells[0], 1);
  assert.deepEqual(state.colors[1], { hex: '#ffadad', alpha: 0.5 });
});
