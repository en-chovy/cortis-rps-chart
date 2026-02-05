/* --- GLOBAL STATE --- */
let activeCell = null;
let editingId = null;
let isAdding = false;
let currentLabelId = '';
let itemCount = 5;
let currentH = 0, currentS = 100, currentV = 100;

/* --- COLOR CONVERSION UTILS --- */
function hsvToRgb(h, s, v) {
    s /= 100; v /= 100;
    let f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
    return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
}
function rgbToHex(r, g, b) { return "#" + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join(''); }

function updateColors() {
    const [r, g, b] = hsvToRgb(currentH, currentS, currentV);
    const hex = rgbToHex(r, g, b);
    document.documentElement.style.setProperty(`--color-${editingId}`, hex);
    document.documentElement.style.setProperty(`--color-${editingId}-a`, `rgba(${r}, ${g}, ${b}, 0.5)`);
    document.getElementById('sbArea').style.backgroundColor = `hsl(${currentH}, 100%, 50%)`;
}

/* --- COLOR PICKER HANDLERS --- */
const sbArea = document.getElementById('sbArea');
const hueSlider = document.getElementById('hueSlider');

function handleSB(e) {
    const rect = sbArea.getBoundingClientRect();
    let x = Math.max(0, Math.min(rect.width, (e.clientX || e.touches?.[0].clientX) - rect.left));
    let y = Math.max(0, Math.min(rect.height, (e.clientY || e.touches?.[0].clientY) - rect.top));
    currentS = (x / rect.width) * 100; currentV = 100 - (y / rect.height) * 100;
    document.getElementById('pickerCursor').style.left = x + 'px';
    document.getElementById('pickerCursor').style.top = y + 'px';
    updateColors();
}

sbArea.addEventListener('mousedown', (e) => { 
    handleSB(e);
    const move = (me) => handleSB(me);
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
});

hueSlider.addEventListener('input', (e) => { currentH = e.target.value; updateColors(); });

/* --- UI CONTROL (POPUP/MODAL) --- */
function openVisualPicker(target, id) { closeAllPopups(); editingId = id; positionPopup(document.getElementById('visualPickerPopup'), target, true); }
function closeAllPopups() { document.getElementById('visualPickerPopup').style.display = 'none'; document.getElementById('cellMenu').style.display = 'none'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function positionPopup(popup, target, isBelow) {
    popup.style.display = 'flex';
    const rect = target.getBoundingClientRect();
    const containerRect = document.querySelector('.container').getBoundingClientRect();
    popup.style.left = (rect.left - containerRect.left + rect.width/2 - popup.offsetWidth/2) + 'px';
    popup.style.top = isBelow ? (rect.bottom - containerRect.top + 10) + 'px' : (rect.top - containerRect.top - popup.offsetHeight - 10) + 'px';
}

/* --- LEGEND MODAL LOGIC --- */
function openNameModal(id) {
    isAdding = false;
    currentLabelId = id;
    document.getElementById('modalTitle').innerText = "이름 변경";
    document.getElementById('nameInput').value = document.getElementById(id).innerText;
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
        itemCount++;
        document.documentElement.style.setProperty(`--color-${itemCount}`, '#cccccc');
        document.documentElement.style.setProperty(`--color-${itemCount}-a`, 'rgba(204,204,204,0.5)');
        
        const div = document.createElement('div');
        div.className = 'legend-item'; div.id = `item-${itemCount}`;
        div.innerHTML = `<div class="circle-display" id="disp-${itemCount}" style="background-color: var(--color-${itemCount});" onclick="openVisualPicker(this, ${itemCount})"></div><span class="editable-label" onclick="openNameModal('label-${itemCount}')" id="label-${itemCount}">${val}</span><button class="btn-delete-item" onclick="openDeleteConfirm('item-${itemCount}')">✕</button>`;
        document.getElementById('legendContainer').insertBefore(div, document.querySelector('.btn-add-legend'));
    } else {
        document.getElementById(currentLabelId).innerText = val;
    }
    closeModal('nameModalOverlay');
}

function openDeleteConfirm(itemId) {
    document.getElementById('deleteModalOverlay').style.display = 'flex';
    document.getElementById('confirmDelBtn').onclick = () => { document.getElementById(itemId).remove(); closeModal('deleteModalOverlay'); };
}

/* --- INTERACTION HANDLERS --- */
document.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('paintable')) {
        activeCell = e.target;
        openCellMenu(e.target);
    } else if (!e.target.closest('.ios-popup') && 
            !e.target.classList.contains('circle-display') && 
            !e.target.closest('.modal')) {
        closeAllPopups();
    }
});

function openCellMenu(target) {
    closeAllPopups();
    const menu = document.getElementById('cellMenu');
    menu.innerHTML = '';
    document.querySelectorAll('.legend-item').forEach(item => {
        const id = item.id.split('-')[1];
        const opt = document.createElement('div');
        opt.className = 'menu-option';
        opt.style.backgroundColor = `var(--color-${id})`;
        opt.onclick = () => { activeCell.style.backgroundColor = `var(--color-${id}-a)`; closeAllPopups(); };
        menu.appendChild(opt);
    });
    const reset = document.createElement('div');
    reset.className = 'menu-reset'; reset.innerText = '✕';
    reset.onclick = () => { activeCell.style.backgroundColor = 'transparent'; closeAllPopups(); };
    menu.appendChild(reset);
    positionPopup(menu, target, false);
}

/* --- DRAG HANDLERS (TEXT SELECT PREVENTION) --- */
document.addEventListener('selectstart', (e) => {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
    }
});

document.addEventListener('dragstart', (e) => {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
    }
});