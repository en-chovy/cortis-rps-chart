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
    const header = document.querySelector(
      '.paintable-name[data-axis="column"][data-group-index="0"]'
    );
    return {
      frameWidth: frame.getBoundingClientRect().width,
      tableWidth: tableElement.getBoundingClientRect().width,
      cellWidth: header.getBoundingClientRect().width
    };
  });

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
      tableWidth: tableElement.getBoundingClientRect().width,
      shellWidth: shell.getBoundingClientRect().width,
      rowGeometries,
      scrollWidth: document.scrollingElement.scrollWidth,
      clientWidth: document.scrollingElement.clientWidth
    };
  });

  expect(geometry.frameWidth).toBeCloseTo(
    initialGeometry.frameWidth - initialGeometry.cellWidth,
    1
  );
  expect(geometry.tableWidth).toBeCloseTo(geometry.frameWidth, 1);
  expect(geometry.shellWidth).toBeCloseTo(geometry.frameWidth, 1);
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
