const STORAGE_KEY = 'cortis-rps-chart:editable-state';
const STORAGE_VERSION = 1;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidColor(color) {
  return isPlainObject(color)
    && /^#[0-9a-f]{6}$/i.test(color.hex)
    && Number.isFinite(color.alpha)
    && color.alpha >= 0
    && color.alpha <= 1;
}

function isValidEditableState(value) {
  if (!isPlainObject(value)
    || !Number.isInteger(value.nextLegendId)
    || value.nextLegendId < 1
    || !Array.isArray(value.legends)
    || !isPlainObject(value.colors)
    || !Array.isArray(value.cells)
    || value.cells.length !== 20) {
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

function getSessionStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

export function loadEditableState(storage) {
  const target = getSessionStorage(storage);
  if (!target) return null;

  try {
    const raw = target.getItem(STORAGE_KEY);
    if (raw === null) return null;

    const payload = JSON.parse(raw);
    if (!isPlainObject(payload)
      || payload.version !== STORAGE_VERSION
      || !isValidEditableState(payload.editableState)) {
      target.removeItem(STORAGE_KEY);
      return null;
    }

    return payload.editableState;
  } catch {
    try {
      target.removeItem(STORAGE_KEY);
    } catch {
      // Storage can be unavailable in restricted browsing contexts.
    }
    return null;
  }
}

export function saveEditableState(editableState, storage) {
  const target = getSessionStorage(storage);
  if (!target || !isValidEditableState(editableState)) return false;

  try {
    target.setItem(STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      editableState
    }));
    return true;
  } catch {
    return false;
  }
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
