import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: { viewport: { width: 440, height: 900 } },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', baseURL: 'http://127.0.0.1:4173/' } },
    { name: 'firefox', use: { browserName: 'firefox', baseURL: 'http://127.0.0.1:4174/' } },
  ],
  webServer: {
    command: 'node tests/server.mjs',
    url: 'http://127.0.0.1:4173/popup.html',
    reuseExistingServer: false,
  },
});
