const EXPORT_PRESET = {
  pixelRatio: 4,
  margin: 48,
  contentWidth: 443,
  cellWidth: 69.5,
  cellHeight: 39.75,
  gridLineWidth: 2 / 3,
  gridColor: '#333',
  legendBorderWidth: 1,
  legendBorderColor: 'rgba(0, 0, 0, 0.1)'
};

const EXPORT_TEXT_SELECTOR = [
  '.container > h1',
  '#legendContainer .legend-item:not(.is-leaving) .editable-label',
  '#rpsTable th',
  '#rpsTable td',
  '#chartTimestamp:not([hidden])'
].join(', ');

function isRenderedElement(element) {
  return Boolean(
    element
    && !element.closest('[hidden]')
    && element.getClientRects().length > 0
    && getComputedStyle(element).display !== 'none'
  );
}

function getCanvasFont(style) {
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

async function loadExportFonts() {
  const fontSet = document.fonts;
  if (!fontSet?.load) return;

  const textsByFont = new Map();
  document.querySelectorAll(EXPORT_TEXT_SELECTOR).forEach(element => {
    if (!isRenderedElement(element)) return;
    const text = element.textContent.trim();
    if (!text) return;

    const font = getCanvasFont(getComputedStyle(element));
    if (!textsByFont.has(font)) textsByFont.set(font, new Set());
    textsByFont.get(font).add(text);
  });

  await Promise.all(
    [...textsByFont].map(([font, texts]) => fontSet.load(font, [...texts].join('')))
  );
  await fontSet.ready;
}

function getLineHeight(style) {
  const lineHeight = Number.parseFloat(style.lineHeight);
  if (Number.isFinite(lineHeight)) return lineHeight;

  const fontSize = Number.parseFloat(style.fontSize);
  return Number.isFinite(fontSize) ? fontSize * 1.2 : 0;
}

function getTextBounds(context, text, fallbackHeight = 0) {
  const metrics = context.measureText(text);
  const width = Math.max(
    metrics.width,
    (metrics.actualBoundingBoxLeft || 0) + (metrics.actualBoundingBoxRight || 0)
  );
  const ascent = metrics.actualBoundingBoxAscent || fallbackHeight * 0.75;
  const descent = metrics.actualBoundingBoxDescent || fallbackHeight * 0.25;

  return {
    left: metrics.actualBoundingBoxLeft || 0,
    right: metrics.actualBoundingBoxRight || metrics.width,
    width,
    ascent,
    descent,
    height: ascent + descent
  };
}

function prepareLegendLabelForCanvas(label, context) {
  const text = label.textContent.trim();
  if (!text) return;

  const style = getComputedStyle(label);
  const lineHeight = getLineHeight(style);
  context.font = getCanvasFont(style);
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';

  const bounds = getTextBounds(context, text, lineHeight);
  label.style.display = 'inline-block';
  label.style.width = `${Math.ceil(bounds.width) + 1}px`;
  label.style.lineHeight = `${Math.ceil(Math.max(lineHeight, bounds.height, 16))}px`;
}

function prepareCanvasTextLayout(frame) {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return;

  frame.querySelectorAll('.legend-item .editable-label').forEach(label => {
    prepareLegendLabelForCanvas(label, context);
  });
}

function createImageExportFrame() {
  const container = document.querySelector('.container');
  const heading = container?.querySelector('h1');
  const legend = document.getElementById('legendContainer');
  const chartFrame = container?.querySelector('.chart-frame');
  if (!container || !heading || !legend || !chartFrame) return null;

  const frame = document.createElement('div');
  frame.className = 'image-export-frame';
  frame.style.width = `${EXPORT_PRESET.contentWidth}px`;
  frame.style.padding = `${EXPORT_PRESET.margin}px`;

  const content = document.createElement('div');
  content.className = 'image-export-content';
  content.style.width = `${EXPORT_PRESET.contentWidth}px`;

  const headingClone = heading.cloneNode(true);
  const legendClone = legend.cloneNode(true);
  const chartClone = chartFrame.cloneNode(true);
  legendClone.querySelectorAll('.btn-add-legend, .btn-delete-item').forEach(button => button.remove());
  legendClone.querySelectorAll('.legend-item.is-leaving').forEach(item => item.remove());
  legendClone.querySelectorAll('.legend-item').forEach(item => (
    item.classList.remove('is-entering', 'is-leaving')
  ));

  content.append(headingClone, legendClone, chartClone);
  frame.appendChild(content);
  document.body.appendChild(frame);
  prepareCanvasTextLayout(frame);

  const timestamp = chartClone.querySelector('.chart-timestamp:not([hidden])');
  if (timestamp) {
    const chartRect = chartClone.getBoundingClientRect();
    const timestampRect = timestamp.getBoundingClientRect();
    content.style.paddingBottom = `${Math.max(0, timestampRect.bottom - chartRect.bottom)}px`;
  }

  return frame;
}

function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function roundedRectPath(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.roundRect(x, y, width, height, safeRadius);
}

function getRelativeRect(element, frameRect) {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left - frameRect.left,
    y: rect.top - frameRect.top,
    width: rect.width,
    height: rect.height,
    right: rect.right - frameRect.left,
    bottom: rect.bottom - frameRect.top
  };
}

