import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

async function deleteRenderedNameGroup(page, axis, groupIndex) {
  await page.locator(
    `.paintable-name[data-axis="${axis}"][data-group-index="${groupIndex}"]`
  ).click();
  await page.locator('#cellMenu .menu-delete-group').click();
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

test('keeps pointer-only targets outside app-managed keyboard behavior', async ({ page }) => {
  const firstDeleteButton = page.locator('#item-1 .btn-delete-item');
  await expect(firstDeleteButton).toHaveAttribute('type', 'button');
  await expect(firstDeleteButton).toHaveCSS('opacity', '0');
  await expect(firstDeleteButton).toHaveCSS('visibility', 'hidden');

  await page.locator('.paintable').first().click();
  const options = page.locator('#cellMenu .menu-option');
  await expect(options).toHaveCount(5);

  const semantics = await options.evaluateAll(elements => elements.map(element => ({
    tagName: element.tagName,
    tabIndex: element.tabIndex
  })));
  expect(semantics).toEqual(Array.from({ length: 5 }, () => ({
    tagName: 'DIV',
    tabIndex: -1
  })));

  await expect(page.locator('.btn-add-legend')).toHaveAttribute('type', 'button');
  await expect(page.locator('#resetButton')).toHaveAttribute('type', 'button');
  await expect(page.locator('.circle-display').first()).not.toHaveAttribute('tabindex', /.+/);
  await expect(page.locator('.editable-label').first()).not.toHaveAttribute('tabindex', /.+/);

  await page.locator('#label-1').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.circle-display').first()).not.toHaveAttribute('tabindex', /.+/);
  await expect(page.locator('.editable-label').first()).not.toHaveAttribute('tabindex', /.+/);
});

test('uses brief layer transitions and respects reduced motion', async ({ page }) => {
  const addButton = page.locator('.btn-add-legend');
  const overlay = page.locator('#nameModalOverlay');
  const panel = overlay.locator('.modal');

  await addButton.click();
  await expect(overlay).toHaveClass(/is-open/);
  const normalDurations = await panel.evaluate(element => (
    getComputedStyle(element).transitionDuration
      .split(',')
      .map(value => Number.parseFloat(value))
  ));
  expect(Math.max(...normalDurations)).toBeLessThanOrEqual(0.2);
  await overlay.locator('.btn-cancel').evaluate(button => button.click());
  await expect(overlay).toHaveClass(/is-closing/);
  await expect(overlay).toBeVisible();
  await expect(overlay).toBeHidden();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await addButton.click();
  await expect(overlay).toBeVisible();
  const reducedDurations = await panel.evaluate(element => (
    getComputedStyle(element).transitionDuration
      .split(',')
      .map(value => Number.parseFloat(value))
  ));
  expect(Math.max(...reducedDurations)).toBeLessThanOrEqual(0.001);
  await overlay.locator('.btn-cancel').click();
  await expect(overlay).toBeHidden();
});

test('animates pointer popups out before hiding them', async ({ page }, testInfo) => {
  const cellMenu = page.locator('#cellMenu');
  await page.locator('.paintable').first().click();
  await expect(cellMenu).toHaveClass(/is-open/);
  await cellMenu.locator('.menu-option').first().evaluate(option => option.click());
  await expect(cellMenu).toHaveClass(/is-closing/);
  await expect(cellMenu).toBeVisible();
  await expect(cellMenu).toBeHidden();

  test.skip(testInfo.project.name !== 'desktop');
  const visualPicker = page.locator('#visualPickerPopup');
  await page.locator('#disp-1').click();
  await expect(visualPicker).toHaveClass(/is-open/);
  await visualPicker.locator('.btn-done').evaluate(button => button.click());
  await expect(visualPicker).toHaveClass(/is-closing/);
  await expect(visualPicker).toBeVisible();
  await expect(visualPicker).toBeHidden();
});

test('keeps a newly opened modal active while an earlier popup exits', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.locator('#disp-1').click();
  await expect(page.locator('#visualPickerPopup')).toBeVisible();
  await page.locator('#resetButton').click();
  await expect(page.locator('#resetModalOverlay')).toBeVisible();
  await page.waitForTimeout(220);
  await expect(page.locator('#visualPickerPopup')).toBeHidden();
  await expect(page.locator('#resetModalOverlay')).toBeVisible();
});

