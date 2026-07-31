import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } } },
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 629 },
        screen: { width: 375, height: 812 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true
      }
    },
    {
      name: 'mobile-webkit-bootstrap',
      testMatch: /legend-bootstrap\.spec\.js/,
      use: {
        browserName: 'webkit',
        viewport: { width: 375, height: 629 },
        screen: { width: 375, height: 812 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true
      }
    }
  ],
  webServer: {
    command: 'python3 -m http.server 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true
  }
});