function snapToOutputPixel(value) {
  return Math.round(value * EXPORT_PRESET.pixelRatio) / EXPORT_PRESET.pixelRatio;
}

function drawElementText(context, element, frameRect) {
  if (!isRenderedElement(element)) return;
  const text = element.textContent.trim();
  if (!text) return;

  const rect = getRelativeRect(element, frameRect);
  const style = getComputedStyle(element);
  const lineHeight = getLineHeight(style);
  context.font = getCanvasFont(style);
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillStyle = style.color;

  const bounds = getTextBounds(context, text, lineHeight);
  const x = rect.x + rect.width / 2 + (bounds.left - bounds.right) / 2;
  const y = rect.y + rect.height / 2 + (bounds.ascent - bounds.descent) / 2;
  context.fillText(text, x, y);
}

function drawExportFrameToCanvas(exportFrame) {
  const frameRect = exportFrame.getBoundingClientRect();
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(frameRect.width * EXPORT_PRESET.pixelRatio);
  canvas.height = Math.ceil(frameRect.height * EXPORT_PRESET.pixelRatio);

  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas context is unavailable');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(EXPORT_PRESET.pixelRatio, EXPORT_PRESET.pixelRatio);

  const heading = exportFrame.querySelector('h1');
  if (heading) drawElementText(context, heading, frameRect);

  exportFrame.querySelectorAll('.legend-item').forEach(item => {
    const circle = item.querySelector('.circle-display');
    const label = item.querySelector('.editable-label');

    if (circle) {
      const circleRect = getRelativeRect(circle, frameRect);
      const circleStyle = getComputedStyle(circle);
      const centerX = snapToOutputPixel(circleRect.x + circleRect.width / 2);
      const centerY = snapToOutputPixel(circleRect.y + circleRect.height / 2);
      const radius = Math.max(
        0,
        (Math.min(circleRect.width, circleRect.height) - EXPORT_PRESET.legendBorderWidth) / 2
      );
      context.beginPath();
      context.arc(
        centerX,
        centerY,
        radius,
        0,
        Math.PI * 2
      );
      context.fillStyle = circleStyle.backgroundColor;
      context.fill();
      context.strokeStyle = EXPORT_PRESET.legendBorderColor;
      context.lineWidth = EXPORT_PRESET.legendBorderWidth;
      context.stroke();
    }

    if (label) drawElementText(context, label, frameRect);
  });

  const tableShell = exportFrame.querySelector('.table-shell');
  const table = exportFrame.querySelector('#rpsTable');
  if (tableShell && table) {
    const measuredShellRect = getRelativeRect(tableShell, frameRect);
    const shellStyle = getComputedStyle(tableShell);
    const radius = Number.parseFloat(shellStyle.borderTopLeftRadius) || 0;
    const halfGridLineWidth = EXPORT_PRESET.gridLineWidth / 2;
    const cells = [...table.querySelectorAll('th, td')].filter(isRenderedElement);
    const bodyRows = [...table.tBodies[0].rows].filter(isRenderedElement);
    const tableRows = [table.rows[0], ...bodyRows];
    const columnCount = [...table.rows[0].cells].filter(isRenderedElement).length;
    const rowCount = tableRows.length;
    const shellRect = {
      x: snapToOutputPixel(measuredShellRect.x),
      y: snapToOutputPixel(measuredShellRect.y),
      width: columnCount * EXPORT_PRESET.cellWidth,
      height: rowCount * EXPORT_PRESET.cellHeight
    };
    shellRect.right = shellRect.x + shellRect.width;
    shellRect.bottom = shellRect.y + shellRect.height;
    const tableLeft = shellRect.x;
    const tableTop = shellRect.y;

    context.save();
    roundedRectPath(context, shellRect.x, shellRect.y, shellRect.width, shellRect.height, radius);
    context.clip();

    tableRows.forEach((row, rowIndex) => {
      [...row.cells].filter(isRenderedElement).forEach((cell, columnIndex) => {
        context.fillStyle = getComputedStyle(cell).backgroundColor;
        context.fillRect(
          tableLeft + columnIndex * EXPORT_PRESET.cellWidth,
          tableTop + rowIndex * EXPORT_PRESET.cellHeight,
          EXPORT_PRESET.cellWidth,
          EXPORT_PRESET.cellHeight
        );
      });
    });

    if (columnCount > 1 || rowCount > 1) {
      context.strokeStyle = EXPORT_PRESET.gridColor;
      context.lineWidth = EXPORT_PRESET.gridLineWidth;
      context.lineCap = 'butt';
      context.lineJoin = 'miter';
      context.beginPath();
      for (let columnIndex = 1; columnIndex < columnCount; columnIndex += 1) {
        const edge = snapToOutputPixel(
          tableLeft + columnIndex * EXPORT_PRESET.cellWidth
        );
        const x = edge;
        context.moveTo(x, shellRect.y + halfGridLineWidth);
        context.lineTo(x, shellRect.bottom - halfGridLineWidth);
      }
      for (let rowIndex = 1; rowIndex < rowCount; rowIndex += 1) {
        const edge = snapToOutputPixel(
          tableTop + rowIndex * EXPORT_PRESET.cellHeight
        );
        const y = edge;
        context.moveTo(shellRect.x + halfGridLineWidth, y);
        context.lineTo(shellRect.right - halfGridLineWidth, y);
      }
      context.stroke();
    }

    cells.forEach(cell => drawElementText(context, cell, frameRect));
    context.restore();

    roundedRectPath(
      context,
      shellRect.x + halfGridLineWidth,
      shellRect.y + halfGridLineWidth,
      shellRect.width - EXPORT_PRESET.gridLineWidth,
      shellRect.height - EXPORT_PRESET.gridLineWidth,
      Math.max(0, radius - halfGridLineWidth)
    );
    context.strokeStyle = EXPORT_PRESET.gridColor;
    context.lineWidth = EXPORT_PRESET.gridLineWidth;
    context.lineJoin = 'round';
    context.stroke();
  }

  const timestamp = exportFrame.querySelector('.chart-timestamp:not([hidden])');
  if (timestamp) drawElementText(context, timestamp, frameRect);
  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('image blob creation failed'));
    }, 'image/png');
  });
}

