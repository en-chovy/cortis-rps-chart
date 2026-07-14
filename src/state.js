export const state = {
  activeCell: null,
  activeCellIndex: null,
  editingId: null,
  isAdding: false,
  nameEditingId: null,
  pendingDeleteItemId: null,
  unifiedEditingId: null,
  popupRepositionFrame: null,
  lastViewportWidth: globalThis.innerWidth ?? 0,
  visualPickerSession: null,
  isImeComposing: false
};

export const modalReturnFocus = new Map();
