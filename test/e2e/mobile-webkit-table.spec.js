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

  expect(geometry.frameWidth).toBeCloseTo(
    initialGeometry.frameWidth - initialGeometry.cellWidth,
    1
  );
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

test('renders every live table border as an equal device-pixel run', async ({
  page
}, testInfo) => {
  test.skip(!['mobile', 'mobile-webkit-table'].includes(testInfo.project.name));
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: '#rpsTable th, #rpsTable td { color: transparent !important; text-shadow: none !important; }'
  });

  const scanTableBorders = async () => {
    const shell = page.locator('.table-shell');
    const geometry = await page.evaluate(() => {
      const shellElement = document.querySelector('.table-shell');
      const header = document.querySelector('#rpsTable thead tr');
      const firstHeaderCell = header.cells[0];
      const shellRect = shellElement.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const firstHeaderCellRect = firstHeaderCell.getBoundingClientRect();
      return {
        verticalScanRatio: (
          headerRect.top - shellRect.top + headerRect.height / 2
        ) / shellRect.height,
        horizontalScanRatio: (
          firstHeaderCellRect.left - shellRect.left + firstHeaderCellRect.width / 2
        ) / shellRect.width,
        devicePixelRatio: window.devicePixelRatio
      };
    });
    const screenshot = await shell.screenshot({ animations: 'disabled', scale: 'device' });

    return page.evaluate(async ({ source, verticalScanRatio, horizontalScanRatio }) => {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = `data:image/png;base64,${source}`;
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const verticalScanY = Math.max(0, Math.min(
        canvas.height - 1,
        Math.round((canvas.height - 1) * verticalScanRatio)
      ));
      const horizontalScanX = Math.max(0, Math.min(
        canvas.width - 1,
        Math.round((canvas.width - 1) * horizontalScanRatio)
      ));
      const collectGridRuns = (pixels, length) => {
        const runs = [];
        let runStart = -1;
        for (let index = 0; index < length; index += 1) {
          const offset = index * 4;
          const isGridPixel = (
            pixels[offset] <= 55
            && pixels[offset + 1] <= 55
            && pixels[offset + 2] <= 55
            && pixels[offset + 3] === 255
          );
          if (isGridPixel && runStart < 0) runStart = index;
          if (!isGridPixel && runStart >= 0) {
            runs.push({ start: runStart, end: index - 1, width: index - runStart });
            runStart = -1;
          }
        }
        if (runStart >= 0) {
          runs.push({ start: runStart, end: length - 1, width: length - runStart });
        }
        return runs;
      };
      const verticalPixels = context.getImageData(
        0,
        verticalScanY,
        canvas.width,
        1
      ).data;
      const horizontalPixels = context.getImageData(
        horizontalScanX,
        0,
        1,
        canvas.height
      ).data;

      return {
        width: canvas.width,
        height: canvas.height,
        verticalRuns: collectGridRuns(verticalPixels, canvas.width),
        horizontalRuns: collectGridRuns(horizontalPixels, canvas.height)
      };
    }, {
      source: screenshot.toString('base64'),
      verticalScanRatio: geometry.verticalScanRatio,
      horizontalScanRatio: geometry.horizontalScanRatio
    }).then(result => ({ ...result, devicePixelRatio: geometry.devicePixelRatio }));
  };

  for (let visibleCellCount = 6; visibleCellCount >= 1; visibleCellCount -= 1) {
    await expect(page.locator('#rpsTable thead th:visible')).toHaveCount(visibleCellCount);
    const scan = await scanTableBorders();
    expect(scan.devicePixelRatio).toBe(3);
    expect(scan.verticalRuns).toHaveLength(visibleCellCount + 1);
    expect([...new Set(scan.verticalRuns.map(run => run.width))]).toEqual([3]);

    if (visibleCellCount > 1) {
      const lastColumn = page.locator(
        '.paintable-name[data-axis="column"]'
      ).last();
      await lastColumn.tap();
      await page.locator('#cellMenu .menu-delete-group').tap();
    }
  }

  for (let visibleRowCount = 6; visibleRowCount >= 1; visibleRowCount -= 1) {
    await expect(page.locator('#rpsTable tr:visible')).toHaveCount(visibleRowCount);
    const scan = await scanTableBorders();
    expect(scan.horizontalRuns).toHaveLength(visibleRowCount + 1);
    expect([...new Set(scan.horizontalRuns.map(run => run.width))]).toEqual([3]);

    if (visibleRowCount > 1) {
      const lastRow = page.locator('.paintable-name[data-axis="row"]:visible').last();
      await lastRow.tap();
      await page.locator('#cellMenu .menu-delete-group').tap();
    }
  }
});

