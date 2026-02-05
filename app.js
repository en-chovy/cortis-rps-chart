/* --- GLOBAL STATE --- */
let activeCell = null;

let editingId = null;          // legend id currently being color-edited
let isAdding = false;          // name modal mode
let currentLabelId = '';       // label DOM id currently being edited
let itemCount = 5;             // last legend id

let currentH = 0, currentS = 100, currentV = 100;  // HSV for visual picker

let pendingDeleteItemId = null;

/* --- COLOR CONVERSION UTILS --- */
function hsvToRgb(h, s, v) {
  s /= 100; v /= 100;
  const f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
  return [
    Math.round(f(5) * 255),
    Math.round(f(3) * 255),
    Math.round(f(1) * 255)
  ];
}
function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function updateColors() {
  if (editingId == null) return;

  const [r, g, b] = hsvToRgb(Number(currentH), Number(currentS), Number(currentV));
  const hex = rgbToHex(r, g, b);

  document.documentElement.style.setProperty(`--color-${editingId}`, hex);
  document.documentElement.style.setProperty(`--color-${editingId}-a`, `rgba(${r}, ${g}, ${b}, 0.5)`);

  const sbArea = document.getElementById('sbArea');
  if (sbArea) sbArea.style.backgroundColor = `hsl(${currentH}, 100%, 50%)`;
}