test('uses the unified editor on a wide touch-only viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await page.setViewportSize({ width: 768, height: 900 });

  await page.locator('#label-1').tap();
  const unifiedModal = page.locator('#unifiedModalOverlay .unified-modal');
  await expect(unifiedModal).toBeVisible();
  await expect(page.locator('#nameModalOverlay')).toBeHidden();
  await expect(page.locator('#unifiedDeleteBtn')).toHaveCSS('height', '44px');
  await expect(page.locator('.unified-action-buttons')).toHaveCSS('display', 'flex');
});

test('keeps plain modals at least 16 pixels from narrow viewport edges', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const expectModalGutters = async overlaySelector => {
    const metrics = await page.locator(`${overlaySelector} .modal`).evaluate(modal => {
      const overlay = modal.parentElement;
      return {
        left: modal.offsetLeft,
        right: overlay.clientWidth - modal.offsetLeft - modal.offsetWidth
      };
    });

    expect(metrics.left).toBeGreaterThanOrEqual(16);
    expect(metrics.right).toBeGreaterThanOrEqual(16);
    expect(Math.abs(metrics.left - metrics.right)).toBeLessThanOrEqual(1);
  };

  for (const width of [320, 280]) {
    await page.setViewportSize({ width, height: 629 });

    await page.locator('.btn-add-legend').tap();
    await expect(page.locator('#nameModalOverlay')).toBeVisible();
    await expectModalGutters('#nameModalOverlay');
    await page.locator('#nameModalOverlay .btn-cancel').tap();

    await page.locator('#resetButton').tap();
    await expect(page.locator('#resetModalOverlay')).toBeVisible();
    await expectModalGutters('#resetModalOverlay');
    await page.locator('#cancelResetBtn').tap();
  }
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

test('supports only the declared undo and redo shortcuts', async ({ page }) => {
  const cell = page.locator('.paintable').first();
  await cell.click();
  await page.locator('#cellMenu .menu-option').first().click();
  await expect(cell).toHaveCSS('background-color', 'rgba(255, 173, 173, 0.5)');

  await page.keyboard.press('Control+Y');
  await page.keyboard.press('Control+Alt+Z');
  await expect(cell).toHaveCSS('background-color', 'rgba(255, 173, 173, 0.5)');

  await page.keyboard.press('Meta+Z');
  await expect(cell).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.keyboard.press('Meta+Shift+Z');
  await expect(cell).toHaveCSS('background-color', 'rgba(255, 173, 173, 0.5)');

  await page.keyboard.press('Control+Z');
  await expect(cell).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.keyboard.press('Control+Y');
  await page.keyboard.press('Control+Alt+Shift+Z');
  await expect(cell).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.keyboard.press('Control+Shift+Z');
  await expect(cell).toHaveCSS('background-color', 'rgba(255, 173, 173, 0.5)');
});

test('uses plain Enter to complete legend add and edit', async ({ page }, testInfo) => {
  await page.locator('.btn-add-legend').click();
  await page.locator('#nameInput').fill('키보드 추가');
  await page.keyboard.press('Shift+Enter');
  await expect(page.locator('#nameModalOverlay')).toBeVisible();
  await expect(page.locator('#label-6')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(page.locator('#label-6')).toHaveText('키보드 추가');

  await page.locator('#label-1').click();
  const overlay = page.locator(
    testInfo.project.name === 'mobile' ? '#unifiedModalOverlay' : '#nameModalOverlay'
  );
  const input = page.locator(
    testInfo.project.name === 'mobile' ? '#unifiedNameInput' : '#nameInput'
  );
  await input.fill('키보드 수정');
  await page.keyboard.press('Alt+Enter');
  await expect(overlay).toBeVisible();
  await expect(page.locator('#label-1')).toHaveText('OTP');
  await page.keyboard.press('Enter');
  await expect(page.locator('#label-1')).toHaveText('키보드 수정');
});

test('leaves Enter on focused modal buttons to the browser', async ({ page }, testInfo) => {
  await page.locator('.btn-add-legend').click();
  await page.locator('#nameInput').fill('저장되면 안 됨');
  await page.locator('#nameModalOverlay .btn-cancel').press('Enter');
  await expect(page.locator('#nameModalOverlay')).toBeHidden();
  await expect(page.locator('#label-6')).toHaveCount(0);

  if (testInfo.project.name === 'mobile') {
    await page.locator('#label-1').click();
    await page.locator('#unifiedNameInput').fill('저장되면 안 됨');
    await page.locator('#unifiedCancelBtn').press('Enter');
    await expect(page.locator('#unifiedModalOverlay')).toBeHidden();
    await expect(page.locator('#label-1')).toHaveText('OTP');
  }
});

test('does not globally confirm destructive modals with Enter', async ({ page }, testInfo) => {
  await page.locator('#resetButton').click();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.keyboard.press('Enter');
  await expect(page.locator('#resetModalOverlay')).toBeVisible();
  await expect(page.locator('.legend-item')).toHaveCount(5);
  await page.keyboard.press('Escape');
  await expect(page.locator('#resetModalOverlay')).toBeHidden();

  if (testInfo.project.name === 'desktop') {
    await page.locator('#item-1').hover();
    await page.locator('#item-1 .btn-delete-item').click();
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    await page.keyboard.press('Enter');
    await expect(page.locator('#deleteModalOverlay')).toBeVisible();
    await expect(page.locator('#item-1')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('#deleteModalOverlay')).toBeHidden();
  }
});

test('closes the cell palette with Escape', async ({ page }) => {
  await page.locator('.paintable').first().click();
  await expect(page.locator('#cellMenu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#cellMenu')).toBeHidden();
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

test('preserves existing legend elements during non-structural updates', async ({ page }) => {
  const firstLegend = page.locator('#item-1');
  await firstLegend.evaluate(element => {
    element.dataset.renderIdentity = 'preserved';
  });

  const cell = page.locator('.paintable').first();
  await cell.click();
  await page.locator('#cellMenu .menu-option').first().click();

  await expect(firstLegend).toHaveAttribute('data-render-identity', 'preserved');
  await expect(cell).toHaveCSS('background-color', 'rgba(255, 173, 173, 0.5)');
});

test('preserves keyed legends through add, rename, and rapid delete undo', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  const firstLegend = page.locator('#item-1');
  const secondLegend = page.locator('#item-2');
  await firstLegend.evaluate(element => {
    element.dataset.renderIdentity = 'first';
  });
  await secondLegend.evaluate(element => {
    element.dataset.renderIdentity = 'second';
  });

  await page.locator('.btn-add-legend').click();
  await page.locator('#nameInput').fill('추가');
  await page.locator('#nameModalOverlay .btn-save').click();
  await expect(firstLegend).toHaveAttribute('data-render-identity', 'first');
  await expect(secondLegend).toHaveAttribute('data-render-identity', 'second');

  await page.locator('#label-1').click();
  await page.locator('#nameInput').fill('수정');
  await page.locator('#nameModalOverlay .btn-save').click();
  await expect(firstLegend).toHaveAttribute('data-render-identity', 'first');
  await expect(page.locator('#label-1')).toHaveText('수정');

  await firstLegend.hover();
  await firstLegend.locator('.btn-delete-item').click();
  await page.locator('#confirmDelBtn').evaluate(button => button.click());
  await expect(firstLegend).toHaveClass(/is-leaving/);
  await page.locator('#undoButton').evaluate(button => button.click());
  await page.waitForTimeout(220);

  await expect(firstLegend).toHaveCount(1);
  await expect(firstLegend).not.toHaveClass(/is-leaving/);
  await expect(firstLegend).toHaveAttribute('data-render-identity', 'first');
  await expect(secondLegend).toHaveAttribute('data-render-identity', 'second');
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
  await expect(page.locator('#undoButton')).toBeEnabled();
  await expect(page.locator('#redoButton')).toBeDisabled();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#saveImageButton').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^cortis-rps-chart-\d{4}-\d{2}-\d{2}\.png$/);

  await page.locator('#resetButton').click();
  await expect(page.locator('#resetModalOverlay')).toBeVisible();
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

test('keeps both sides of a middle history cursor through reload', async ({ page }) => {
  const cell = page.locator('.paintable[data-cell-index="18"]');
  const menu = page.locator('#cellMenu');

  await cell.click();
  await menu.locator('.menu-option').first().click();
  await cell.click();
  await menu.locator('.menu-ghost-toggle').click();
  await expect(cell).toHaveClass(/is-ghost/);

  await page.locator('#undoButton').click();
  await expect(cell).not.toHaveClass(/is-ghost/);
  await expect(cell).toHaveCSS('background-color', 'rgba(255, 173, 173, 0.5)');
  await expect(page.locator('#undoButton')).toBeEnabled();
  await expect(page.locator('#redoButton')).toBeEnabled();

  await page.reload();
  await expect(cell).not.toHaveClass(/is-ghost/);
  await expect(cell).toHaveCSS('background-color', 'rgba(255, 173, 173, 0.5)');
  await expect(page.locator('#undoButton')).toBeEnabled();
  await expect(page.locator('#redoButton')).toBeEnabled();

  await page.locator('#redoButton').click();
  await expect(cell).toHaveClass(/is-ghost/);
  await expect(page.locator('#redoButton')).toBeDisabled();
  await page.locator('#undoButton').click();
  await expect(cell).not.toHaveClass(/is-ghost/);
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

test('shows a contextual ghost action for cells and an axis delete action for names', async ({ page }) => {
  const menu = page.locator('#cellMenu');
  const ghostCell = page.locator('.paintable[data-cell-index="18"]');

  await ghostCell.click();
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute('role', 'group');
  await expect(menu).toHaveAttribute('aria-label', '쮸건 셀 설정');
  await expect(menu.locator('.menu-ghost-toggle')).toHaveCount(1);
  await expect(menu.locator('.menu-delete-group')).toHaveCount(0);
  await expect(menu.locator('.menu-divider')).toHaveCount(1);

  const ghostToggle = menu.locator('.menu-ghost-toggle');
  await expect(ghostToggle).toHaveAttribute('type', 'button');
  await expect(ghostToggle).toHaveAttribute('aria-label', '쮸건 고스트 셀');
  await expect(ghostToggle).toHaveAttribute('aria-pressed', 'false');
  await expect(ghostToggle).toHaveAttribute('title', '글자 숨기기');
  await expect(ghostToggle.locator('svg')).toHaveAttribute('aria-hidden', 'true');
  await expect(ghostToggle.locator('.visibility-slash')).toHaveCount(0);

  await page.keyboard.press('Escape');
  const rowName = page.locator('.paintable-name[data-axis="row"][data-group-index="2"]');
  await rowName.click();
  await expect(menu).toHaveAttribute('aria-label', '주훈 행 설정');
  await expect(menu.locator('.menu-ghost-toggle')).toHaveCount(0);
  await expect(menu.locator('.menu-delete-group')).toHaveCount(1);
  await expect(menu.locator('.menu-delete-group')).toHaveText('삭제');
  await expect(menu.locator('.menu-delete-group')).toHaveAttribute('aria-label', '주훈 행 삭제');

  await page.keyboard.press('Escape');
  const columnName = page.locator('.paintable-name[data-axis="column"][data-group-index="4"]');
  await columnName.click();
  await expect(menu).toHaveAttribute('aria-label', '건호 열 설정');
  await expect(menu.locator('.menu-ghost-toggle')).toHaveCount(0);
  await expect(menu.locator('.menu-delete-group')).toHaveText('삭제');
  await expect(menu.locator('.menu-delete-group')).toHaveAttribute('aria-label', '건호 열 삭제');
});

test('keeps a ghost cell independent from paint through history, reload, and reset', async ({ page }) => {
  const cell = page.locator('.paintable[data-cell-index="18"]');
  const menu = page.locator('#cellMenu');

  await expect(cell).toHaveText('쮸건');
  await cell.click();
  await menu.locator('.menu-option').first().click();
  await expect(cell).toHaveCSS('background-color', 'rgba(255, 173, 173, 0.5)');

  await cell.click();
  await menu.locator('.menu-ghost-toggle').click();
  await expect(cell).toHaveText('쮸건');
  await expect(cell).toHaveClass(/is-ghost/);
  await expect(cell).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(cell).toHaveCSS('background-color', 'rgba(255, 173, 173, 0.5)');

  await page.locator('#undoButton').click();
  await expect(cell).not.toHaveClass(/is-ghost/);
  await expect(cell).not.toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(cell).toHaveCSS('background-color', 'rgba(255, 173, 173, 0.5)');

  await page.locator('#redoButton').click();
  await expect(cell).toHaveClass(/is-ghost/);
  await expect(cell).toHaveCSS('color', 'rgb(255, 255, 255)');

  await page.reload();
  await expect(cell).toHaveText('쮸건');
  await expect(cell).toHaveClass(/is-ghost/);
  await expect(cell).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(cell).toHaveCSS('background-color', 'rgba(255, 173, 173, 0.5)');
  await expect(page.locator('#undoButton')).toBeEnabled();
  await expect(page.locator('#redoButton')).toBeDisabled();

  await cell.click();
  const activeGhostToggle = menu.locator('.menu-ghost-toggle');
  await expect(activeGhostToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(activeGhostToggle).toHaveAttribute('title', '글자 보이기');
  await expect(activeGhostToggle.locator('.visibility-slash')).toHaveCount(1);
  await page.keyboard.press('Escape');

  await page.locator('#resetButton').click();
  await page.locator('#confirmResetBtn').click();
  await expect(cell).not.toHaveClass(/is-ghost/);
  await expect(cell).not.toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(cell).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('#undoButton')).toBeDisabled();
  await expect(page.locator('#redoButton')).toBeDisabled();

  await page.reload();
  await expect(cell).not.toHaveClass(/is-ghost/);
  await expect(cell).not.toHaveCSS('color', 'rgb(255, 255, 255)');
});

test('deletes rows and columns with stable sizing through history and reload', async ({ page }) => {
  const chartFrame = page.locator('.chart-frame');
  const table = page.locator('#rpsTable');
  const row = table.locator('tbody tr').nth(2);
  const rowName = page.locator('.paintable-name[data-axis="row"][data-group-index="2"]');
  const columnName = page.locator('.paintable-name[data-axis="column"][data-group-index="4"]');
  const deletedColumnCells = table.locator('tbody [data-column-index="4"]');
  const initialGeometry = await page.evaluate(() => {
    const frame = document.querySelector('.chart-frame');
    const headerCell = document.querySelector('#rpsTable thead th');
    const exportPanel = document.querySelector('.export-panel');
    const historyControls = document.querySelector('.history-controls');
    return {
      frameWidth: frame.getBoundingClientRect().width,
      frameHeight: frame.getBoundingClientRect().height,
      cellWidth: headerCell.getBoundingClientRect().width,
      exportPanelTop: exportPanel.getBoundingClientRect().top,
      historyControlsTop: historyControls.getBoundingClientRect().top
    };
  });

  await rowName.click();
  await page.locator('#cellMenu .menu-delete-group').click();
  await expect(row).toBeHidden();
  await expect(rowName).toBeHidden();
  await expect(columnName).toBeVisible();
  await expect(table).toHaveAttribute('aria-rowcount', '5');
  expect(await chartFrame.evaluate(element => element.getBoundingClientRect().width))
    .toBeCloseTo(initialGeometry.frameWidth, 1);
  const deletedRowGeometry = await page.evaluate(() => ({
    frameHeight: document.querySelector('.chart-frame').getBoundingClientRect().height,
    exportPanelTop: document.querySelector('.export-panel').getBoundingClientRect().top,
    historyControlsTop: document.querySelector('.history-controls').getBoundingClientRect().top
  }));
  expect(deletedRowGeometry.frameHeight).toBeCloseTo(initialGeometry.frameHeight, 1);
  expect(deletedRowGeometry.exportPanelTop).toBeCloseTo(initialGeometry.exportPanelTop, 1);
  expect(deletedRowGeometry.historyControlsTop).toBeCloseTo(initialGeometry.historyControlsTop, 1);

  await page.locator('#undoButton').click();
  await expect(row).toBeVisible();
  await expect(table).toHaveAttribute('aria-rowcount', '6');
  await page.locator('#redoButton').click();
  await expect(row).toBeHidden();

  await columnName.click();
  await page.locator('#cellMenu .menu-delete-group').click();
  await expect(columnName).toBeHidden();
  await expect(deletedColumnCells).toHaveCount(0);
  await expect(table).toHaveAttribute('aria-colcount', '5');
  const deletedColumnWidth = await chartFrame.evaluate(element => element.getBoundingClientRect().width);
  expect(deletedColumnWidth).toBeCloseTo(
    initialGeometry.frameWidth - initialGeometry.cellWidth,
    1
  );

  await page.locator('#undoButton').click();
  await expect(columnName).toBeVisible();
  await expect(deletedColumnCells).toHaveCount(5);
  await expect(row).toBeHidden();
  await expect(table).toHaveAttribute('aria-colcount', '6');
  expect(await chartFrame.evaluate(element => element.getBoundingClientRect().width))
    .toBeCloseTo(initialGeometry.frameWidth, 1);

  await page.locator('#redoButton').click();
  await expect(columnName).toBeHidden();
  await expect(row).toBeHidden();

  await page.reload();
  await expect(row).toBeHidden();
  await expect(columnName).toBeHidden();
  await expect(table).toHaveAttribute('aria-rowcount', '5');
  await expect(table).toHaveAttribute('aria-colcount', '5');
  expect(await chartFrame.evaluate(element => element.getBoundingClientRect().width))
    .toBeCloseTo(deletedColumnWidth, 1);
  const reloadedGeometry = await page.evaluate(() => ({
    frameHeight: document.querySelector('.chart-frame').getBoundingClientRect().height,
    exportPanelTop: document.querySelector('.export-panel').getBoundingClientRect().top,
    historyControlsTop: document.querySelector('.history-controls').getBoundingClientRect().top
  }));
  expect(reloadedGeometry.frameHeight).toBeCloseTo(initialGeometry.frameHeight, 1);
  expect(reloadedGeometry.exportPanelTop).toBeCloseTo(initialGeometry.exportPanelTop, 1);
  expect(reloadedGeometry.historyControlsTop).toBeCloseTo(initialGeometry.historyControlsTop, 1);
  await expect(page.locator('#undoButton')).toBeEnabled();
  await expect(page.locator('#redoButton')).toBeDisabled();
});

test('restores one deleted group with content, history, badge, and reload intact', async ({ page }) => {
  const table = page.locator('#rpsTable');
  const rowName = page.locator('.paintable-name[data-axis="row"][data-group-index="2"]');
  const columnName = page.locator('.paintable-name[data-axis="column"][data-group-index="4"]');
  const cell = page.locator('.paintable[data-cell-index="8"]');
  const restoreButton = page.locator('#restoreDeletedButton');
  const restoreCount = page.locator('#restoreDeletedCount');
  const restoreOverlay = page.locator('#restoreDeletedModalOverlay');

  await expect(restoreButton).toBeDisabled();
  await expect(restoreCount).toBeHidden();

  await cell.click();
  await page.locator('#cellMenu .menu-option').first().click();
  await cell.click();
  await page.locator('#cellMenu .menu-ghost-toggle').click();
  await deleteRenderedNameGroup(page, 'row', 2);
  await deleteRenderedNameGroup(page, 'column', 4);

  await expect(rowName).toBeHidden();
  await expect(columnName).toHaveCount(0);
  await expect(restoreButton).toBeEnabled();
  await expect(restoreButton).toHaveAttribute('aria-label', '삭제한 왼과 른 2개 복구');
  await expect(restoreCount).toHaveText('2');
  await expect(restoreCount).toBeVisible();

  await restoreButton.click();
  await expect(restoreOverlay).toBeVisible();
  await expect(restoreOverlay.getByRole('heading', { name: '삭제한 왼', exact: true })).toBeVisible();
  await expect(restoreOverlay.getByRole('heading', { name: '삭제한 른', exact: true })).toBeVisible();
  await expect(restoreOverlay.locator('.restore-group-name')).toHaveText(['낭왼', '쮼른']);
  await expect(restoreOverlay.getByRole('button', { name: '낭왼 복구' })).toBeFocused();

  const rightNameBox = await restoreOverlay.locator('.restore-group-name').last().boundingBox();
  const rightRestoreBox = await restoreOverlay.getByRole('button', { name: '쮼른 복구' }).boundingBox();
  expect(rightNameBox).not.toBeNull();
  expect(rightRestoreBox).not.toBeNull();
  expect(rightRestoreBox.x - (rightNameBox.x + rightNameBox.width)).toBeGreaterThanOrEqual(8);

  await restoreOverlay.getByRole('button', { name: '쮼른 복구' }).click();

  await expect(rowName).toBeVisible();
  await expect(columnName).toHaveCount(0);
  await expect(cell).toHaveClass(/is-ghost/);
  await expect(cell).toHaveCSS('background-color', 'rgba(255, 173, 173, 0.5)');
  await expect(restoreCount).toHaveText('1');
  await expect(page.locator('#restoreDeletedStatus')).toHaveText('쮼른을 복구했습니다.');

  await page.locator('#closeRestoreDeletedBtn').click();
  await expect(restoreOverlay).toBeHidden();
  await page.locator('#undoButton').click();
  await expect(rowName).toBeHidden();
  await expect(restoreCount).toHaveText('2');
  await page.locator('#redoButton').click();
  await expect(rowName).toBeVisible();
  await expect(restoreCount).toHaveText('1');

  await page.reload();
  await expect(rowName).toBeVisible();
  await expect(columnName).toHaveCount(0);
  await expect(cell).toHaveClass(/is-ghost/);
  await expect(restoreCount).toHaveText('1');
  await expect(restoreButton).toBeEnabled();
  await expect(page.locator('#undoButton')).toBeEnabled();
  await expect(page.locator('#redoButton')).toBeDisabled();

  await restoreButton.click();
  await expect(restoreOverlay.getByRole('button', { name: '낭왼 복구' })).toBeFocused();
  await restoreOverlay.getByRole('button', { name: '낭왼 복구' }).click();
  await expect(columnName).toBeVisible();
  await expect(table).toHaveAttribute('aria-colcount', '6');
  await expect(restoreButton).toBeDisabled();
  await expect(restoreCount).toBeHidden();
  await expect(page.locator('#restoreAllDeletedBtn')).toBeDisabled();
  await expect(page.locator('#restoreDeletedStatus')).toHaveText('낭왼을 복구했습니다.');
});

test('restores all deleted groups as one undoable operation', async ({ page }) => {
  const table = page.locator('#rpsTable');
  const restoreButton = page.locator('#restoreDeletedButton');
  const restoreCount = page.locator('#restoreDeletedCount');
  const restoreOverlay = page.locator('#restoreDeletedModalOverlay');
  const rowOne = page.locator('.paintable-name[data-axis="row"][data-group-index="1"]');
  const rowThree = page.locator('.paintable-name[data-axis="row"][data-group-index="3"]');
  const columnZero = page.locator('.paintable-name[data-axis="column"][data-group-index="0"]');
  const columnFour = page.locator('.paintable-name[data-axis="column"][data-group-index="4"]');

  await deleteRenderedNameGroup(page, 'row', 1);
  await deleteRenderedNameGroup(page, 'row', 3);
  await deleteRenderedNameGroup(page, 'column', 0);
  await deleteRenderedNameGroup(page, 'column', 4);
  await expect(restoreCount).toHaveText('4');
  await expect(table).toHaveAttribute('aria-rowcount', '4');
  await expect(table).toHaveAttribute('aria-colcount', '4');

  await restoreButton.click();
  await expect(restoreOverlay.locator('.restore-group-item-button')).toHaveCount(4);
  await page.locator('#restoreAllDeletedBtn').click();
  await expect(rowOne).toBeVisible();
  await expect(rowThree).toBeVisible();
  await expect(columnZero).toBeVisible();
  await expect(columnFour).toBeVisible();
  await expect(table).toHaveAttribute('aria-rowcount', '6');
  await expect(table).toHaveAttribute('aria-colcount', '6');
  await expect(restoreButton).toBeDisabled();
  await expect(restoreCount).toBeHidden();
  await expect(restoreOverlay.locator('.restore-groups-empty')).toHaveText('삭제한 왼이나 른이 없습니다.');
  await expect(page.locator('#restoreAllDeletedBtn')).toBeDisabled();
  await expect(page.locator('#restoreDeletedStatus')).toHaveText('삭제한 왼과 른 4개를 모두 복구했습니다.');

  await page.locator('#closeRestoreDeletedBtn').click();
  await page.locator('#undoButton').click();
  await expect(rowOne).toBeHidden();
  await expect(rowThree).toBeHidden();
  await expect(columnZero).toHaveCount(0);
  await expect(columnFour).toHaveCount(0);
  await expect(restoreCount).toHaveText('4');
  await expect(table).toHaveAttribute('aria-rowcount', '4');
  await expect(table).toHaveAttribute('aria-colcount', '4');

  await page.locator('#redoButton').click();
  await expect(rowOne).toBeVisible();
  await expect(rowThree).toBeVisible();
  await expect(columnZero).toBeVisible();
  await expect(columnFour).toBeVisible();
  await expect(restoreButton).toBeDisabled();

  await page.reload();
  await expect(table).toHaveAttribute('aria-rowcount', '6');
  await expect(table).toHaveAttribute('aria-colcount', '6');
  await expect(restoreButton).toBeDisabled();
  await expect(page.locator('#undoButton')).toBeEnabled();
  await expect(page.locator('#redoButton')).toBeDisabled();
});

test('closes legend editors with Escape', async ({ page }, testInfo) => {
  await page.locator('.btn-add-legend').click();
  const overlay = page.locator('#nameModalOverlay');
  const input = page.locator('#nameInput');
  await expect(input).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(overlay).toBeHidden();

  await page.locator('#label-1').click();
  const editOverlay = page.locator(
    testInfo.project.name === 'mobile' ? '#unifiedModalOverlay' : '#nameModalOverlay'
  );
  await expect(editOverlay).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(editOverlay).toBeHidden();
});

test('does not leave the legend delete button visible after mouse editing', async ({ page }, testInfo) => {
  const deleteButton = page.locator('#item-1 .btn-delete-item');
  await expect(deleteButton).toHaveCSS('opacity', '0');

  await page.locator('#label-1').click();
  const overlay = page.locator(testInfo.project.name === 'mobile' ? '#unifiedModalOverlay' : '#nameModalOverlay');
  await expect(overlay).toBeVisible();
  await overlay.locator('.btn-cancel').click();

  await expect(overlay).toBeHidden();
  await expect(deleteButton).toHaveCSS('opacity', '0');
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
    await expect(page.locator('html')).not.toHaveClass(/is-adjusting-color/);
    await page.locator('#unifiedHueSlider').fill('120');
    await page.locator('#unifiedSaveBtn').click();
  } else {
    await page.locator('#disp-1').click();
    await expect(page.locator('html')).toHaveClass(/is-adjusting-color/);
    await expect(page.locator('.paintable').first()).toHaveCSS('transition-duration', '0s');
    await page.locator('#hueSlider').fill('120');
    await page.locator('#visualPickerPopup .btn-done').click();
    await expect(page.locator('html')).not.toHaveClass(/is-adjusting-color/);
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

test('uses Escape and plain Enter for desktop color editing', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  const readColor = () => page.evaluate(() => (
    getComputedStyle(document.documentElement).getPropertyValue('--color-1').trim()
  ));
  const original = await readColor();

  await page.locator('#disp-1').click();
  await page.locator('#hueSlider').fill('120');
  await page.keyboard.press('Escape');
  await expect(page.locator('#visualPickerPopup')).toBeHidden();
  await expect.poll(readColor).toBe(original);

  await page.locator('#disp-1').click();
  await page.locator('#hueSlider').fill('120');
  await page.keyboard.press('Shift+Enter');
  await expect(page.locator('#visualPickerPopup')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#visualPickerPopup')).toBeHidden();
  await expect.poll(readColor).not.toBe(original);
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

test('omits deleted row labels and draws ghost text white in the exported canvas', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  const ghostCell = page.locator('.paintable[data-cell-index="18"]');
  await ghostCell.click();
  await page.locator('#cellMenu .menu-ghost-toggle').click();
  await expect(ghostCell).toHaveCSS('color', 'rgb(255, 255, 255)');

  const deletedRowName = page.locator(
    '.paintable-name[data-axis="row"][data-group-index="2"]'
  );
  await deletedRowName.click();
  await page.locator('#cellMenu .menu-delete-group').click();
  await expect(deletedRowName).toBeHidden();

  await page.evaluate(() => {
    window.__exportFillTextCalls = [];
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function fillText(text, x, y, maxWidth) {
      window.__exportFillTextCalls.push({
        fillStyle: String(this.fillStyle),
        text: String(text)
      });
      if (arguments.length >= 4) return originalFillText.call(this, text, x, y, maxWidth);
      return originalFillText.call(this, text, x, y);
    };
  });

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#saveImageButton').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^cortis-rps-chart-\d{4}-\d{2}-\d{2}\.png$/);

  const fillTextCalls = await page.evaluate(() => window.__exportFillTextCalls);
  const drawnTexts = fillTextCalls.map(call => call.text);
  for (const deletedLabel of ['틴훈', '젯쮸', '셩쮼', '낭쮼']) {
    expect(drawnTexts).not.toContain(deletedLabel);
  }

  const ghostTextCalls = fillTextCalls.filter(call => call.text === '쮸건');
  expect(ghostTextCalls).toHaveLength(1);
  expect(ghostTextCalls[0].fillStyle).toMatch(/^(?:#fff(?:fff)?|white|rgba?\(255,\s*255,\s*255(?:,\s*1)?\))$/i);
});

test('downloads a non-empty PNG containing the painted chart color', async ({ page }) => {
  const cell = page.locator('.paintable').first();
  await cell.click();
  await page.locator('#cellMenu .menu-option').first().click();

  const downloadPromise = page.waitForEvent('download');
  const saveButton = page.locator('#saveImageButton');
  await saveButton.click();
  const download = await downloadPromise;
  await expect(saveButton.locator('span')).toHaveText('저장 완료');
  await expect(saveButton).toHaveClass(/is-success/);
  await expect(page.locator('#imageSaveStatus')).toHaveText('이미지 저장이 완료되었습니다.');
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
  await expect(saveButton.locator('span')).toHaveText('이미지 저장', { timeout: 2500 });
  await expect(saveButton).not.toHaveClass(/is-success/);
  await expect(page.locator('#imageSaveStatus')).toHaveText('이미지 저장이 완료되었습니다.');
});

test('recovers the save control and announces an image export failure', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toBlob = function toBlob(callback) {
      callback(null);
    };
  });

  page.once('dialog', dialog => dialog.accept());
  const saveButton = page.locator('#saveImageButton');
  await saveButton.click();
  await expect(page.locator('#imageSaveStatus')).toHaveText('이미지 저장에 실패했습니다.');
  await expect(saveButton).toBeEnabled();
  await expect(saveButton.locator('span')).toHaveText('이미지 저장');
  await expect(saveButton).not.toHaveAttribute('aria-busy');
  await expect(saveButton).not.toHaveClass(/is-success/);
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
