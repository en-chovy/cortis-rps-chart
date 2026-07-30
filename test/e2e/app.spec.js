import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('renders the initial chart and controls', async ({ page }) => {
  await expect(page.locator('h1')).toHaveText('CORTIS RPS 취향표');
  await expect(page.locator('.legend-item')).toHaveCount(5);
  await expect(page.locator('#disp-1')).toBeVisible();
  await expect(page.locator('#label-1')).toHaveText('OTP');
  await expect(page.locator('.paintable').first()).toHaveText('젯틴');
  await expect(page.locator('#undoButton')).toBeDisabled();
  await expect(page.locator('#redoButton')).toBeDisabled();
});

test('keeps the mobile viewport stable and supports single-tap interactions', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.evaluate(() => document.fonts.ready);
  const layout = await page.evaluate(() => {
    const root = document.scrollingElement;
    window.scrollTo(root.scrollWidth, root.scrollHeight);
    return {
      clientHeight: root.clientHeight,
      clientWidth: root.clientWidth,
      scrollHeight: root.scrollHeight,
      scrollWidth: root.scrollWidth,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      visualViewportHeight: window.visualViewport?.height ?? window.innerHeight
    };
  });
  expect(layout.scrollHeight).toBeLessThanOrEqual(layout.clientHeight + 1);
  expect(layout.scrollHeight).toBeLessThanOrEqual(layout.visualViewportHeight + 1);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  expect(layout.scrollX).toBe(0);
  expect(layout.scrollY).toBe(0);

  const cell = page.locator('.paintable').first();
  const legend = page.locator('#label-1');
  await expect(cell).toHaveCSS('touch-action', 'manipulation');
  await expect(legend).toHaveCSS('touch-action', 'manipulation');
  await expect(page.locator('.btn-add-legend')).toHaveCSS('touch-action', 'manipulation');
  await expect(page.locator('#unifiedSbArea')).toHaveCSS('touch-action', 'none');

  await cell.tap();
  await expect(page.locator('#cellMenu')).toBeVisible();
  await page.locator('#cellMenu .menu-option').first().tap();
  await expect(cell).toHaveCSS('background-color', 'rgba(255, 173, 173, 0.5)');

  await page.locator('#undoButton').tap();
  await expect(cell).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

  await legend.tap();
  await expect(page.locator('#unifiedModalOverlay')).toBeVisible();
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

test('limits legend names with inline feedback in every editor', async ({ page }, testInfo) => {
  const allowedName = '가'.repeat(15);
  let input;
  let error;
  let modal;

  if (testInfo.project.name === 'mobile') {
    await page.locator('#label-1').tap();
    input = page.locator('#unifiedNameInput');
    error = page.locator('#unifiedNameInputError');
    modal = page.locator('#unifiedModalOverlay .modal');
  } else {
    await page.locator('.btn-add-legend').click();
    input = page.locator('#nameInput');
    error = page.locator('#nameInputError');
    modal = page.locator('#nameModalOverlay .modal');
  }

  await expect(error).toBeHidden();
  await input.fill(allowedName);
  const heightBeforeFeedback = await modal.evaluate(element => element.offsetHeight);
  await input.fill(`${allowedName}나`);
  await expect(input).toHaveValue(allowedName);
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(input).toHaveClass(/has-error/);
  await expect(error).toBeVisible();
  await expect(error).toHaveText('범례 이름은 15자까지 입력할 수 있어요.');
  const heightDuringFeedback = await modal.evaluate(element => element.offsetHeight);
  expect(heightDuringFeedback).toBe(heightBeforeFeedback);

  await page.waitForTimeout(900);
  await input.fill(`${allowedName}다`);
  await page.waitForTimeout(900);
  await expect(error).toBeVisible();
  await expect(input).toHaveClass(/has-error/);

  await expect(error).toBeHidden({ timeout: 2500 });
  await expect(input).not.toHaveAttribute('aria-invalid', 'true');
  await expect(input).not.toHaveClass(/has-error/);
  const heightAfterFeedback = await modal.evaluate(element => element.offsetHeight);
  expect(heightAfterFeedback).toBe(heightBeforeFeedback);

  if (testInfo.project.name === 'mobile') {
    await page.locator('#unifiedSaveBtn').tap();
    await expect(page.locator('#label-1')).toHaveText(allowedName);
  } else {
    await page.locator('#nameModalOverlay .btn-save').click();
    await expect(page.locator('#label-6')).toHaveText(allowedName);
  }
});

test('waits for Korean IME composition before limiting a legend name', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  const allowedName = '가'.repeat(15);
  await page.locator('.btn-add-legend').click();
  const input = page.locator('#nameInput');
  const error = page.locator('#nameInputError');

  await input.evaluate((element, longName) => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    element.value = longName;
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: longName,
      inputType: 'insertCompositionText',
      isComposing: true
    }));
  }, `${allowedName}나`);
  await expect(input).toHaveValue(`${allowedName}나`);
  await expect(error).toBeHidden();

  await input.evaluate(element => {
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
  });
  await expect(input).toHaveValue(allowedName);
  await expect(error).toBeVisible();
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

