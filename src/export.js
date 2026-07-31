const EXPORT_PRESET = {
  pixelRatio: 4,
  margin: 48,
  contentWidth: 443
};

const EXPORT_TEXT_SELECTOR = [
  '.container > h1',
  '#legendContainer .legend-item:not(.is-leaving) .editable-label',
  '#rpsTable th',
  '#rpsTable td',
  '#chartTimestamp:not([hidden])'
].join(', ');

function getCanvasFont(style) {
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

async function loadExportFonts() {
  const fontSet = document.fonts;
  if (!fontSet?.load) return;

  const textsByFont = new Map();
  document.querySelectorAll(EXPORT_TEXT_SELECTOR).forEach(element => {
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

function drawElementText(context, element, frameRect) {
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

  context.scale(EXPORT_PRESET.pixelRatio, EXPORT_PRESET.pixelRatio);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, frameRect.width, frameRect.height);

  const heading = exportFrame.querySelector('h1');
  if (heading) drawElementText(context, heading, frameRect);

  exportFrame.querySelectorAll('.legend-item').forEach(item => {
    const circle = item.querySelector('.circle-display');
    const label = item.querySelector('.editable-label');

    if (circle) {
      const circleRect = getRelativeRect(circle, frameRect);
      const circleStyle = getComputedStyle(circle);
      context.beginPath();
      context.arc(
        circleRect.x + circleRect.width / 2,
        circleRect.y + circleRect.height / 2,
        circleRect.width / 2,
        0,
        Math.PI * 2
      );
      context.fillStyle = circleStyle.backgroundColor;
      context.fill();
      context.strokeStyle = circleStyle.borderColor;
      context.lineWidth = Number.parseFloat(circleStyle.borderTopWidth) || 1;
      context.stroke();
    }

    if (label) drawElementText(context, label, frameRect);
  });

  const tableShell = exportFrame.querySelector('.table-shell');
  const table = exportFrame.querySelector('#rpsTable');
  if (tableShell && table) {
    const shellRect = getRelativeRect(tableShell, frameRect);
    const shellStyle = getComputedStyle(tableShell);
    const radius = Number.parseFloat(shellStyle.borderTopLeftRadius) || 0;
    const outerBorderWidth = Number.parseFloat(shellStyle.borderTopWidth) || 1;
    const cells = [...table.querySelectorAll('th, td')];

    context.save();
    roundedRectPath(context, shellRect.x, shellRect.y, shellRect.width, shellRect.height, radius);
    context.clip();

    cells.forEach(cell => {
      const rect = getRelativeRect(cell, frameRect);
      context.fillStyle = getComputedStyle(cell).backgroundColor;
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
    });

    const gridCell = cells.find(cell => Number.parseFloat(getComputedStyle(cell).borderLeftWidth) > 0);
    const gridStyle = gridCell ? getComputedStyle(gridCell) : shellStyle;
    context.strokeStyle = shellStyle.borderTopColor;
    context.lineWidth = Number.parseFloat(gridStyle.borderLeftWidth) || outerBorderWidth;
    context.beginPath();
    [...table.rows[0].cells].slice(1).forEach(cell => {
      const rect = getRelativeRect(cell, frameRect);
      context.moveTo(rect.x, shellRect.y);
      context.lineTo(rect.x, shellRect.bottom);
    });
    [...table.rows].slice(1).forEach(row => {
      const rect = getRelativeRect(row.cells[0], frameRect);
      context.moveTo(shellRect.x, rect.y);
      context.lineTo(shellRect.right, rect.y);
    });
    context.stroke();

    cells.forEach(cell => drawElementText(context, cell, frameRect));
    context.restore();

    roundedRectPath(
      context,
      shellRect.x + outerBorderWidth / 2,
      shellRect.y + outerBorderWidth / 2,
      shellRect.width - outerBorderWidth,
      shellRect.height - outerBorderWidth,
      Math.max(0, radius - outerBorderWidth / 2)
    );
    context.strokeStyle = shellStyle.borderTopColor;
    context.lineWidth = outerBorderWidth;
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
