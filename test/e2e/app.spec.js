import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

async function downloadChartPng(page) {
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#saveImageButton').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return { download, png: Buffer.concat(chunks) };
}

async function getPngPixelSummary(page, png) {
  return page.evaluate(async base64 => {
    const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonWhite = 0;
    let otpPink = 0;
    let darkLegendPixels = 0;

    for (let index = 0; index < data.length; index += 4) {
      const pixelIndex = index / 4;
      const y = Math.floor(pixelIndex / canvas.width);
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      if (red < 250 || green < 250 || blue < 250) nonWhite += 1;
      if (red >= 250 && green >= 205 && green <= 225 && blue >= 205 && blue <= 225) otpPink += 1;
      if (y >= 320 && y <= 520 && red < 90 && green < 90 && blue < 90) darkLegendPixels += 1;
    }

    return { nonWhite, otpPink, darkLegendPixels };
  }, png.toString('base64'));
}

test('renders the initial chart and controls', async ({ page }) => {
  await expect(page.locator('h1')).toHaveText('CORTIS RPS 취향표');
  await expect(page.locator('.legend-item')).toHaveCount(5);
  await expect(page.locator('#disp-1')).toBeVisible();
  await expect(page.locator('#label-1')).toHaveText('OTP');
  await expect(page.locator('.paintable').first()).toHaveText('젯틴');
  await expect(page.locator('#undoButton')).toBeDisabled();
  await expect(page.locator('#redoButton')).toBeDisabled();
});

test('adds a legend and supports undo and redo', async ({ page }) => {
  await page.locator('.btn-add-legend').click();
  const overlay = page.locator('#nameModalOverlay');
  await expect(overlay).toBeVisible();
  await page.locator('#nameInput').fill('테스트');
  await overlay.locator('.btn-save').click();
  await expect(page.locator('#label-6')).toHaveText('테스트');

  await page.locator('#undoButton').click();
  await expect(page.locator('#label-6')).toHaveCount(0);
  await page.locator('#redoButton').click();
  await expect(page.locator('#label-6')).toHaveText('테스트');
});

test('paints a cell and restores it through history', async ({ page }) => {
  const cell = page.locator('.paintable').first();
  await cell.click();
  await page.locator('#cellMenu .menu-option').first().click();
  await expect(cell).toHaveCSS('background-color', 'rgba(255, 173, 173, 0.5)');

  await page.locator('#undoButton').click();
  await expect(cell).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.locator('#redoButton').click();
  await expect(cell).toHaveCSS('background-color', 'rgba(255, 173, 173, 0.5)');
});

test('paints a full row from its name cell and restores it through history', async ({ page }) => {
  const nameCell = page.locator('.paintable-name[data-axis="row"][data-group-index="2"]');
  const rowCells = page.locator('#rpsTable tbody tr').nth(2).locator('.paintable');

  await nameCell.click();
  await page.locator('#cellMenu .menu-option').first().click();
  await expect(nameCell).toHaveCSS('background-color', 'rgb(99, 99, 102)');
  await expect(rowCells).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    await expect(rowCells.nth(index)).toHaveCSS('background-color', 'rgba(255, 173, 173, 0.5)');
  }

  await page.locator('#undoButton').click();
  await expect(nameCell).toHaveCSS('background-color', 'rgb(99, 99, 102)');
  for (let index = 0; index < 4; index += 1) {
    await expect(rowCells.nth(index)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  }
});

test('paints a full column from its name cell', async ({ page }) => {
  const nameCell = page.locator('.paintable-name[data-axis="column"][data-group-index="4"]');
  const columnCells = page.locator('#rpsTable tbody tr').locator('td:nth-child(6):not(.empty-cell)');

  await nameCell.click();
  await page.locator('#cellMenu .menu-option').nth(1).click();
  await expect(nameCell).toHaveCSS('background-color', 'rgb(99, 99, 102)');
  await expect(columnCells).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    await expect(columnCells.nth(index)).toHaveCSS('background-color', 'rgba(255, 214, 165, 0.5)');
  }
});

test('closes the name modal with Escape and restores focus', async ({ page }) => {
  const addButton = page.locator('.btn-add-legend');
  await addButton.click();
  const overlay = page.locator('#nameModalOverlay');
  const input = page.locator('#nameInput');
  await expect(input).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(overlay).toBeHidden();
  await expect(addButton).toBeFocused();
});

