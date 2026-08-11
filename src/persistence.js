const STORAGE_KEY = 'cortis-rps-chart:editable-state';
const STORAGE_VERSION = 3;
const PREVIOUS_STORAGE_VERSION = 2;
const LEGACY_STORAGE_VERSION = 1;
const NAME_GROUP_COUNT = 5;
const PAINTABLE_CELL_COUNT = NAME_GROUP_COUNT * (NAME_GROUP_COUNT - 1);
const HISTORY_LIMIT = 100;
const HISTORY_TYPE_MAX_LENGTH = 80;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isValidColor(color) {
  return isPlainObject(color)
    && /^#[0-9a-f]{6}$/i.test(color.hex)
    && Number.isFinite(color.alpha)
    && color.alpha >= 0
    && color.alpha <= 1;
}

function hasValidCoreEditableState(value) {
  if (!isPlainObject(value)
    || !Number.isInteger(value.nextLegendId)
    || value.nextLegendId < 1
    || !Array.isArray(value.legends)
    || !isPlainObject(value.colors)
    || !Array.isArray(value.cells)
    || value.cells.length !== PAINTABLE_CELL_COUNT) {
    return false;
  }

  const legendIds = new Set();
  for (const legend of value.legends) {
    if (!isPlainObject(legend)
      || !Number.isInteger(legend.id)
      || legend.id < 1
      || typeof legend.name !== 'string'
      || legend.name.trim() === ''
      || legendIds.has(legend.id)) {
      return false;
    }
    legendIds.add(legend.id);
  }

  const colorIds = Object.keys(value.colors).map(Number);
  if (colorIds.some(id => !Number.isInteger(id) || id < 1)
    || Object.values(value.colors).some(color => !isValidColor(color))
    || [...legendIds].some(id => !isValidColor(value.colors[id]))) {
    return false;
  }

  const highestKnownId = Math.max(0, ...legendIds, ...colorIds);
  if (value.nextLegendId <= highestKnownId) return false;

  return value.cells.every(legendId => (
    legendId === null || (Number.isInteger(legendId) && legendIds.has(legendId))
  ));
}

function isValidDeletedGroups(groups) {
  return Array.isArray(groups)
    && new Set(groups).size === groups.length
    && groups.every(index => (
      Number.isInteger(index) && index >= 0 && index < NAME_GROUP_COUNT
    ));
}

function isValidEditableState(value) {
  return hasValidCoreEditableState(value)
    && Array.isArray(value.ghostCells)
    && value.ghostCells.length === PAINTABLE_CELL_COUNT
    && value.ghostCells.every(ghost => typeof ghost === 'boolean')
    && isValidDeletedGroups(value.deletedRows)
    && isValidDeletedGroups(value.deletedColumns);
}

function migrateLegacyEditableState(value) {
  if (!hasValidCoreEditableState(value)) return null;
  return {
    ...value,
    ghostCells: Array(PAINTABLE_CELL_COUNT).fill(false),
    deletedRows: [],
    deletedColumns: []
  };
}

function createEmptyHistory(editableState) {
  return {
    base: clone(editableState),
    entries: [],
    cursor: 0
  };
}

function statesMatch(first, second) {
  return JSON.stringify(first) === JSON.stringify(second);
}

function isValidHistory(history, editableState) {
  if (!isPlainObject(history)
    || !isValidEditableState(history.base)
    || !Array.isArray(history.entries)
    || history.entries.length > HISTORY_LIMIT
    || !Number.isInteger(history.cursor)
    || history.cursor < 0
    || history.cursor > history.entries.length) {
    return false;
  }

  const entriesAreValid = history.entries.every(entry => (
    isPlainObject(entry)
    && typeof entry.type === 'string'
    && entry.type.length > 0
    && entry.type.length <= HISTORY_TYPE_MAX_LENGTH
    && isValidEditableState(entry.state)
  ));
  if (!entriesAreValid) return false;

  const currentSnapshot = history.cursor === 0
    ? history.base
    : history.entries[history.cursor - 1].state;
  return statesMatch(currentSnapshot, editableState);
}

function getSessionStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

function removeInvalidPayload(target) {
  try {
    target.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable in restricted browsing contexts.
  }
}

export function loadEditableSession(storage) {
  const target = getSessionStorage(storage);
  if (!target) return null;

  try {
    const raw = target.getItem(STORAGE_KEY);
    if (raw === null) return null;

    const payload = JSON.parse(raw);
    if (!isPlainObject(payload)) {
      removeInvalidPayload(target);
      return null;
    }

    if (payload.version === STORAGE_VERSION && isValidEditableState(payload.editableState)) {
      const editableState = clone(payload.editableState);
      const history = isValidHistory(payload.history, editableState)
        ? clone(payload.history)
        : createEmptyHistory(editableState);
      return { editableState, history };
    }

    if (payload.version === PREVIOUS_STORAGE_VERSION
      && isValidEditableState(payload.editableState)) {
      const editableState = clone(payload.editableState);
      return {
        editableState,
        history: createEmptyHistory(editableState)
      };
    }

    if (payload.version === LEGACY_STORAGE_VERSION) {
      const editableState = migrateLegacyEditableState(payload.editableState);
      if (editableState) {
        return {
          editableState,
          history: createEmptyHistory(editableState)
        };
      }
    }

    removeInvalidPayload(target);
    return null;
  } catch {
    removeInvalidPayload(target);
    return null;
  }
}

export function loadEditableState(storage) {
  return loadEditableSession(storage)?.editableState ?? null;
}

export function saveEditableSession(editableState, history, storage) {
  const target = getSessionStorage(storage);
  if (!target || !isValidEditableState(editableState)) return false;

  const safeHistory = isValidHistory(history, editableState)
    ? history
    : createEmptyHistory(editableState);
  const createPayload = nextHistory => JSON.stringify({
    version: STORAGE_VERSION,
    editableState,
    history: nextHistory
  });

  try {
    target.setItem(STORAGE_KEY, createPayload(safeHistory));
    return true;
  } catch {
    try {
      // Keeping the current chart is more important than keeping a long timeline.
      target.setItem(STORAGE_KEY, createPayload(createEmptyHistory(editableState)));
      return true;
    } catch {
      return false;
    }
  }
}

export function saveEditableState(editableState, storage) {
  return saveEditableSession(
    editableState,
    createEmptyHistory(editableState),
    storage
  );
}

export function clearEditableState(storage) {
  const target = getSessionStorage(storage);
  if (!target) return false;

  try {
    target.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export const editableStateStorageKey = STORAGE_KEY;
export const editableHistoryLimit = HISTORY_LIMIT;