test('restores editable content after reload and resets it explicitly', async ({ page }) => {
  await page.locator('.btn-add-legend').click();
  await page.locator('#nameInput').fill('새 범례');
  await page.locator('#nameModalOverlay .btn-save').click();

  const cell = page.locator('.paintable').first();
  await cell.click();
  await page.locator('#cellMenu .menu-option').nth(5).click();
  await expect(cell).toHaveCSS('background-color', 'rgba(204, 204, 204, 0.5)');

  await page.reload();
  await expect(page.locator('#label-6')).toHaveText('새 범례');
  await expect(page.locator('.paintable').first()).toHaveCSS('background-color', 'rgba(204, 204, 204, 0.5)');
  await expect(page.locator('#undoButton')).toBeDisabled();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#saveImageButton').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^cortis-rps-chart-\d{4}-\d{2}-\d{2}\.png$/);

  await page.locator('#resetButton').click();
  await expect(page.locator('#resetModalOverlay')).toBeVisible();
  await expect(page.locator('#cancelResetBtn')).toBeFocused();
  await page.locator('#confirmResetBtn').click();
  await expect(page.locator('.legend-item')).toHaveCount(5);
  await expect(page.locator('#label-6')).toHaveCount(0);
  await expect(page.locator('.paintable').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('#undoButton')).toBeDisabled();
  await expect(page.locator('#redoButton')).toBeDisabled();

  await page.reload();
  await expect(page.locator('.legend-item')).toHaveCount(5);
  await expect(page.locator('.paintable').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('#undoButton')).toBeDisabled();
});

test('migrates an older long legend name without discarding the chart', async ({ page }) => {
  const firstCell = page.locator('.paintable').first();
  await firstCell.click();
  await page.locator('#cellMenu .menu-option').first().click();

  await page.evaluate(longName => {
    const storageKey = 'cortis-rps-chart:editable-state';
    const payload = JSON.parse(sessionStorage.getItem(storageKey));
    payload.editableState.legends[0].name = longName;
    sessionStorage.setItem(storageKey, JSON.stringify(payload));
  }, '가'.repeat(16));
  await page.reload();

  await expect(page.locator('#label-1')).toHaveText('가'.repeat(15));
  await expect(firstCell).toHaveCSS('background-color', 'rgba(255, 173, 173, 0.5)');
});

