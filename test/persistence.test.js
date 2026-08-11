import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createInitialEditableState } from '../src/model.js';
import {
  clearEditableState,
  editableHistoryLimit,
  editableStateStorageKey,
  loadEditableSession,
  loadEditableState,
  saveEditableSession,
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function emptyHistory(editableState) {
  return {
    base: clone(editableState),
    entries: [],
    cursor: 0
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

test('round-trips a version 3 timeline at a middle cursor', () => {
  const storage = createMemoryStorage();
  const base = createInitialEditableState();
  const painted = clone(base);
  painted.cells[0] = 1;
  const ghosted = clone(painted);
  ghosted.ghostCells[0] = true;
  const history = {
    base,
    entries: [
      { type: 'cell-paint', state: painted },
      { type: 'cell-ghost', state: ghosted }
    ],
    cursor: 1
  };

  assert.equal(saveEditableSession(painted, history, storage), true);
  assert.deepEqual(loadEditableSession(storage), {
    editableState: painted,
    history
  });
});

test('migrates version 1 state with an empty history', () => {
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

  const session = loadEditableSession(storage);
  const migrated = session.editableState;
  assert.equal(migrated.cells[3], 2);
  assert.deepEqual(migrated.ghostCells, Array(20).fill(false));
  assert.deepEqual(migrated.deletedRows, []);
  assert.deepEqual(migrated.deletedColumns, []);
  assert.deepEqual(session.history, emptyHistory(migrated));
});

test('migrates version 2 state with an empty history', () => {
  const storage = createMemoryStorage();
  const editableState = createInitialEditableState();
  editableState.cells[7] = 3;
  editableState.ghostCells[7] = true;
  editableState.deletedRows = [1];
  editableState.deletedColumns = [4];
  storage.setItem(editableStateStorageKey, JSON.stringify({
    version: 2,
    editableState
  }));

  assert.deepEqual(loadEditableSession(storage), {
    editableState,
    history: emptyHistory(editableState)
  });
});

test('salvages a valid version 3 chart when its history is malformed or mismatched', () => {
  const editableState = createInitialEditableState();
  editableState.cells[0] = 1;
  const mismatchedBase = createInitialEditableState();
  const invalidHistories = [
    {
      base: clone(editableState),
      entries: [{ type: 'cell-paint', state: { cells: [] } }],
      cursor: 1
    },
    {
      base: mismatchedBase,
      entries: [],
      cursor: 0
    }
  ];

  invalidHistories.forEach(history => {
    const storage = createMemoryStorage();
    storage.setItem(editableStateStorageKey, JSON.stringify({
      version: 3,
      editableState,
      history
    }));

    assert.deepEqual(loadEditableSession(storage), {
      editableState,
      history: emptyHistory(editableState)
    });
    assert.notEqual(storage.getItem(editableStateStorageKey), null);
  });
});

test('accepts 100 history entries and salvages an over-limit timeline', () => {
  const storage = createMemoryStorage();
  const editableState = createInitialEditableState();
  const makeEntries = count => Array.from({ length: count }, (_, index) => ({
    type: `mutation-${index}`,
    state: clone(editableState)
  }));
  const maximumHistory = {
    base: clone(editableState),
    entries: makeEntries(editableHistoryLimit),
    cursor: editableHistoryLimit
  };

  assert.equal(saveEditableSession(editableState, maximumHistory, storage), true);
  assert.deepEqual(loadEditableSession(storage).history, maximumHistory);

  const overLimitHistory = {
    ...maximumHistory,
    entries: makeEntries(editableHistoryLimit + 1),
    cursor: editableHistoryLimit + 1
  };
  assert.equal(saveEditableSession(editableState, overLimitHistory, storage), true);
  assert.deepEqual(loadEditableSession(storage).history, emptyHistory(editableState));
});

test('salvages a valid chart when the persisted history cursor is invalid', () => {
  [-1, 2, 0.5].forEach(cursor => {
    const storage = createMemoryStorage();
    const editableState = createInitialEditableState();
    storage.setItem(editableStateStorageKey, JSON.stringify({
      version: 3,
      editableState,
      history: {
        base: clone(editableState),
        entries: [{ type: 'noop', state: clone(editableState) }],
        cursor
      }
    }));

    assert.deepEqual(loadEditableSession(storage), {
      editableState,
      history: emptyHistory(editableState)
    });
  });
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