/* --- UI CONTROL (POPUP/MODAL) --- */
function closeAllPopups() {
  const visual = document.getElementById('visualPickerPopup');
  const menu = document.getElementById('cellMenu');
  if (visual) visual.style.display = 'none';
  if (menu) menu.style.display = 'none';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function positionPopup(popup, target, isBelow) {
  if (!popup || !target) return;

  popup.style.display = 'flex';

  const rect = target.getBoundingClientRect();
  const container = document.querySelector('.container');
  if (!container) return;

  const containerRect = container.getBoundingClientRect();

  popup.style.left = (rect.left - containerRect.left + rect.width / 2 - popup.offsetWidth / 2) + 'px';
  popup.style.top = isBelow
    ? (rect.bottom - containerRect.top + 10) + 'px'
    : (rect.top - containerRect.top - popup.offsetHeight - 10) + 'px';
}

function openVisualPicker(target, id) {
  closeAllPopups();
  editingId = Number(id);

  const popup = document.getElementById('visualPickerPopup');
  positionPopup(popup, target, true);
}

/* --- LEGEND MODAL LOGIC --- */
function openNameModal(labelDomId) {
  isAdding = false;
  currentLabelId = labelDomId;

  document.getElementById('modalTitle').innerText = "이름 변경";
  document.getElementById('nameInput').value = document.getElementById(labelDomId).innerText;
  document.getElementById('nameModalOverlay').style.display = 'flex';
}

function openAddModal() {
  isAdding = true;

  document.getElementById('modalTitle').innerText = "새 범례 추가";
  document.getElementById('nameInput').value = "";
  document.getElementById('nameModalOverlay').style.display = 'flex';
}

function saveName() {
  const val = document.getElementById('nameInput').value.trim();
  if (!val) return;

  if (isAdding) {
    itemCount += 1;

    // default colors
    document.documentElement.style.setProperty(`--color-${itemCount}`, '#cccccc');
    document.documentElement.style.setProperty(`--color-${itemCount}-a`, 'rgba(204,204,204,0.5)');

    // create legend item WITHOUT inline onclick (handled by event delegation)
    const div = document.createElement('div');
    div.className = 'legend-item';
    div.id = `item-${itemCount}`;
    div.innerHTML = `
      <div class="circle-display" id="disp-${itemCount}" style="background-color: var(--color-${itemCount});"></div>
      <span class="editable-label" id="label-${itemCount}">${val}</span>
      <button class="btn-delete-item" type="button">✕</button>
    `.trim();

    const legendContainer = document.getElementById('legendContainer');
    const addBtn = legendContainer?.querySelector('.btn-add-legend');
    if (legendContainer && addBtn) {
      legendContainer.insertBefore(div, addBtn);
    } else if (legendContainer) {
      legendContainer.appendChild(div);
    }
  } else {
    const label = document.getElementById(currentLabelId);
    if (label) label.innerText = val;
  }

  closeModal('nameModalOverlay');
}

function openDeleteConfirm(itemId) {
  pendingDeleteItemId = itemId;
  document.getElementById('deleteModalOverlay').style.display = 'flex';
}

/* --- INTERACTION HANDLERS --- */
function openCellMenu(target) {
  closeAllPopups();

  const menu = document.getElementById('cellMenu');
  if (!menu) return;

  menu.innerHTML = '';

  document.querySelectorAll('.legend-item').forEach(item => {
    const id = Number(item.id.split('-')[1]);
    const opt = document.createElement('div');
    opt.className = 'menu-option';
    opt.style.backgroundColor = `var(--color-${id})`;
    opt.addEventListener('click', () => {
      if (activeCell) activeCell.style.backgroundColor = `var(--color-${id}-a)`;
      closeAllPopups();
    });
    menu.appendChild(opt);
  });

  const reset = document.createElement('div');
  reset.className = 'menu-reset';
  reset.innerText = '✕';
  reset.addEventListener('click', () => {
    if (activeCell) activeCell.style.backgroundColor = 'transparent';
    closeAllPopups();
  });
  menu.appendChild(reset);

  positionPopup(menu, target, false);
}

/* --- INIT / EVENT BINDINGS --- */
function initColorPicker() {
  const sbArea = document.getElementById('sbArea');
  const hueSlider = document.getElementById('hueSlider');

  if (!sbArea || !hueSlider) return;

  function getClientXY(e) {
    if (e.touches?.length) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function handleSB(e) {
    const rect = sbArea.getBoundingClientRect();
    const { x: cx, y: cy } = getClientXY(e);

    let x = Math.max(0, Math.min(rect.width, cx - rect.left));
    let y = Math.max(0, Math.min(rect.height, cy - rect.top));

    currentS = (x / rect.width) * 100;
    currentV = 100 - (y / rect.height) * 100;

    const cursor = document.getElementById('pickerCursor');
    if (cursor) {
      cursor.style.left = x + 'px';
      cursor.style.top = y + 'px';
    }

    updateColors();
  }

  // Mouse
  sbArea.addEventListener('mousedown', (e) => {
    handleSB(e);
    const move = (me) => handleSB(me);
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });

  // Touch
  sbArea.addEventListener('touchstart', (e) => {
    handleSB(e);
    const move = (me) => handleSB(me);
    const up = () => {
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', up);
      document.removeEventListener('touchcancel', up);
    };
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', up);
    document.addEventListener('touchcancel', up);
  }, { passive: false });

  hueSlider.addEventListener('input', (e) => {
    currentH = e.target.value;
    updateColors();
  });
}

function initLegendDelegation() {
  const legendContainer = document.getElementById('legendContainer');
  if (!legendContainer) return;

  legendContainer.addEventListener('click', (e) => {
    const circle = e.target.closest('.circle-display');
    if (circle && legendContainer.contains(circle)) {
      const id = Number(circle.id.split('-')[1]);
      openVisualPicker(circle, id);
      return;
    }

    const label = e.target.closest('.editable-label');
    if (label && legendContainer.contains(label)) {
      openNameModal(label.id);
      return;
    }

    const delBtn = e.target.closest('.btn-delete-item');
    if (delBtn && legendContainer.contains(delBtn)) {
      const item = delBtn.closest('.legend-item');
      if (item) openDeleteConfirm(item.id);
      return;
    }

    const addBtn = e.target.closest('.btn-add-legend');
    if (addBtn && legendContainer.contains(addBtn)) {
      openAddModal();
      return;
    }
  });
}

function initModalButtons() {
  // Name modal
  const nameOverlay = document.getElementById('nameModalOverlay');
  if (nameOverlay) {
    nameOverlay.querySelector('.btn-cancel')?.addEventListener('click', () => closeModal('nameModalOverlay'));
    nameOverlay.querySelector('.btn-save')?.addEventListener('click', saveName);
  }

  // Delete modal
  const delOverlay = document.getElementById('deleteModalOverlay');
  if (delOverlay) {
    delOverlay.querySelector('.btn-cancel')?.addEventListener('click', () => {
      pendingDeleteItemId = null;
      closeModal('deleteModalOverlay');
    });

    document.getElementById('confirmDelBtn')?.addEventListener('click', () => {
      if (!pendingDeleteItemId) return;
      document.getElementById(pendingDeleteItemId)?.remove();
      pendingDeleteItemId = null;
      closeModal('deleteModalOverlay');
    });
  }

  // Visual picker "done"
  const picker = document.getElementById('visualPickerPopup');
  picker?.querySelector('.btn-done')?.addEventListener('click', closeAllPopups);
}

function initGlobalInteraction() {
  // Open cell menu (paintable cells) + close popups on outside click
  document.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('paintable')) {
      activeCell = e.target;
      openCellMenu(e.target);
      return;
    }

    // click outside: close popups (but don't interfere with modal interaction)
    if (!e.target.closest('.ios-popup') &&
        !e.target.closest('#visualPickerPopup') &&
        !e.target.closest('.modal')) {
      closeAllPopups();
    }
  });

  // Text selection prevention (kept as-is)
  document.addEventListener('selectstart', (e) => {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') e.preventDefault();
  });

  document.addEventListener('dragstart', (e) => {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') e.preventDefault();
  });
}

// Boot (script is loaded at end of body, but keep safe)
(function boot() {
  initColorPicker();
  initLegendDelegation();
  initModalButtons();
  initGlobalInteraction();
})();