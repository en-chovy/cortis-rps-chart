import { expect, test } from '@playwright/test';

const GRID_RGB = [51, 51, 51];
const GRID_CSS_WIDTH = 2 / 3;
const LIVE_DEVICE_PIXEL_RATIO = 3;
const EXPORT_PIXEL_RATIO = 4;

function expectRgbClose(actual, expected, tolerance = 2) {
  expect(actual).toHaveLength(3);
  expected.forEach((channel, index) => {
    expect(actual[index]).toBeGreaterThanOrEqual(channel - tolerance);
    expect(actual[index]).toBeLessThanOrEqual(channel + tolerance);
  });
}

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
  expect(initialGeometry.cellBackgroundClip).toBe('border-box');

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

test('keeps every live SVG grid run at two physical pixels of DPR3 coverage', async ({
  page
}, testInfo) => {
  test.skip(!['mobile', 'mobile-webkit-table'].includes(testInfo.project.name));
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: '#rpsTable th, #rpsTable td { color: transparent !important; text-shadow: none !important; }'
  });

  const scanTableGrid = async () => {
    const geometry = await page.evaluate(() => {
      const frame = document.querySelector('.chart-frame');
      const shell = document.querySelector('.table-shell');
      const table = document.getElementById('rpsTable');
      const overlay = frame.querySelector(':scope > .table-grid-overlay');
      const headerRect = table.tHead.rows[0].getBoundingClientRect();
      const firstCellRect = table.rows[0].cells[0].getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      const padding = 2;
      const devicePixelRatio = window.devicePixelRatio;
      const clipLeft = Math.floor(
        (frameRect.left - padding) * devicePixelRatio
      ) / devicePixelRatio;
      const clipTop = Math.floor(
        (frameRect.top - padding) * devicePixelRatio
      ) / devicePixelRatio;
      const clipRight = Math.ceil(
        (frameRect.right + padding) * devicePixelRatio
      ) / devicePixelRatio;
      const clipBottom = Math.ceil(
        (frameRect.bottom + padding) * devicePixelRatio
      ) / devicePixelRatio;
      const clip = {
        x: clipLeft,
        y: clipTop,
        width: clipRight - clipLeft,
        height: clipBottom - clipTop
      };
      return {
        clip,
        verticalScanRatio: (headerRect.top + headerRect.height / 2 - clip.y) / clip.height,
        horizontalScanRatio: (
          firstCellRect.left + firstCellRect.width / 2 - clip.x
        ) / clip.width,
        devicePixelRatio,
        overlay: {
          ariaHidden: overlay?.getAttribute('aria-hidden'),
          pointerEvents: overlay ? getComputedStyle(overlay).pointerEvents : null,
          strokeWidths: overlay
            ? [...new Set([...overlay.querySelectorAll('[stroke-width]')].map(element => (
              Number(element.getAttribute('stroke-width'))
            )))]
            : [],
          strokeColors: overlay
            ? [...new Set([...overlay.querySelectorAll('[stroke]')].map(element => (
              element.getAttribute('stroke')
            )))]
            : [],
          internalPath: overlay?.querySelector('.table-grid-lines')?.getAttribute('d') ?? null
        },
        shellBorderWidths: [...new Set([
          getComputedStyle(shell).borderTopWidth,
          getComputedStyle(shell).borderRightWidth,
          getComputedStyle(shell).borderBottomWidth,
          getComputedStyle(shell).borderLeftWidth
        ])],
        cellBorderWidths: [...new Set(
          [...table.querySelectorAll('th, td')].flatMap(cell => {
            const style = getComputedStyle(cell);
            return [
              style.borderTopWidth,
              style.borderRightWidth,
              style.borderBottomWidth,
              style.borderLeftWidth
            ];
          })
        )]
      };
    });
    const screenshot = await page.screenshot({
      animations: 'disabled',
      clip: geometry.clip,
      scale: 'device'
    });

    const scans = await page.evaluate(async ({
      source,
      verticalScanRatio,
      horizontalScanRatio,
      gridRgb
    }) => {
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
      const verticalY = Math.max(0, Math.min(
        canvas.height - 1,
        Math.round(verticalScanRatio * canvas.height)
      ));
      const horizontalX = Math.max(0, Math.min(
        canvas.width - 1,
        Math.round(horizontalScanRatio * canvas.width)
      ));
      const collectRuns = (pixels, length) => {
        const runs = [];
        let start = -1;
        for (let index = 0; index < length; index += 1) {
          const offset = index * 4;
          const isGrid = (
            pixels[offset] === gridRgb[0]
            && pixels[offset + 1] === gridRgb[1]
            && pixels[offset + 2] === gridRgb[2]
            && pixels[offset + 3] === 255
          );
          if (isGrid && start < 0) start = index;
          if (!isGrid && start >= 0) {
            runs.push({ start, width: index - start });
            start = -1;
          }
        }
        if (start >= 0) runs.push({ start, width: length - start });
        return runs;
      };
      const measureCoverage = (pixels, runs, length) => runs.map((run, runIndex) => {
        const pixelAt = index => {
          const safeIndex = Math.max(0, Math.min(length - 1, index));
          return [
            pixels[safeIndex * 4],
            pixels[safeIndex * 4 + 1],
            pixels[safeIndex * 4 + 2]
          ];
        };
        const leftBackground = runIndex === 0
          ? [255, 255, 255]
          : pixelAt(run.start - 3);
        const rightBackground = runIndex === runs.length - 1
          ? [255, 255, 255]
          : pixelAt(run.start + run.width + 2);
        let coverage = 0;
        for (let index = run.start - 2; index < run.start + run.width + 2; index += 1) {
          const pixel = pixelAt(index);
          const background = index < run.start ? leftBackground : rightBackground;
          coverage += pixel.reduce((sum, channel, channelIndex) => {
            const contrast = background[channelIndex] - gridRgb[channelIndex];
            if (contrast <= 0) return sum;
            return sum + Math.max(0, Math.min(
              1,
              (background[channelIndex] - channel) / contrast
            ));
          }, 0) / pixel.length;
        }
        return {
          ...run,
          coverage,
          isOuter: runIndex === 0 || runIndex === runs.length - 1
        };
      });
      const verticalPixels = context.getImageData(0, verticalY, canvas.width, 1).data;
      const verticalRuns = collectRuns(verticalPixels, canvas.width);
      const horizontalPixels = context.getImageData(
        horizontalX,
        0,
        1,
        canvas.height
      ).data;
      const horizontalRuns = collectRuns(horizontalPixels, canvas.height);
      return {
        verticalRuns,
        horizontalRuns,
        verticalMeasurements: measureCoverage(verticalPixels, verticalRuns, canvas.width),
        horizontalMeasurements: measureCoverage(
          horizontalPixels,
          horizontalRuns,
          canvas.height
        )
      };
    }, {
      source: screenshot.toString('base64'),
      verticalScanRatio: geometry.verticalScanRatio,
      horizontalScanRatio: geometry.horizontalScanRatio,
      gridRgb: GRID_RGB
    });
    return { ...geometry, ...scans };
  };

  for (let visibleCellCount = 6; visibleCellCount >= 1; visibleCellCount -= 1) {
    await expect(page.locator('#rpsTable thead th:visible')).toHaveCount(visibleCellCount);
    const scan = await scanTableGrid();
    expect(scan.devicePixelRatio).toBe(LIVE_DEVICE_PIXEL_RATIO);
    expect(scan.overlay.ariaHidden).toBe('true');
    expect(scan.overlay.pointerEvents).toBe('none');
    expect(scan.overlay.strokeWidths).toHaveLength(1);
    expect(scan.overlay.strokeWidths[0]).toBeCloseTo(GRID_CSS_WIDTH, 12);
    expect(scan.overlay.strokeColors).toEqual(['#333']);
    expect(scan.shellBorderWidths).toEqual(['0px']);
    expect(scan.cellBorderWidths).toEqual(['0px']);
    expect(scan.verticalRuns).toHaveLength(visibleCellCount + 1);
    scan.verticalMeasurements.filter(measurement => !measurement.isOuter)
      .forEach(measurement => {
        expect(measurement.coverage).toBeGreaterThanOrEqual(1.75);
        expect(measurement.coverage).toBeLessThanOrEqual(2.25);
      });

    if (visibleCellCount > 1) {
      const lastColumn = page.locator('.paintable-name[data-axis="column"]').last();
      await lastColumn.tap();
      await page.locator('#cellMenu .menu-delete-group').tap();
    }
  }

  for (let visibleRowCount = 6; visibleRowCount >= 1; visibleRowCount -= 1) {
    await expect(page.locator('#rpsTable tr:visible')).toHaveCount(visibleRowCount);
    const scan = await scanTableGrid();
    expect(scan.horizontalRuns).toHaveLength(visibleRowCount + 1);
    scan.horizontalMeasurements.filter(measurement => !measurement.isOuter)
      .forEach(measurement => {
      expect(measurement.coverage).toBeGreaterThanOrEqual(1.75);
      expect(measurement.coverage).toBeLessThanOrEqual(2.25);
      });

    if (visibleRowCount > 1) {
      const lastRow = page.locator('.paintable-name[data-axis="row"]:visible').last();
      await lastRow.tap();
      await page.locator('#cellMenu .menu-delete-group').tap();
    }
  }

  const finalOverlay = page.locator('.chart-frame > .table-grid-overlay');
  await expect(finalOverlay).toHaveCount(1);
  expect(await finalOverlay.locator('.table-grid-lines').getAttribute('d')).toBe('');
  await expect(page.locator('#rpsTable')).toHaveAttribute('aria-colcount', '1');
  await expect(page.locator('#rpsTable')).toHaveAttribute('aria-rowcount', '1');
});

