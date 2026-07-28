import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createInitialEditableState } from '../src/model.js';
import {
  clearEditableState,
  editableStateStorageKey,
  loadEditableState,
  saveEditableState
} from '../src/persistence.js';

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

test('round-trips a valid editable state through session storage', () => {
  const storage = createMemoryStorage();
  const editableState = createInitialEditableState();
  editableState.legends[0].name = '최애';
  editableState.cells[0] = 1;

  assert.equal(saveEditableState(editableState, storage), true);
  assert.deepEqual(loadEditableState(storage), editableState);
});

test('discards corrupt or incompatible persisted data', () => {
  const storage = createMemoryStorage();
  storage.setItem(editableStateStorageKey, JSON.stringify({
    version: 1,
    editableState: { cells: [] }
  }));

  assert.equal(loadEditableState(storage), null);
  assert.equal(storage.getItem(editableStateStorageKey), null);
});

test('clears a persisted editable state explicitly', () => {
  const storage = createMemoryStorage();
  storage.setItem('unrelated-key', 'keep');
  saveEditableState(createInitialEditableState(), storage);

  assert.equal(clearEditableState(storage), true);
  assert.equal(loadEditableState(storage), null);
  assert.equal(storage.getItem('unrelated-key'), 'keep');
});
