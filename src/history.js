import { cloneEditableState, getEditableState, replaceEditableState } from './model.js?v=20260811-7';

const HISTORY_LIMIT = 100;
let timeline = null;
let render = () => {};
let persist = () => {};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function statesMatch(first, second) {
  return JSON.stringify(first) === JSON.stringify(second);
}

function createEmptyTimeline(snapshot = cloneEditableState()) {
  return {
    base: clone(snapshot),
    entries: [],
    cursor: 0
  };
}

function getCurrentTimelineSnapshot() {
  if (!timeline) return cloneEditableState();
  return timeline.cursor === 0
    ? timeline.base
    : timeline.entries[timeline.cursor - 1].state;
}

function persistCurrentSession() {
  if (!timeline) timeline = createEmptyTimeline();
  persist(cloneEditableState(), clone(timeline));
}

export function configureHistory({
  renderApp,
  persistEditableSession = () => {},
  initialHistory = null
}) {
  render = renderApp;
  persist = persistEditableSession;
  timeline = initialHistory ? clone(initialHistory) : createEmptyTimeline();

  if (!statesMatch(getCurrentTimelineSnapshot(), cloneEditableState())) {
    timeline = createEmptyTimeline();
  }
}

export function captureEditableState() {
  return cloneEditableState();
}

export function getHistoryState() {
  if (!timeline) timeline = createEmptyTimeline();
  return clone(timeline);
}

export function restoreEditableState(snapshot) {
  replaceEditableState(snapshot);
  render();
  persistCurrentSession();
}

function updateControls() {
  const undoButton = document.getElementById('undoButton');
  const redoButton = document.getElementById('redoButton');
  if (undoButton) undoButton.disabled = !timeline || timeline.cursor === 0;
  if (redoButton) redoButton.disabled = !timeline || timeline.cursor >= timeline.entries.length;
}

export function recordHistory(type, before, after = captureEditableState()) {
  if (statesMatch(before, after)) return false;
  if (!timeline || !statesMatch(getCurrentTimelineSnapshot(), before)) {
    timeline = createEmptyTimeline(before);
  }

  timeline.entries.splice(timeline.cursor);
  timeline.entries.push({ type, state: clone(after) });
  timeline.cursor = timeline.entries.length;

  while (timeline.entries.length > HISTORY_LIMIT) {
    const oldestEntry = timeline.entries.shift();
    timeline.base = clone(oldestEntry.state);
    timeline.cursor -= 1;
  }

  persistCurrentSession();
  updateControls();
  return true;
}

export function commitMutation(type, mutate) {
  const before = captureEditableState();
  mutate(getEditableState());
  const after = captureEditableState();
  if (statesMatch(before, after)) return false;
  render();
  return recordHistory(type, before, after);
}

export function undoEdit() {
  if (!timeline || timeline.cursor === 0) return;
  timeline.cursor -= 1;
  const snapshot = getCurrentTimelineSnapshot();
  replaceEditableState(snapshot);
  render();
  persistCurrentSession();
  updateControls();
}

export function redoEdit() {
  if (!timeline || timeline.cursor >= timeline.entries.length) return;
  timeline.cursor += 1;
  const snapshot = getCurrentTimelineSnapshot();
  replaceEditableState(snapshot);
  render();
  persistCurrentSession();
  updateControls();
}

export function initHistoryControls() {
  document.getElementById('undoButton')?.addEventListener('click', undoEdit);
  document.getElementById('redoButton')?.addEventListener('click', redoEdit);
  updateControls();
}

export function clearHistory({ persistSession = false } = {}) {
  timeline = createEmptyTimeline();
  if (persistSession) persistCurrentSession();
  updateControls();
}
