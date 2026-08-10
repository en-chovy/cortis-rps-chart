import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('keeps four remaining columns aligned after deleting a middle column', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-webkit-table');
  await page.evaluate(() => document.fonts.ready);
  const table = page.locator('#rpsTable');
  const chartFrame = page.locator('.chart-frame');
  const deletedHeader = page.locator(
    '.paintable-name[data-axis="column"][data-group-index="2"]'
  );
  const initialGeometry = await page.evaluate(() => {
    const frame = document.querySelector('.chart-frame');
    const tableElement = document.getElementById('rpsTable');
    const shell = document.querySelector('.table-shell');
    const header = document.querySelector(
      '.paintable-name[data-axis="column"][data-group-index="0"]'
    );
    const tableRect = tableElement.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    const shellStyle = getComputedStyle(shell);
    const headerStyle = getComputedStyle(header);
    return {
      frameWidth: frame.getBoundingClientRect().width,
      tableWidth: tableRect.width,
      tableLeft: tableRect.left,
      tableRight: tableRect.right,
      shellLeft: shellRect.left,
      shellRight: shellRect.right,
      shellBorderWidth: Number.parseFloat(shellStyle.borderLeftWidth),
      shellBorderColor: shellStyle.borderLeftColor,
      gridLineWidth: Number.parseFloat(headerStyle.borderLeftWidth),
      gridLineColor: headerStyle.borderLeftColor,
      cellWidth: header.getBoundingClientRect().width,
      tableBackground: getComputedStyle(tableElement).backgroundColor,
      cellBackgroundClip: headerStyle.backgroundClip
    };
  });

  expect(initialGeometry.tableLeft).toBeGreaterThanOrEqual(initialGeometry.shellLeft);
  expect(initialGeometry.tableRight).toBeLessThanOrEqual(initialGeometry.shellRight);
  expect(initialGeometry.tableBackground).toBe('rgb(255, 255, 255)');
  expect(initialGeometry.cellBackgroundClip).toBe('padding-box');

  await deletedHeader.tap();
  await page.locator('#cellMenu .menu-delete-group').tap();

  await expect(deletedHeader).toHaveCount(0);
  await expect(table.locator('tbody [data-column-index="2"]')).toHaveCount(0);
  await expect(table).toHaveAttribute('aria-colcount', '5');
  await expect(table.locator('thead th:visible')).toHaveCount(5);
  await expect(
    table.locator('tbody tr').first().locator('th:visible, td:visible')
  ).toHaveCount(5);

  const geometry = await page.evaluate(() => {
    const frame = document.querySelector('.chart-frame');
    const tableElement = document.getElementById('rpsTable');
    const shell = document.querySelector('.table-shell');
    const tableRect = tableElement.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    const shellStyle = getComputedStyle(shell);
    const visibleHeader = tableElement.tHead.rows[0].cells[1];
    const headerStyle = getComputedStyle(visibleHeader);
    const rows = [...tableElement.tBodies[0].rows];
    const rowGeometries = rows.map(row => [...row.cells].map(cell => {
      const rect = cell.getBoundingClientRect();
      return {
        columnIndex: cell.dataset.columnIndex ?? null,
        left: rect.left,
        right: rect.right,
        width: rect.width
      };
    }));
    return {
      frameWidth: frame.getBoundingClientRect().width,
      tableWidth: tableRect.width,
      tableLeft: tableRect.left,
      tableRight: tableRect.right,
      shellWidth: shellRect.width,
      shellLeft: shellRect.left,
      shellRight: shellRect.right,
      shellBorderWidth: Number.parseFloat(shellStyle.borderLeftWidth),
      shellBorderColor: shellStyle.borderLeftColor,
      gridLineWidth: Number.parseFloat(headerStyle.borderLeftWidth),
      gridLineColor: headerStyle.borderLeftColor,
      rowGeometries,
      scrollWidth: document.scrollingElement.scrollWidth,
      clientWidth: document.scrollingElement.clientWidth
    };
  });

  expect(geometry.frameWidth).toBeCloseTo(initialGeometry.frameWidth * 5 / 6, 1);
  expect(geometry.shellWidth).toBeCloseTo(geometry.frameWidth, 1);
  expect(geometry.tableWidth).toBeCloseTo(
    geometry.shellWidth - geometry.shellBorderWidth * 2,
    1
  );
  expect(geometry.tableLeft).toBeGreaterThanOrEqual(geometry.shellLeft);
  expect(geometry.tableRight).toBeLessThanOrEqual(geometry.shellRight);
  expect(geometry.shellBorderWidth).toBe(initialGeometry.shellBorderWidth);
  expect(geometry.shellBorderColor).toBe(initialGeometry.shellBorderColor);
  expect(geometry.gridLineWidth).toBe(initialGeometry.gridLineWidth);
  expect(geometry.gridLineColor).toBe(initialGeometry.gridLineColor);
  geometry.rowGeometries.forEach(cells => {
    expect(cells.map(cell => cell.columnIndex)).toEqual([null, '0', '1', '3', '4']);
    cells.forEach(cell => {
      expect(Math.abs(cell.width - initialGeometry.cellWidth)).toBeLessThanOrEqual(1);
    });
    for (let index = 1; index < cells.length; index += 1) {
      expect(
        Math.abs(cells[index].left - cells[index - 1].right)
      ).toBeLessThanOrEqual(1);
    }
  });
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);

  await page.locator('#undoButton').tap();
  await expect(deletedHeader).toBeVisible();
  await expect(table.locator('tbody [data-column-index="2"]')).toHaveCount(5);
  await expect(table).toHaveAttribute('aria-colcount', '6');
  expect(await chartFrame.evaluate(element => element.getBoundingClientRect().width))
    .toBeCloseTo(initialGeometry.frameWidth, 1);

  await page.locator('#redoButton').tap();
  await expect(deletedHeader).toHaveCount(0);
  await expect(table).toHaveAttribute('aria-colcount', '5');

  await page.reload();
  await expect(deletedHeader).toHaveCount(0);
  await expect(table.locator('thead th:visible')).toHaveCount(5);
  await expect(
    table.locator('tbody tr').first().locator('th:visible, td:visible')
  ).toHaveCount(5);
  await expect(table).toHaveAttribute('aria-colcount', '5');
  expect(await chartFrame.evaluate(element => element.getBoundingClientRect().width))
    .toBeCloseTo(geometry.frameWidth, 1);
});

