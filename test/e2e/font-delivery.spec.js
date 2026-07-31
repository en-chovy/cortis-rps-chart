import { expect, test } from '@playwright/test';

const FONT_CSS_PATH = '/assets/fonts/pretendard/1.3.9/pretendardvariable-dynamic-subset.css';
const FONT_REQUEST_PATTERN = '/assets/fonts/pretendard/1.3.9/woff2-dynamic-subset/';
const INITIAL_FONT_BUDGET = 450 * 1024;
const INITIAL_FONT_DELIVERY_BUDGET = 500 * 1024;

function isFontAssetUrl(url) {
  const pathname = new URL(url).pathname;
  return pathname === FONT_CSS_PATH || pathname.endsWith('.woff2');
}

test('delivers only the required same-origin Pretendard subsets within budget', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  const requests = [];
  const responseTasks = [];
  page.on('request', request => requests.push({
    resourceType: request.resourceType(),
    url: request.url()
  }));
  page.on('response', response => {
    if (!isFontAssetUrl(response.url())) return;
    responseTasks.push((async () => ({
      body: await response.body(),
      contentType: await response.headerValue('content-type'),
      status: response.status(),
      url: response.url()
    }))());
  });

  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  const resources = await Promise.all(responseTasks);
  const fontResources = resources.filter(resource => resource.url.endsWith('.woff2'));
  const fontCss = resources.find(resource => new URL(resource.url).pathname === FONT_CSS_PATH);
  const pageOrigin = new URL(page.url()).origin;
  const fontBytes = fontResources.reduce((total, resource) => total + resource.body.byteLength, 0);
  const fontDeliveryBytes = fontBytes + (fontCss?.body.byteLength ?? 0);
  const networkRequests = requests.filter(request => /^https?:/.test(request.url));
  const fontRequests = networkRequests.filter(request => request.resourceType === 'font');

  expect(fontCss).toBeTruthy();
  expect(fontResources.length).toBeGreaterThan(0);
  expect(fontResources.length).toBeLessThan(92);
  expect(fontBytes).toBeLessThanOrEqual(INITIAL_FONT_BUDGET);
  expect(fontDeliveryBytes).toBeLessThanOrEqual(INITIAL_FONT_DELIVERY_BUDGET);
  expect(networkRequests.every(request => new URL(request.url).origin === pageOrigin)).toBe(true);
  expect(fontRequests.length).toBeGreaterThan(0);
  expect(fontRequests.every(request => (
    new URL(request.url).pathname.startsWith(FONT_REQUEST_PATTERN)
    && /PretendardVariable\.subset\.\d+\.woff2$/.test(new URL(request.url).pathname)
  ))).toBe(true);

  for (const resource of resources) {
    expect(new URL(resource.url).origin).toBe(pageOrigin);
    expect(resource.status).toBe(200);
    if (resource.url.endsWith('.woff2')) {
      expect(resource.url).toContain(FONT_REQUEST_PATTERN);
      expect(resource.url).toMatch(/PretendardVariable\.subset\.\d+\.woff2$/);
      expect(resource.contentType).toContain('font/woff2');
    } else {
      expect(resource.contentType).toContain('text/css');
    }
  }

  const fontState = await page.evaluate(() => ({
    bodyFamily: getComputedStyle(document.body).fontFamily,
    loaded: document.fonts.check('400 16px "Pretendard Variable"', '취향표'),
    loadedFaces: [...document.fonts]
      .filter(face => face.family === 'Pretendard Variable' && face.status === 'loaded')
      .length
  }));
  expect(fontState.bodyFamily.split(',')[0].replaceAll('"', '').trim()).toBe('Pretendard Variable');
  expect(fontState.loaded).toBe(true);
  expect(fontState.loadedFaces).toBeGreaterThan(0);
});

test('keeps the plain modal geometry stable while its local font arrives', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  let holdFonts = true;
  const heldRoutes = [];
  const requestedFontUrls = [];
  await page.route('**/*.woff2', route => {
    requestedFontUrls.push(route.request().url());
    if (holdFonts) {
      heldRoutes.push(route);
      return;
    }
    return route.continue();
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('.btn-add-legend').click();
  const modal = page.locator('#nameModalOverlay .modal');
  const heading = modal.locator('h3');
  await expect(modal).toBeVisible();
  await expect.poll(() => heldRoutes.length).toBeGreaterThan(0);

  const fallbackHeight = await modal.evaluate(element => element.offsetHeight);
  await expect(heading).toHaveCSS('font-weight', '600');
  await expect(heading).not.toHaveCSS('line-height', 'normal');

  holdFonts = false;
  await Promise.all(heldRoutes.splice(0).map(route => route.continue()));
  await page.evaluate(() => document.fonts.ready);
  const pretendardHeight = await modal.evaluate(element => element.offsetHeight);

  expect(Math.abs(pretendardHeight - fallbackHeight)).toBeLessThanOrEqual(1);
  expect(requestedFontUrls.length).toBeGreaterThan(0);
  expect(requestedFontUrls.every(url => (
    url.includes(FONT_REQUEST_PATTERN)
    && /PretendardVariable\.subset\.\d+\.woff2$/.test(url)
  ))).toBe(true);
  expect(requestedFontUrls.some(url => /Pretendard-Bold|\/woff2\/PretendardVariable\.woff2/.test(url))).toBe(false);
});

test('waits for a newly required Hangul subset before exporting an image', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  const targetFileName = 'PretendardVariable.subset.1.woff2';
  let holdTargetFont = false;
  let heldTargetRoute = null;
  const requestedFontUrls = [];
  await page.route('**/*.woff2', route => {
    const url = route.request().url();
    requestedFontUrls.push(url);
    if (holdTargetFont && url.endsWith(targetFileName)) {
      heldTargetRoute = route;
      return;
    }
    return route.continue();
  });

  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  expect(requestedFontUrls.some(url => url.endsWith(targetFileName))).toBe(false);

  holdTargetFont = true;
  await page.locator('.btn-add-legend').click();
  await page.locator('#nameInput').fill('힣');
  await page.locator('#nameModalOverlay .btn-save').click();
  await expect(page.locator('#label-6')).toHaveText('힣');
  await expect.poll(() => heldTargetRoute !== null).toBe(true);

  const downloadPromise = page.waitForEvent('download');
  const saveButton = page.locator('#saveImageButton');
  await saveButton.click();
  await expect(saveButton.locator('span')).toHaveText('이미지 만드는 중…');
  await expect(saveButton).toHaveAttribute('aria-busy', 'true');

  const downloadedWhileBlocked = await Promise.race([
    downloadPromise.then(() => true),
    new Promise(resolve => setTimeout(() => resolve(false), 250))
  ]);
  expect(downloadedWhileBlocked).toBe(false);

  holdTargetFont = false;
  await heldTargetRoute.continue();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const png = Buffer.concat(chunks);

  expect(download.suggestedFilename()).toMatch(/^cortis-rps-chart-\d{4}-\d{2}-\d{2}\.png$/);
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(requestedFontUrls.some(url => url.endsWith(targetFileName))).toBe(true);
});