test('WebKit exposes no bright fringe beside gray, white, or painted cell borders', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-webkit-table');
  await page.evaluate(() => document.fonts.ready);

  const paintedCell = page.locator('#rpsTable .paintable').first();
  await paintedCell.tap();
  await page.locator('#cellMenu .menu-option').first().tap();
  await page.addStyleTag({
    content: '#rpsTable th, #rpsTable td { color: transparent !important; text-shadow: none !important; }'
  });

  const geometry = await page.evaluate(() => {
    const frame = document.querySelector('.chart-frame');
    const table = document.getElementById('rpsTable');
    const headerRow = table.tHead.rows[0];
    const firstBodyRow = table.tBodies[0].rows[0];
    const grayCell = headerRow.cells[1];
    const whiteCell = firstBodyRow.cells[1];
    const coloredCell = firstBodyRow.cells[2];
    const absoluteRect = element => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2
      };
    };
    const grayRect = absoluteRect(grayCell);
    const whiteRect = absoluteRect(whiteCell);
    const coloredRect = absoluteRect(coloredCell);
    const frameRect = frame.getBoundingClientRect();
    const padding = 2;
    const devicePixelRatio = window.devicePixelRatio;
    const clipLeft = Math.floor(
      (frameRect.left - padding) * devicePixelRatio
    ) / devicePixelRatio;
    const clipTop = Math.floor(
      (frameRect.top - padding) * devicePixelRatio
    ) / devicePixelRatio;
    const clipRight = Math.ceil(
      (frameRect.right + padding) * devicePixelRatio
    ) / devicePixelRatio;
    const clipBottom = Math.ceil(
      (frameRect.bottom + padding) * devicePixelRatio
    ) / devicePixelRatio;
    return {
      devicePixelRatio,
      clip: {
        x: clipLeft,
        y: clipTop,
        width: clipRight - clipLeft,
        height: clipBottom - clipTop
      },
      cases: [
        {
          name: 'gray-gray',
          axis: 'vertical',
          boundaryRatio: grayRect.left,
          fixedRatio: grayRect.centerY
        },
        {
          name: 'gray-white',
          axis: 'horizontal',
          boundaryRatio: whiteRect.top,
          fixedRatio: whiteRect.centerX
        },
        {
          name: 'white-painted',
          axis: 'vertical',
          boundaryRatio: coloredRect.left,
          fixedRatio: coloredRect.centerY
        }
      ]
    };
  });
  const screenshot = await page.screenshot({
    animations: 'disabled',
    clip: geometry.clip,
    scale: 'device'
  });

  const measurements = await page.evaluate(async ({
    source,
    cases,
    clip,
    devicePixelRatio,
    gridRgb
  }) => {
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
    const clampCoordinate = (value, maximum) => Math.max(
      0,
      Math.min(maximum - 1, Math.round(value))
    );
    const pixelAt = (x, y) => {
      const pixel = context.getImageData(x, y, 1, 1).data;
      return [pixel[0], pixel[1], pixel[2]];
    };

    return cases.map(testCase => {
      const centerX = clampCoordinate(
        (
          (testCase.axis === 'vertical' ? testCase.boundaryRatio : testCase.fixedRatio)
          - clip.x
        ) / clip.width * canvas.width,
        canvas.width
      );
      const centerY = clampCoordinate(
        (
          (testCase.axis === 'vertical' ? testCase.fixedRatio : testCase.boundaryRatio)
          - clip.y
        ) / clip.height * canvas.height,
        canvas.height
      );
      const pointAt = offset => pixelAt(
        clampCoordinate(centerX + (testCase.axis === 'vertical' ? offset : 0), canvas.width),
        clampCoordinate(centerY + (testCase.axis === 'horizontal' ? offset : 0), canvas.height)
      );
      const corePixelCount = 1;
      const targetSidePixelCount = 2;
      const targetSampleStart = Math.round(devicePixelRatio * 3);
      const targetSamples = Array.from(
        { length: targetSidePixelCount },
        (_, index) => pointAt(targetSampleStart + index)
      );
      const targetBackground = [0, 1, 2].map(channel => Math.round(
        targetSamples.reduce((sum, pixel) => sum + pixel[channel], 0)
          / targetSamples.length
      ));
      const isClose = (pixel, expected, tolerance) => pixel.every(
        (channel, index) => Math.abs(channel - expected[index]) <= tolerance
      );
      const candidates = [];
      for (let start = -devicePixelRatio; start <= devicePixelRatio; start += 1) {
        const borderPixels = Array.from(
          { length: corePixelCount },
          (_, index) => pointAt(start + index)
        );
        const targetSidePixels = Array.from(
          { length: targetSidePixelCount },
          (_, index) => pointAt(start + corePixelCount + 1 + index)
        );
        if (borderPixels.every(pixel => isClose(pixel, gridRgb, 0))) {
          candidates.push({
            start,
            borderPixels,
            targetSidePixels,
            targetSideMatches: targetSidePixels.every(pixel => (
              isClose(pixel, targetBackground, 3)
            ))
          });
        }
      }
      const match = candidates.find(candidate => candidate.targetSideMatches)
        ?? candidates[0]
        ?? null;

      return {
        name: testCase.name,
        targetBackground,
        corePixelCount,
        targetSidePixelCount,
        match
      };
    });
  }, {
    source: screenshot.toString('base64'),
    cases: geometry.cases,
    clip: geometry.clip,
    devicePixelRatio: geometry.devicePixelRatio,
    gridRgb: GRID_RGB
  });

  expect(geometry.devicePixelRatio).toBe(3);
  expect(measurements.map(measurement => measurement.name)).toEqual([
    'gray-gray',
    'gray-white',
    'white-painted'
  ]);
  measurements.forEach(measurement => {
    expect(measurement.corePixelCount).toBe(1);
    expect(measurement.targetSidePixelCount).toBe(2);
    expect(measurement.match, JSON.stringify(measurement)).not.toBeNull();
    expect(measurement.match.borderPixels).toHaveLength(1);
    expect(measurement.match.targetSidePixels).toHaveLength(2);
    measurement.match.borderPixels.forEach(pixel => {
      expect(pixel).toEqual(GRID_RGB);
    });
    measurement.match.targetSidePixels.forEach(pixel => {
      expectRgbClose(pixel, measurement.targetBackground, 3);
    });
  });
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
    const originalRoundRect = CanvasRenderingContext2D.prototype.roundRect;
    const originalStroke = CanvasRenderingContext2D.prototype.stroke;
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;

    CanvasRenderingContext2D.prototype.beginPath = function beginPath(...args) {
      paths.set(this, { points: [], roundedRects: [] });
      return originalBeginPath.apply(this, args);
    };
    CanvasRenderingContext2D.prototype.moveTo = function moveTo(x, y, ...args) {
      paths.get(this)?.points.push({ x, y });
      return originalMoveTo.apply(this, [x, y, ...args]);
    };
    CanvasRenderingContext2D.prototype.lineTo = function lineTo(x, y, ...args) {
      paths.get(this)?.points.push({ x, y });
      return originalLineTo.apply(this, [x, y, ...args]);
    };
    CanvasRenderingContext2D.prototype.roundRect = function roundRect(
      x,
      y,
      width,
      height,
      radii,
      ...args
    ) {
      paths.get(this)?.roundedRects.push({ x, y, width, height, radii });
      return originalRoundRect.apply(this, [x, y, width, height, radii, ...args]);
    };
    CanvasRenderingContext2D.prototype.stroke = function stroke(...args) {
      const strokeStyle = String(this.strokeStyle);
      if (/^(?:#333333|rgb\(51,\s*51,\s*51\))$/i.test(strokeStyle)) {
        const transform = this.getTransform();
        const path = paths.get(this) ?? { points: [], roundedRects: [] };
        window.__tableStrokeCalls.push({
          lineWidth: this.lineWidth,
          strokeStyle,
          scaleX: transform.a,
          scaleY: transform.d,
          points: [...path.points],
          roundedRects: [...path.roundedRects]
        });
      }
      return originalStroke.apply(this, args);
    };
    HTMLCanvasElement.prototype.toBlob = function toBlob(...args) {
      const context = this.getContext('2d');
      const lastRow = context.getImageData(0, this.height - 1, this.width, 1).data;
      const gridStroke = window.__tableStrokeCalls.find(call => call.points.length > 0);
      const outerStroke = window.__tableStrokeCalls.find(call => call.roundedRects.length > 0);
      const segments = [];
      for (let index = 0; index < (gridStroke?.points.length ?? 0); index += 2) {
        segments.push([gridStroke.points[index], gridStroke.points[index + 1]]);
      }
      const verticalSegments = segments.filter(([start, end]) => start.x === end.x);
      const horizontalSegments = segments.filter(([start, end]) => start.y === end.y);
      const scale = gridStroke?.scaleX ?? outerStroke?.scaleX ?? 1;
      const headerBackground = [99, 99, 102];
      const gridChannel = 51;
      const clampCoordinate = (value, maximum) => Math.max(
        0,
        Math.min(maximum - 1, Math.round(value))
      );
      const pixelAt = (x, y) => {
        const pixel = context.getImageData(x, y, 1, 1).data;
        return [pixel[0], pixel[1], pixel[2]];
      };
      const measureLine = ({ axis, position, fixedPosition }) => {
        const centerPhysical = position * scale;
        const fixedPhysical = fixedPosition * scale;
        const anchor = Math.floor(centerPhysical);
        const fixed = clampCoordinate(fixedPhysical, axis === 'vertical' ? this.height : this.width);
        const radius = Math.ceil(scale * 1.5);
        let opticalInk = 0;
        const samples = [];

        for (let offset = -radius; offset <= radius; offset += 1) {
          const moving = anchor + offset;
          const x = axis === 'vertical'
            ? clampCoordinate(moving, this.width)
            : fixed;
          const y = axis === 'horizontal'
            ? clampCoordinate(moving, this.height)
            : fixed;
          const pixel = pixelAt(x, y);
          const coverage = pixel.reduce((sum, channel, index) => {
            const contrast = headerBackground[index] - gridChannel;
            return sum + Math.max(0, Math.min(
              1,
              (headerBackground[index] - channel) / contrast
            ));
          }, 0) / pixel.length;
          opticalInk += coverage;
          samples.push({ offset, pixel, coverage });
        }
        const inkSamples = samples.filter(sample => sample.coverage > 0.02);
        const opaquePixelCount = samples.filter(sample => (
          sample.pixel.every(channel => channel === gridChannel)
        )).length;

        return {
          centerPhysical,
          opticalCoverageCss: opticalInk / scale,
          inkRunWidth: inkSamples.length === 0
            ? 0
            : inkSamples.at(-1).offset - inkSamples[0].offset + 1,
          opaquePixelCount,
          samples
        };
      };
      let verticalMeasurements = [];
      let horizontalMeasurements = [];
      let outerLeftMeasurement = null;
      const outerRect = outerStroke?.roundedRects[0] ?? null;
      if (outerRect) {
        const halfLineWidth = outerStroke.lineWidth / 2;
        const shellLeft = outerRect.x - halfLineWidth;
        const shellTop = outerRect.y - halfLineWidth;
        const shellRight = outerRect.x + outerRect.width + halfLineWidth;
        const shellBottom = outerRect.y + outerRect.height + halfLineWidth;
        const firstHorizontalY = horizontalSegments[0]?.[0].y ?? shellBottom;
        const firstVerticalX = verticalSegments[0]?.[0].x ?? shellRight;
        const scanY = (shellTop + firstHorizontalY) / 2;
        const scanX = (shellLeft + firstVerticalX) / 2;
        verticalMeasurements = verticalSegments.map(([start]) => measureLine({
          axis: 'vertical',
          position: start.x,
          fixedPosition: scanY
        }));
        horizontalMeasurements = horizontalSegments.map(([start]) => measureLine({
          axis: 'horizontal',
          position: start.y,
          fixedPosition: scanX
        }));
        outerLeftMeasurement = measureLine({
          axis: 'vertical',
          position: outerRect.x,
          fixedPosition: scanY
        });
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
        verticalMeasurements,
        horizontalMeasurements,
        outerRect,
        outerLeftMeasurement
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
      strokes: [...window.__tableStrokeCalls],
      canvas: window.__exportCanvasMetrics.at(-1)
    }));
  };

  const readLiveGrid = () => page.evaluate(() => {
    const table = document.getElementById('rpsTable');
    const shell = document.querySelector('.table-shell');
    const overlay = document.querySelector('.chart-frame > .table-grid-overlay');
    const renderedRows = [...table.tBodies[0].rows].filter(row => !row.hidden);
    const tableCells = [...table.querySelectorAll('th, td')];
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
      rowHeight: renderedRows[0]?.getBoundingClientRect().height ?? 0,
      lineWidths: [...new Set(tableCells.flatMap(cell => {
        const style = getComputedStyle(cell);
        return [
          style.borderTopWidth,
          style.borderRightWidth,
          style.borderBottomWidth,
          style.borderLeftWidth
        ];
      }))],
      overlayStrokeWidths: [...new Set(
        [...overlay.querySelectorAll('[stroke-width]')].map(element => (
          Number(element.getAttribute('stroke-width'))
        ))
      )],
      backgroundClips: [...new Set(
        tableCells.map(cell => getComputedStyle(cell).backgroundClip)
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

  while (await page.locator('.paintable-name[data-axis="column"]').count()) {
    await page.locator('.paintable-name[data-axis="column"]').last().tap();
    await page.locator('#cellMenu .menu-delete-group').tap();
  }
  while (await page.locator('.paintable-name[data-axis="row"]:visible').count()) {
    await page.locator('.paintable-name[data-axis="row"]:visible').last().tap();
    await page.locator('#cellMenu .menu-delete-group').tap();
  }
  const emptyGrid = await readLiveGrid();
  const emptyExport = await captureExportMetrics();

  expect(beforeGrid.backgroundClips).toEqual(['border-box']);
  expect(afterGrid.backgroundClips).toEqual(['border-box']);
  expect(emptyGrid.backgroundClips).toEqual(['border-box']);
  expect(beforeGrid.shellLineWidth).toBe('0px');
  expect(afterGrid.shellLineWidth).toBe('0px');
  expect(emptyGrid.shellLineWidth).toBe('0px');
  expect(beforeGrid.lineWidths).toEqual(['0px']);
  expect(afterGrid.lineWidths).toEqual(beforeGrid.lineWidths);
  expect(emptyGrid.lineWidths).toEqual(beforeGrid.lineWidths);
  [beforeGrid, afterGrid, emptyGrid].forEach(grid => {
    expect(grid.overlayStrokeWidths).toHaveLength(1);
    expect(grid.overlayStrokeWidths[0]).toBeCloseTo(GRID_CSS_WIDTH, 12);
  });
  expect(afterGrid.tableTop).toBeCloseTo(beforeGrid.tableTop, 2);
  expect(afterGrid.shellTop).toBeCloseTo(beforeGrid.shellTop, 2);
  expect(afterGrid.tableBottom).toBeLessThanOrEqual(afterGrid.shellBottom);
  expect(afterGrid.tableBottom).toBeCloseTo(
    beforeGrid.tableBottom - beforeGrid.rowHeight,
    1
  );

  const fractionalPart = value => ((value % 1) + 1) % 1;
  const expectExportCapture = (capture, liveGrid) => {
    const hasInternalLines = (
      liveGrid.visibleColumnCount > 1 || liveGrid.visibleRowCount > 1
    );
    expect(capture.strokes).toHaveLength(hasInternalLines ? 2 : 1);
    capture.strokes.forEach(stroke => {
      expect(stroke.lineWidth).toBeCloseTo(GRID_CSS_WIDTH, 6);
      expect(stroke.strokeStyle).toBe('#333333');
      expect(stroke.scaleX).toBe(EXPORT_PIXEL_RATIO);
      expect(stroke.scaleY).toBe(EXPORT_PIXEL_RATIO);
      expect(stroke.lineWidth * stroke.scaleX).toBeCloseTo(8 / 3, 6);
    });

    const gridStroke = capture.strokes.find(stroke => stroke.points.length > 0);
    expect(Boolean(gridStroke)).toBe(hasInternalLines);
    expect(capture.canvas.verticalSegmentCount).toBe(liveGrid.visibleColumnCount - 1);
    expect(capture.canvas.horizontalSegmentCount).toBe(liveGrid.visibleRowCount - 1);
    expect(capture.canvas.verticalMeasurements).toHaveLength(
      liveGrid.visibleColumnCount - 1
    );
    expect(capture.canvas.horizontalMeasurements).toHaveLength(
      liveGrid.visibleRowCount - 1
    );

    if (gridStroke) {
      for (let index = 0; index < gridStroke.points.length; index += 2) {
        const start = gridStroke.points[index];
        const end = gridStroke.points[index + 1];
        if (start.x === end.x) {
          expect(start.x * gridStroke.scaleX).toBeCloseTo(
            Math.round(start.x * gridStroke.scaleX),
            8
          );
          expect(fractionalPart(start.y * gridStroke.scaleY)).toBeCloseTo(1 / 3, 8);
          expect(fractionalPart(end.y * gridStroke.scaleY)).toBeCloseTo(2 / 3, 8);
        } else {
          expect(start.y * gridStroke.scaleY).toBeCloseTo(
            Math.round(start.y * gridStroke.scaleY),
            8
          );
          expect(fractionalPart(start.x * gridStroke.scaleX)).toBeCloseTo(1 / 3, 8);
          expect(fractionalPart(end.x * gridStroke.scaleX)).toBeCloseTo(2 / 3, 8);
        }
      }
    }

    [
      ...capture.canvas.verticalMeasurements,
      ...capture.canvas.horizontalMeasurements
    ].forEach(measurement => {
      expect(measurement.centerPhysical).toBeCloseTo(
        Math.round(measurement.centerPhysical),
        8
      );
      expect(measurement.opticalCoverageCss).toBeGreaterThanOrEqual(0.63);
      expect(measurement.opticalCoverageCss).toBeLessThanOrEqual(0.70);
      expect(measurement.inkRunWidth).toBe(4);
      expect(measurement.opaquePixelCount).toBe(2);
    });

    const outerStroke = capture.strokes.find(stroke => stroke.roundedRects.length > 0);
    expect(outerStroke).toBeTruthy();
    const outerRect = capture.canvas.outerRect;
    expect(fractionalPart(outerRect.x * outerStroke.scaleX)).toBeCloseTo(1 / 3, 8);
    expect(fractionalPart(outerRect.y * outerStroke.scaleY)).toBeCloseTo(1 / 3, 8);
    expect(fractionalPart(
      (outerRect.x + outerRect.width) * outerStroke.scaleX
    )).toBeCloseTo(2 / 3, 8);
    expect(fractionalPart(
      (outerRect.y + outerRect.height) * outerStroke.scaleY
    )).toBeCloseTo(2 / 3, 8);
    expect(
      capture.canvas.outerLeftMeasurement.opticalCoverageCss
    ).toBeGreaterThanOrEqual(0.63);
    expect(
      capture.canvas.outerLeftMeasurement.opticalCoverageCss
    ).toBeLessThanOrEqual(0.70);
    expect(capture.canvas.outerLeftMeasurement.inkRunWidth).toBe(3);
    expect(capture.canvas.outerLeftMeasurement.opaquePixelCount).toBe(2);
    expect(capture.canvas.lastRowAlphaMin).toBe(255);
    expect(capture.canvas.lastRowAlphaMax).toBe(255);
  };

  for (const [capture, liveGrid] of [
    [beforeExport, beforeGrid],
    [afterExport, afterGrid],
    [emptyExport, emptyGrid]
  ]) {
    expectExportCapture(capture, liveGrid);
  }
  expect(beforeExport.canvas.width).toBe(afterExport.canvas.width);
  expect(beforeExport.canvas.width).toBe(emptyExport.canvas.width);
  expect(beforeExport.canvas.height - afterExport.canvas.height).toBe(159);
  expect(beforeExport.canvas.height - emptyExport.canvas.height).toBe(159 * 5);
});
