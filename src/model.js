import { normalizeLegendName } from './legend-name.js?v=20260812-1';

export const NAME_GROUP_COUNT = 5;
export const PAINTABLE_CELL_COUNT = NAME_GROUP_COUNT * (NAME_GROUP_COUNT - 1);

const INITIAL_LEGENDS = [
  { id: 1, name: 'OTP', color: { hex: '#ffadad', alpha: 0.5 } },
  { id: 2, name: '좋음', color: { hex: '#ffd6a5', alpha: 0.5 } },
  { id: 3, name: '보통', color: { hex: '#fdffb6', alpha: 0.5 } },
  { id: 4, name: '스루', color: { hex: '#caffbf', alpha: 0.5 } },
  { id: 5, name: '지뢰', color: { hex: '#9bf6ff', alpha: 0.5 } }
];

export function createInitialEditableState() {
  const nextLegendId = Math.max(...INITIAL_LEGENDS.map(legend => legend.id)) + 1;
  return {
    nextLegendId,
    legends: INITIAL_LEGENDS.map(({ id, name }) => ({ id, name })),
    colors: Object.fromEntries(INITIAL_LEGENDS.map(({ id, color }) => [id, { ...color }])),
    cells: Array(PAINTABLE_CELL_COUNT).fill(null),
    ghostCells: Array(PAINTABLE_CELL_COUNT).fill(false),
    deletedRows: [],
    deletedColumns: []
  };
}

let editableState = createInitialEditableState();

export function getEditableState() {
  return editableState;
}

export function cloneEditableState() {
  return JSON.parse(JSON.stringify(editableState));
}

export function replaceEditableState(snapshot) {
  const nextState = JSON.parse(JSON.stringify(snapshot));
  nextState.legends = nextState.legends.map(legend => ({
    ...legend,
    name: normalizeLegendName(legend.name)
  }));
  nextState.ghostCells = Array.isArray(nextState.ghostCells)
    && nextState.ghostCells.length === PAINTABLE_CELL_COUNT
    && nextState.ghostCells.every(value => typeof value === 'boolean')
    ? nextState.ghostCells
    : Array(PAINTABLE_CELL_COUNT).fill(false);
  nextState.deletedRows = normalizeDeletedGroups(nextState.deletedRows);
  nextState.deletedColumns = normalizeDeletedGroups(nextState.deletedColumns);
  editableState = nextState;
  return editableState;
}

function normalizeDeletedGroups(groups) {
  if (!Array.isArray(groups)) return [];
  return [...new Set(groups)]
    .filter(index => Number.isInteger(index) && index >= 0 && index < NAME_GROUP_COUNT)
    .sort((a, b) => a - b);
}

export function getLegend(id) {
  return editableState.legends.find(legend => legend.id === Number(id)) ?? null;
}

export function getLegendColor(id) {
  return editableState.colors[Number(id)] ?? null;
}

export function addLegend(name) {
  const id = editableState.nextLegendId;
  editableState.nextLegendId += 1;
  editableState.legends.push({ id, name: normalizeLegendName(name) });
  editableState.colors[id] = { hex: '#cccccc', alpha: 0.5 };
  return id;
}

export function renameLegend(id, name) {
  const legend = getLegend(id);
  if (legend) legend.name = normalizeLegendName(name);
}

export function setLegendColor(id, color) {
  if (!editableState.colors[Number(id)]) return;
  editableState.colors[Number(id)] = {
    hex: color.hex,
    alpha: Number(color.alpha)
  };
}

export function deleteLegend(id) {
  const numericId = Number(id);
  editableState.legends = editableState.legends.filter(legend => legend.id !== numericId);
  editableState.cells = editableState.cells.map(legendId => (
    legendId === numericId ? null : legendId
  ));
}

export function paintCell(index, legendId) {
  if (index < 0 || index >= editableState.cells.length) return;
  editableState.cells[index] = legendId == null ? null : Number(legendId);
}

export function toggleGhostCell(index) {
  const numericIndex = Number(index);
  if (!Number.isInteger(numericIndex)
    || numericIndex < 0
    || numericIndex >= editableState.ghostCells.length) return;
  editableState.ghostCells[numericIndex] = !editableState.ghostCells[numericIndex];
}

export function deleteNameGroup(axis, groupIndex) {
  const numericGroupIndex = Number(groupIndex);
  if (!['row', 'column'].includes(axis)
    || !Number.isInteger(numericGroupIndex)
    || numericGroupIndex < 0
    || numericGroupIndex >= NAME_GROUP_COUNT) return;

  const groups = axis === 'row' ? editableState.deletedRows : editableState.deletedColumns;
  if (groups.includes(numericGroupIndex)) return;
  groups.push(numericGroupIndex);
  groups.sort((a, b) => a - b);
}

export function restoreNameGroup(axis, groupIndex) {
  const numericGroupIndex = Number(groupIndex);
  if (!['row', 'column'].includes(axis)
    || !Number.isInteger(numericGroupIndex)
    || numericGroupIndex < 0
    || numericGroupIndex >= NAME_GROUP_COUNT) return;

  const key = axis === 'row' ? 'deletedRows' : 'deletedColumns';
  editableState[key] = editableState[key].filter(index => index !== numericGroupIndex);
}

export function restoreAllNameGroups() {
  editableState.deletedRows = [];
  editableState.deletedColumns = [];
}

export function paintNameGroup(axis, groupIndex, legendId) {
  const numericGroupIndex = Number(groupIndex);
  if (!['row', 'column'].includes(axis)
    || !Number.isInteger(numericGroupIndex)
    || numericGroupIndex < 0
    || numericGroupIndex >= NAME_GROUP_COUNT) return;
  if ((axis === 'row' && editableState.deletedRows.includes(numericGroupIndex))
    || (axis === 'column' && editableState.deletedColumns.includes(numericGroupIndex))) return;

  const numericLegendId = legendId == null ? null : Number(legendId);
  let cellIndex = 0;
  for (let row = 0; row < NAME_GROUP_COUNT; row += 1) {
    for (let column = 0; column < NAME_GROUP_COUNT; column += 1) {
      if (row === column) continue;
      const isTargetCell = (axis === 'row' && row === numericGroupIndex)
        || (axis === 'column' && column === numericGroupIndex);
      const isDeletedIntersection = editableState.deletedRows.includes(row)
        || editableState.deletedColumns.includes(column);
      if (isTargetCell && !isDeletedIntersection) {
        editableState.cells[cellIndex] = numericLegendId;
      }
      cellIndex += 1;
    }
  }
}