test('does not leave the legend delete button visible after mouse editing', async ({ page }, testInfo) => {
  const deleteButton = page.locator('#item-1 .btn-delete-item');
  await expect(deleteButton).toBeHidden();

  await page.locator('#label-1').click();
  const overlay = page.locator(testInfo.project.name === 'mobile' ? '#unifiedModalOverlay' : '#nameModalOverlay');
  await expect(overlay).toBeVisible();
  await overlay.locator('.btn-cancel').click();

  await expect(overlay).toBeHidden();
  await expect(deleteButton).toBeHidden();
});

test('opens the correct legend editor for the viewport', async ({ page }, testInfo) => {
  await page.locator('#label-1').click();
  if (testInfo.project.name === 'mobile') {
    await expect(page.locator('#unifiedModalOverlay')).toBeVisible();
  } else {
    await expect(page.locator('#nameModalOverlay')).toBeVisible();
  }
});

test('edits color through the shared picker and supports undo', async ({ page }, testInfo) => {
  const original = await page.evaluate(() => (
    getComputedStyle(document.documentElement).getPropertyValue('--color-1').trim()
  ));

  if (testInfo.project.name === 'mobile') {
    await page.locator('#label-1').click();
    await page.locator('#unifiedHueSlider').fill('120');
    await page.locator('#unifiedSaveBtn').click();
  } else {
    await page.locator('#disp-1').click();
    await page.locator('#hueSlider').fill('120');
    await page.locator('#visualPickerPopup .btn-done').click();
  }

  const changed = await page.evaluate(() => (
    getComputedStyle(document.documentElement).getPropertyValue('--color-1').trim()
  ));
  expect(changed).not.toBe(original);

  await page.locator('#undoButton').click();
  await expect.poll(() => page.evaluate(() => (
    getComputedStyle(document.documentElement).getPropertyValue('--color-1').trim()
  ))).toBe(original);
});

test('downloads a non-empty PNG containing the painted chart color', async ({ page }) => {
  const cell = page.locator('.paintable').first();
  await cell.click();
  await page.locator('#cellMenu .menu-option').first().click();

  const { download, png } = await downloadChartPng(page);

  expect(download.suggestedFilename()).toMatch(/^cortis-rps-chart-\d{4}-\d{2}-\d{2}\.png$/);
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(png.readUInt32BE(16)).toBe(2156);
  expect(png.readUInt32BE(20)).toBeGreaterThan(1000);

  const pixels = await getPngPixelSummary(page, png);

  expect(pixels.nonWhite).toBeGreaterThan(100_000);
  expect(pixels.otpPink).toBeGreaterThan(40_000);
});

test('exports complex unicode legend labels with metric-aware canvas text alignment', async ({ page }, testInfo) => {
  const complexLabel = '❤️🧑‍💻👍🏽 Á漢字∑';

  await page.locator('#label-1').click();
  if (testInfo.project.name === 'mobile') {
    await page.locator('#unifiedNameInput').fill(complexLabel);
    await page.locator('#unifiedSaveBtn').click();
  } else {
    await page.locator('#nameInput').fill(complexLabel);
    await page.locator('#nameModalOverlay .btn-save').click();
  }
  await expect(page.locator('#label-1')).toHaveText(complexLabel);

  await page.evaluate(() => {
    window.__canvasTextCalls = [];
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function patchedFillText(text, x, y, maxWidth) {
      window.__canvasTextCalls.push({
        text,
        x,
        y,
        maxWidth: Number.isFinite(maxWidth) ? maxWidth : null,
        textBaseline: this.textBaseline,
        font: this.font
      });
      return originalFillText.apply(this, arguments);
    };
  });

  const { png } = await downloadChartPng(page);
  const pixels = await getPngPixelSummary(page, png);
  const textCall = await page.evaluate(label => (
    window.__canvasTextCalls.find(call => call.text === label)
  ), complexLabel);

  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(pixels.nonWhite).toBeGreaterThan(100_000);
  expect(pixels.darkLegendPixels).toBeGreaterThan(50);
  expect(textCall).toBeTruthy();
  expect(textCall.textBaseline).toBe('alphabetic');
  expect(textCall.maxWidth).not.toBeNull();
});
