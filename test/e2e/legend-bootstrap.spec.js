import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'cortis-rps-chart:editable-state';
const DEFAULT_NAMES = ['OTP', '좋음', '보통', '스루', '지뢰'];
const DEFAULT_COLORS = [
  'rgba(255, 173, 173, 0.5)',
  'rgba(255, 214, 165, 0.5)',
  'rgba(253, 255, 182, 0.5)',
  'rgba(202, 255, 191, 0.5)',
  'rgba(155, 246, 255, 0.5)'
];

async function createAppGate(page) {
  let releaseRequest;
  let markRequestSeen;
  const requestSeen = new Promise(resolve => {
    markRequestSeen = resolve;
  });
  const released = new Promise(resolve => {
    releaseRequest = resolve;
  });

  await page.route(/\/app\.js(?:\?.*)?$/, async route => {
    markRequestSeen();
    await released;
    await route.continue();
  });

  return {
    release: releaseRequest,
    requestSeen
  };
}

async function seedStorage(page, payload, { captureFrames = false } = {}) {
  await page.addInitScript(({ key, state, shouldCaptureFrames }) => {
    sessionStorage.setItem(key, JSON.stringify(state));
    if (!shouldCaptureFrames) return;

    window.__legendPaintFrames = [];
    let frameCount = 0;
    const sample = () => {
      const wrapper = document.getElementById('legendContainer');
      if (wrapper) {
        const style = getComputedStyle(wrapper);
        const visible = style.display !== 'none'
          && style.visibility !== 'hidden'
          && Number.parseFloat(style.opacity) !== 0;
        window.__legendPaintFrames.push(visible
          ? [...wrapper.querySelectorAll('.editable-label')].map(label => label.textContent)
          : []);
      }
      frameCount += 1;
      if (frameCount < 180) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, {
    key: STORAGE_KEY,
    state: payload,
    shouldCaptureFrames: captureFrames
  });
}

function createStoredState() {
  return {
    version: 1,
    editableState: {
      nextLegendId: 7,
      legends: [
        { id: 1, name: '최애' },
        { id: 6, name: '새 범례' }
      ],
      colors: {
        1: { hex: '#112233', alpha: 0.4 },
        6: { hex: '#445566', alpha: 0.6 }
      },
      cells: Array(20).fill(null)
    }
  };
}

test('shows default legends and colors without the app module or webfonts', async ({ page }) => {
  await page.route(/\/app\.js(?:\?.*)?$/, route => route.abort());
  await page.route('**/*.woff2', route => route.abort());
  await page.goto('/');

  const items = page.locator('#legendContainer .legend-item');
  await expect(items).toHaveCount(5);
  await expect(items.locator('.editable-label')).toHaveText(DEFAULT_NAMES);
  await expect(items.locator('.editable-label').first()).toBeVisible();

  for (let index = 0; index < DEFAULT_COLORS.length; index += 1) {
    await expect(page.locator(`#disp-${index + 1}`))
      .toHaveCSS('background-color', DEFAULT_COLORS[index]);
    await expect(page.locator(`#item-${index + 1} .btn-delete-item`))
      .toHaveAttribute('aria-label', `${DEFAULT_NAMES[index]} 범례 삭제`);
  }

  await expect(page.locator('#legendContainer > :last-child'))
    .toHaveClass(/btn-add-legend/);
});

test('hydrates the initial legends in place without entry motion or duplicates', async ({ page }) => {
  const gate = await createAppGate(page);
  await page.goto('/', { waitUntil: 'commit' });
  await gate.requestSeen;
  await expect(page.locator('#legendContainer .legend-item')).toHaveCount(5);

  await page.evaluate(() => {
    window.__initialLegendNodes = [...document.querySelectorAll('.legend-item')];
    window.__initialLegendNodes.forEach(item => {
      item.dataset.bootstrapIdentity = 'preserve';
    });
  });

  gate.release();
  await page.waitForLoadState('domcontentloaded');

  await expect(page.locator('#legendContainer .legend-item')).toHaveCount(5);
  await expect(page.locator('[data-bootstrap-identity="preserve"]')).toHaveCount(5);
  expect(await page.evaluate(() => (
    window.__initialLegendNodes.every((item, index) => (
      item === document.querySelectorAll('.legend-item')[index]
    ))
  ))).toBe(true);
  await expect(page.locator('.legend-item.is-entering')).toHaveCount(0);
  await expect(page.locator('.legend-item.is-leaving')).toHaveCount(0);
});

test('never paints defaults while restoring a structurally different saved legend set', async ({ page }) => {
  await seedStorage(page, createStoredState(), { captureFrames: true });
  const gate = await createAppGate(page);
  await page.goto('/', { waitUntil: 'commit' });
  await gate.requestSeen;
  const wrapper = page.locator('#legendContainer');
  await expect(wrapper).toHaveCSS('visibility', 'hidden');
  expect(await wrapper.evaluate(element => element.offsetHeight)).toBeGreaterThan(0);
  await expect(wrapper.locator('.editable-label')).toHaveText(DEFAULT_NAMES);
  await expect(wrapper.locator('.editable-label').first()).toBeHidden();

  gate.release();
  await page.waitForLoadState('domcontentloaded');
  await expect(wrapper).toHaveCSS('visibility', 'visible');
  await expect(wrapper.locator('.editable-label')).toHaveText(['최애', '새 범례']);
  await expect(wrapper.locator('.legend-item')).toHaveCount(2);
  await expect(page.locator('#disp-1')).toHaveCSS('background-color', 'rgba(17, 34, 51, 0.4)');
  await expect(page.locator('#disp-6')).toHaveCSS('background-color', 'rgba(68, 85, 102, 0.6)');
  await expect(page.locator('.legend-item.is-entering')).toHaveCount(0);
  await expect(page.locator('.legend-item.is-leaving')).toHaveCount(0);
  await expect(page.locator('#legendContainer > :last-child')).toHaveClass(/btn-add-legend/);
  await expect(page.locator('html')).not.toHaveClass(/is-restoring-chart-state/);

  await expect.poll(() => page.evaluate(() => (
    window.__legendPaintFrames.some(names => names.includes('최애') && names.includes('새 범례'))
  ))).toBe(true);
  const paintedNames = (await page.evaluate(() => window.__legendPaintFrames)).flat();
  expect(paintedNames.some(name => DEFAULT_NAMES.includes(name))).toBe(false);
});

test('reveals static defaults if the app module fails while saved state exists', async ({ page }) => {
  await seedStorage(page, createStoredState());
  await page.route(/\/app\.js(?:\?.*)?$/, route => route.abort());
  await page.goto('/');

  await expect(page.locator('html')).not.toHaveClass(/is-restoring-chart-state/);
  await expect(page.locator('#legendContainer')).toHaveCSS('visibility', 'visible');
  await expect(page.locator('#legendContainer .editable-label')).toHaveText(DEFAULT_NAMES);
});

test('reveals clean defaults after discarding malformed saved data', async ({ page }) => {
  await seedStorage(page, {
    version: 1,
    editableState: { cells: [] }
  });
  await page.goto('/');

  await expect(page.locator('#legendContainer')).toHaveCSS('visibility', 'visible');
  await expect(page.locator('#legendContainer .editable-label')).toHaveText(DEFAULT_NAMES);
  await expect(page.locator('html')).not.toHaveClass(/is-restoring-chart-state/);
  expect(await page.evaluate(key => sessionStorage.getItem(key), STORAGE_KEY)).toBeNull();
});