test('keeps live and exported grid strokes stable while deleting rows and columns', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-webkit-table');
  await page.evaluate(() => document.fonts.ready);

  await page.evaluate(() => {
    window.__tableStrokeCalls = [];
    const originalStroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function stroke(...args) {
      const strokeStyle = String(this.strokeStyle);
      if (/^(?:#333(?:333)?|rgb\(51,\s*51,\s*51\))$/i.test(strokeStyle)) {
        window.__tableStrokeCalls.push({
          lineWidth: this.lineWidth,
          strokeStyle
        });
      }
      return originalStroke.apply(this, args);
    };
  });

  const captureExportStrokes = async () => {
    await page.evaluate(() => { window.__tableStrokeCalls = []; });
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#saveImageButton').click();
    await downloadPromise;
    await expect(page.locator('#saveImageButton')).toBeEnabled();
    return page.evaluate(() => window.__tableStrokeCalls.slice(-2));
  };

  const readLiveGrid = () => page.evaluate(() => {
    const table = document.getElementById('rpsTable');
    const shell = document.querySelector('.table-shell');
    const renderedRows = [...table.tBodies[0].rows].filter(row => !row.hidden);
    const gridCells = renderedRows.flatMap(row => [...row.cells].slice(1));
    const tableRect = table.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    return {
      tableTop: tableRect.top,
      tableBottom: tableRect.bottom,
      shellTop: shellRect.top,
      shellBottom: shellRect.bottom,
      rowHeight: renderedRows[0].getBoundingClientRect().height,
      lineWidths: [...new Set(gridCells.map(cell => getComputedStyle(cell).borderTopWidth))],
      lineColors: [...new Set(gridCells.map(cell => getComputedStyle(cell).borderTopColor))],
      backgroundClips: [...new Set(
        [...table.querySelectorAll('th, td')].map(cell => getComputedStyle(cell).backgroundClip)
      )]
    };
  });

  const beforeGrid = await readLiveGrid();
  const beforeExportStrokes = await captureExportStrokes();

  const deletedRowName = page.locator(
    '.paintable-name[data-axis="row"][data-group-index="2"]'
  );
  await deletedRowName.tap();
  await page.locator('#cellMenu .menu-delete-group').tap();
  await expect(deletedRowName).toBeHidden();

  const deletedColumnName = page.locator(
    '.paintable-name[data-axis="column"][data-group-index="2"]'
  );
  await deletedColumnName.tap();
  await page.locator('#cellMenu .menu-delete-group').tap();
  await expect(deletedColumnName).toHaveCount(0);

  const afterGrid = await readLiveGrid();
  const afterExportStrokes = await captureExportStrokes();

  expect(beforeGrid.backgroundClips).toEqual(['padding-box']);
  expect(afterGrid.backgroundClips).toEqual(['padding-box']);
  expect(afterGrid.lineWidths).toEqual(beforeGrid.lineWidths);
  expect(afterGrid.lineColors).toEqual(beforeGrid.lineColors);
  expect(afterGrid.tableTop).toBeCloseTo(beforeGrid.tableTop, 2);
  expect(afterGrid.shellTop).toBeCloseTo(beforeGrid.shellTop, 2);
  expect(afterGrid.tableBottom).toBeLessThanOrEqual(afterGrid.shellBottom);
  expect(afterGrid.tableBottom).toBeCloseTo(
    beforeGrid.tableBottom - beforeGrid.rowHeight,
    1
  );

  expect(beforeExportStrokes).toHaveLength(2);
  expect(afterExportStrokes).toHaveLength(2);
  expect(afterExportStrokes).toEqual(beforeExportStrokes);
  expect(afterExportStrokes[0].lineWidth).toBe(afterExportStrokes[1].lineWidth);
  expect(afterExportStrokes[0].strokeStyle).toBe(afterExportStrokes[1].strokeStyle);
});