async function saveChartImage() {
  const successFeedbackDuration = 1000;
  const saveButton = document.getElementById('saveImageButton');
  const buttonLabel = saveButton?.querySelector('span');
  const saveStatus = document.getElementById('imageSaveStatus');
  if (!saveButton || !buttonLabel || saveButton.disabled) return;

  saveButton.disabled = true;
  saveButton.setAttribute('aria-busy', 'true');
  buttonLabel.textContent = '이미지 만드는 중…';
  if (saveStatus) saveStatus.textContent = '이미지 파일을 만드는 중입니다.';
  let exportFrame = null;
  let didSave = false;

  try {
    await loadExportFonts();
    exportFrame = createImageExportFrame();
    if (!exportFrame) throw new Error('image export area is unavailable');

    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const blob = await canvasToBlob(drawExportFrameToCanvas(exportFrame));
    const downloadUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.download = `cortis-rps-chart-${getLocalDateString()}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    didSave = true;
  } catch (error) {
    console.error('Failed to save chart image:', error);
    if (saveStatus) saveStatus.textContent = '이미지 저장에 실패했습니다.';
    window.alert('이미지를 만드는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
  } finally {
    exportFrame?.remove();
    saveButton.removeAttribute('aria-busy');

    if (didSave) {
      saveButton.classList.add('is-success');
      buttonLabel.textContent = '저장 완료';
      if (saveStatus) saveStatus.textContent = '이미지 저장이 완료되었습니다.';
      await new Promise(resolve => setTimeout(resolve, successFeedbackDuration));
      saveButton.classList.remove('is-success');
    }

    saveButton.disabled = false;
    buttonLabel.textContent = '이미지 저장';
  }
}

export function initExportControls() {
  const timestampToggle = document.getElementById('timestampToggle');
  const chartTimestamp = document.getElementById('chartTimestamp');
  const saveButton = document.getElementById('saveImageButton');
  if (!timestampToggle || !chartTimestamp || !saveButton) return;

  const formattedDate = getLocalDateString();
  chartTimestamp.dateTime = formattedDate;
  chartTimestamp.textContent = formattedDate;

  const updateTimestampVisibility = () => {
    chartTimestamp.hidden = !timestampToggle.checked;
  };

  timestampToggle.addEventListener('change', updateTimestampVisibility);
  saveButton.addEventListener('click', saveChartImage);
  updateTimestampVisibility();
}