test('keeps live and exported grid strokes stable while deleting rows and columns', async ({
  page
}, testInfo) => {
  test.skip(!['mobile', 'mobile-webkit-table'].includes(testInfo.project.name));
  await page.evaluate(() => document.fonts.ready);

  await page.evaluate(() => {
    window.__tableStrokeCalls = [];
    window.__exportCanvasMetrics = [];
    const paths = new WeakMap();
    const originalBeginPath = CanvasRenderingContext2D.prototype.beginPath;
    const originalMoveTo = CanvasRenderingContext2D.prototype.moveTo;
    const originalLineTo = CanvasRenderingContext2D.prototype.lineTo;
    const originalStroke = CanvasRenderingContext2D.prototype.stroke;
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;

    CanvasRenderingContext2D.prototype.beginPath = function beginPath(...args) {
      paths.set(this, []);
      return originalBeginPath.apply(this, args);
    };
    CanvasRenderingContext2D.prototype.moveTo = function moveTo(x, y, ...args) {
      paths.get(this)?.push({ x, y });
      return originalMoveTo.apply(this, [x, y, ...args]);
    };
    CanvasRenderingContext2D.prototype.lineTo = function lineTo(x, y, ...args) {
      paths.get(this)?.push({ x, y });
      return originalLineTo.apply(this, [x, y, ...args]);
    };
    CanvasRenderingContext2D.prototype.stroke = function stroke(...args) {
      const strokeStyle = String(this.strokeStyle);
      if (/^(?:#333(?:333)?|rgb\(51,\s*51,\s*51\))$/i.test(strokeStyle)) {
        const transform = this.getTransform();
        window.__tableStrokeCalls.push({
          lineWidth: this.lineWidth,
          strokeStyle,
          scaleX: transform.a,
          scaleY: transform.d,
          points: [...(paths.get(this) ?? [])]
        });
      }
      return originalStroke.apply(this, args);
    };
    HTMLCanvasElement.prototype.toBlob = function toBlob(...args) {
      const context = this.getContext('2d');
      const lastRow = context.getImageData(0, this.height - 1, this.width, 1).data;
      const gridStroke = window.__tableStrokeCalls.find(call => call.points.length > 0);
      const segments = [];
      for (let index = 0; index < (gridStroke?.points.length ?? 0); index += 2) {
        segments.push([gridStroke.points[index], gridStroke.points[index + 1]]);
      }
      const verticalSegments = segments.filter(([start, end]) => start.x === end.x);
      const horizontalSegments = segments.filter(([start, end]) => start.y === end.y);
      const collectGridRuns = (pixels, length) => {
        const runs = [];
        let runStart = -1;
        for (let index = 0; index < length; index += 1) {
          const offset = index * 4;
          const isGridPixel = (
            pixels[offset] <= 55
            && pixels[offset + 1] <= 55
            && pixels[offset + 2] <= 55
            && pixels[offset + 3] === 255
          );
          if (isGridPixel && runStart < 0) runStart = index;
          if (!isGridPixel && runStart >= 0) {
            runs.push(index - runStart);
            runStart = -1;
          }
        }
        if (runStart >= 0) runs.push(length - runStart);
        return runs;
      };
      let verticalGridRuns = [];
      let horizontalGridRuns = [];
      if (verticalSegments.length > 0 && horizontalSegments.length > 0) {
        const scale = gridStroke.scaleX;
        const tableTop = Math.min(...verticalSegments.flatMap(segment => (
          segment.map(point => point.y)
        )));
        const tableLeft = Math.min(...horizontalSegments.flatMap(segment => (
          segment.map(point => point.x)
        )));
        const firstHorizontalY = Math.min(...horizontalSegments.map(([start]) => start.y));
        const firstVerticalX = Math.min(...verticalSegments.map(([start]) => start.x));
        const scanY = Math.round((tableTop + firstHorizontalY) / 2 * scale);
        const scanX = Math.round((tableLeft + firstVerticalX) / 2 * scale);
        verticalGridRuns = collectGridRuns(
          context.getImageData(0, scanY, this.width, 1).data,
          this.width
        );
        horizontalGridRuns = collectGridRuns(
          context.getImageData(scanX, 0, 1, this.height).data,
          this.height
        );
      }
      let lastRowAlphaMin = 255;
      let lastRowAlphaMax = 0;
      for (let offset = 3; offset < lastRow.length; offset += 4) {
        lastRowAlphaMin = Math.min(lastRowAlphaMin, lastRow[offset]);
        lastRowAlphaMax = Math.max(lastRowAlphaMax, lastRow[offset]);
      }
      window.__exportCanvasMetrics.push({
        width: this.width,
        height: this.height,
        lastRowAlphaMin,
        lastRowAlphaMax,
        verticalSegmentCount: verticalSegments.length,
        horizontalSegmentCount: horizontalSegments.length,
        verticalGridRuns,
        horizontalGridRuns
      });
      return originalToBlob.apply(this, args);
    };
  });

  const captureExportMetrics = async () => {
    await page.evaluate(() => {
      window.__tableStrokeCalls = [];
      window.__exportCanvasMetrics = [];
    });
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#saveImageButton').click();
    await downloadPromise;
    await expect(page.locator('#saveImageButton')).toBeEnabled();
    return page.evaluate(() => ({
      strokes: window.__tableStrokeCalls.slice(-2),
      canvas: window.__exportCanvasMetrics.at(-1)
    }));
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
      shellLineWidth: getComputedStyle(shell).borderTopWidth,
      visibleColumnCount: table.rows[0].cells.length,
      visibleRowCount: renderedRows.length + 1,
      rowHeight: renderedRows[0].getBoundingClientRect().height,
      lineWidths: [...new Set(gridCells.map(cell => getComputedStyle(cell).borderTopWidth))],
      lineColors: [...new Set(gridCells.map(cell => getComputedStyle(cell).borderTopColor))],
      backgroundClips: [...new Set(
        [...table.querySelectorAll('th, td')].map(cell => getComputedStyle(cell).backgroundClip)
      )]
    };
  });

  const beforeGrid = await readLiveGrid();
  const beforeExport = await captureExportMetrics();

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
  const afterExport = await captureExportMetrics();

  expect(beforeGrid.backgroundClips).toEqual(['padding-box']);
  expect(afterGrid.backgroundClips).toEqual(['padding-box']);
  expect(beforeGrid.shellLineWidth).toBe('1px');
  expect(afterGrid.shellLineWidth).toBe('1px');
  expect(beforeGrid.lineWidths).toEqual(['1px']);
  expect(afterGrid.lineWidths).toEqual(beforeGrid.lineWidths);
  expect(afterGrid.lineColors).toEqual(beforeGrid.lineColors);
  expect(afterGrid.tableTop).toBeCloseTo(beforeGrid.tableTop, 2);
  expect(afterGrid.shellTop).toBeCloseTo(beforeGrid.shellTop, 2);
  expect(afterGrid.tableBottom).toBeLessThanOrEqual(afterGrid.shellBottom);
  expect(afterGrid.tableBottom).toBeCloseTo(
    beforeGrid.tableBottom - beforeGrid.rowHeight,
    1
  );

  for (const [capture, liveGrid] of [
    [beforeExport, beforeGrid],
    [afterExport, afterGrid]
  ]) {
    expect(capture.strokes).toHaveLength(2);
    capture.strokes.forEach(stroke => {
      expect(stroke.lineWidth).toBe(1);
      expect(stroke.scaleX).toBe(4);
      expect(stroke.scaleY).toBe(4);
      expect(stroke.lineWidth * stroke.scaleX).toBe(4);
    });
    const gridStroke = capture.strokes.find(stroke => stroke.points.length > 0);
    expect(gridStroke).toBeTruthy();
    expect(capture.canvas.verticalSegmentCount).toBe(liveGrid.visibleColumnCount - 1);
    expect(capture.canvas.horizontalSegmentCount).toBe(liveGrid.visibleRowCount - 1);
    expect(capture.canvas.verticalGridRuns).toHaveLength(liveGrid.visibleColumnCount + 1);
    expect(capture.canvas.horizontalGridRuns).toHaveLength(liveGrid.visibleRowCount + 1);
    expect([...new Set(capture.canvas.verticalGridRuns)]).toEqual([4]);
    expect([...new Set(capture.canvas.horizontalGridRuns)]).toEqual([4]);
    gridStroke.points.forEach(point => {
      expect(point.x * gridStroke.scaleX).toBeCloseTo(
        Math.round(point.x * gridStroke.scaleX),
        8
      );
      expect(point.y * gridStroke.scaleY).toBeCloseTo(
        Math.round(point.y * gridStroke.scaleY),
        8
      );
    });
    expect(capture.canvas.lastRowAlphaMin).toBe(255);
    expect(capture.canvas.lastRowAlphaMax).toBe(255);
  }
  expect(beforeExport.canvas.width).toBe(afterExport.canvas.width);
  expect(beforeExport.canvas.height - afterExport.canvas.height).toBe(159);
  expect(afterExport.strokes[0].strokeStyle).toBe(afterExport.strokes[1].strokeStyle);
});
