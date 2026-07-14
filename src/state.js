export const state = {
  activeCell: null,
  editingId: null,
  isAdding: false,
  currentLabelId: '',
  itemCount: 5,
  currentColor: { h: 0, s: 100, v: 100, a: 0.5 },
  pendingDeleteItemId: null,
  unifiedColor: { h: 0, s: 100, v: 100, a: 0.5 },
  unifiedEditingId: null,
  popupRepositionFrame: null,
  lastViewportWidth: globalThis.innerWidth ?? 0,
  visualPickerSession: null,
  unifiedEditBefore: null,
  isImeComposing: false
};

export const modalReturnFocus = new Map();
