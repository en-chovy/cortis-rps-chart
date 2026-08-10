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
  editableState.ghostCells[0] = true;
  editableState.deletedRows.push(2);
  editableState.deletedColumns.push(4);

  assert.equal(saveEditableState(editableState, storage), true);
  assert.deepEqual(loadEditableState(storage), editableState);
});

test('migrates version 1 state with visible rows, columns, and cell text', () => {
  const storage = createMemoryStorage();
  const legacyState = createInitialEditableState();
  delete legacyState.ghostCells;
  delete legacyState.deletedRows;
  delete legacyState.deletedColumns;
  legacyState.cells[3] = 2;
  storage.setItem(editableStateStorageKey, JSON.stringify({
    version: 1,
    editableState: legacyState
  }));

  const migrated = loadEditableState(storage);
  assert.equal(migrated.cells[3], 2);
  assert.deepEqual(migrated.ghostCells, Array(20).fill(false));
  assert.deepEqual(migrated.deletedRows, []);
  assert.deepEqual(migrated.deletedColumns, []);
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

test('rejects malformed ghost and deleted-group state in version 2 data', () => {
  const invalidMutations = [
    state => { state.ghostCells.pop(); },
    state => { state.ghostCells[0] = 1; },
    state => { state.deletedRows = [1, 1]; },
    state => { state.deletedColumns = [5]; },
    state => { state.deletedColumns = [1.5]; }
  ];

  invalidMutations.forEach(mutate => {
    const storage = createMemoryStorage();
    const editableState = createInitialEditableState();
    mutate(editableState);
    storage.setItem(editableStateStorageKey, JSON.stringify({
      version: 2,
      editableState
    }));

    assert.equal(loadEditableState(storage), null);
    assert.equal(storage.getItem(editableStateStorageKey), null);
  });
});

test('clears a persisted editable state explicitly', () => {
  const storage = createMemoryStorage();
  storage.setItem('unrelated-key', 'keep');
  saveEditableState(createInitialEditableState(), storage);

  assert.equal(clearEditableState(storage), true);
  assert.equal(loadEditableState(storage), null);
  assert.equal(storage.getItem('unrelated-key'), 'keep');
});