test('does not carry editable content into a new tab session', async ({ page, context }) => {
  const cell = page.locator('.paintable').first();
  await cell.click();
  await page.locator('#cellMenu .menu-option').first().click();
  await expect(cell).toHaveCSS('background-color', 'rgba(255, 173, 173, 0.5)');

  await page.close();
  const freshPage = await context.newPage();
  await freshPage.goto('/');
  await expect(freshPage.locator('.paintable').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

test('clears deleted-legend cells and restores the full state through history', async ({ page }, testInfo) => {
  const firstCell = page.locator('.paintable').nth(0);
  const secondCell = page.locator('.paintable').nth(1);

  await firstCell.click();
  await page.locator('#cellMenu .menu-option').nth(0).click();
  await secondCell.click();
  await page.locator('#cellMenu .menu-option').nth(1).click();

  if (testInfo.project.name === 'mobile') {
    await page.locator('#label-1').click();
    await page.locator('#unifiedDeleteBtn').click();
  } else {
    await page.locator('#item-1').hover();
    await page.locator('#item-1 .btn-delete-item').click();
    await page.locator('#confirmDelBtn').click();
  }

  await expect(page.locator('#item-1')).toHaveCount(0);
  await expect(firstCell).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(secondCell).toHaveCSS('background-color', 'rgba(255, 214, 165, 0.5)');

  await page.locator('#undoButton').click();
  await expect(page.locator('#item-1')).toHaveCount(1);
  await expect(firstCell).toHaveCSS('background-color', 'rgba(255, 173, 173, 0.5)');
  await expect(secondCell).toHaveCSS('background-color', 'rgba(255, 214, 165, 0.5)');

  await page.locator('#redoButton').click();
  await expect(page.locator('#item-1')).toHaveCount(0);
  await expect(firstCell).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(secondCell).toHaveCSS('background-color', 'rgba(255, 214, 165, 0.5)');
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

test('shows the pending color and larger slider targets on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const original = await page.evaluate(() => (
    getComputedStyle(document.documentElement).getPropertyValue('--color-1').trim()
  ));
  await page.locator('#label-1').tap();

  const hueSlider = page.locator('#unifiedHueSlider');
  const alphaSlider = page.locator('#unifiedAlphaSlider');
  const preview = page.locator('#unifiedColorPreview');
  await expect(hueSlider).toHaveCSS('height', '44px');
  await expect(alphaSlider).toHaveCSS('height', '44px');
  await expect(alphaSlider).toHaveAttribute('aria-label', '불투명도');
  await expect(alphaSlider).toHaveAttribute('aria-valuetext', '50%');
  await expect(preview.locator('.selected-color-value')).toHaveText('#FFADAD · 50%');
  await expect(preview.locator('.selected-color-swatch')).toHaveCSS('background-color', 'rgba(255, 173, 173, 0.5)');

  await hueSlider.fill('120');
  await alphaSlider.fill('0.75');
  await expect(alphaSlider).toHaveAttribute('aria-valuetext', '75%');
  await expect(preview.locator('.selected-color-value')).toHaveText('#ADFFAD · 75%');
  await expect(preview.locator('.selected-color-swatch')).toHaveCSS('background-color', 'rgba(173, 255, 173, 0.75)');

  await page.locator('#unifiedCancelBtn').tap();
  await expect.poll(() => page.evaluate(() => (
    getComputedStyle(document.documentElement).getPropertyValue('--color-1').trim()
  ))).toBe(original);
});

test('downloads a non-empty PNG containing the painted chart color', async ({ page }) => {
  const cell = page.locator('.paintable').first();
  await cell.click();
  await page.locator('#cellMenu .menu-option').first().click();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#saveImageButton').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const png = Buffer.concat(chunks);

  expect(download.suggestedFilename()).toMatch(/^cortis-rps-chart-\d{4}-\d{2}-\d{2}\.png$/);
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(png.readUInt32BE(16)).toBe(2156);
  expect(png.readUInt32BE(20)).toBeGreaterThan(1000);

  const pixels = await page.evaluate(async base64 => {
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

    for (let index = 0; index < data.length; index += 4) {
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      if (red < 250 || green < 250 || blue < 250) nonWhite += 1;
      if (red >= 250 && green >= 205 && green <= 225 && blue >= 205 && blue <= 225) otpPink += 1;
    }

    return { nonWhite, otpPink };
  }, png.toString('base64'));

  expect(pixels.nonWhite).toBeGreaterThan(100_000);
  expect(pixels.otpPink).toBeGreaterThan(40_000);
});

test('downloads a PNG when a legend name contains emoji', async ({ page }) => {
  await page.locator('.btn-add-legend').click();
  await page.locator('#nameInput').fill('테스트 💙');
  await page.locator('#nameModalOverlay .btn-save').click();
  await expect(page.locator('#label-6')).toHaveText('테스트 💙');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#saveImageButton').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const png = Buffer.concat(chunks);

  expect(download.suggestedFilename()).toMatch(/^cortis-rps-chart-\d{4}-\d{2}-\d{2}\.png$/);
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(png.readUInt32BE(16)).toBe(2156);
  expect(png.readUInt32BE(20)).toBeGreaterThan(1000);
});
