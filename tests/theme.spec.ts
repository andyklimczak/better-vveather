import { test, expect, type Page } from '@playwright/test';

// UI fixtures only: no real weather, extension storage, or AMO calls.
async function mockExtension(page: Page, empty = false) {
  await page.addInitScript(({ empty }) => {
    const date = '2026-01-12';
    const store: Record<string, unknown> = {
      locations: empty ? [] : [
        { id: 'test-city', name: 'Test City', lat: 40, lon: -74, order: 0 },
        { id: 'test-city-2', name: 'Second City', lat: 41, lon: -73, order: 1 },
      ],
      settings: { tempUnit: 'c', windUnit: 'kph', precipUnit: 'mm', localeDefaulted: false },
      weatherCache: {
        'test-city': {
          fetchedAt: 1768219200000, timezone: 'UTC', weatherCode: 0,
          current: { time: `${date}T12:00`, temperature: 20, apparentTemperature: 19, precipitation: 0, windSpeed: 10, humidity: 50, isDay: true },
          daily: { tempMax: 22, tempMin: 12, sunrise: `${date}T07:00`, sunset: `${date}T17:00` },
          dailyForecast: { time: [date], tempMax: [22], tempMin: [12], weatherCode: [0] },
          hourly: { time: [`${date}T12:00`, `${date}T13:00`], temperature: [20, 21], windSpeed: [10, 12], humidity: [50, 55], precipitation: [0, 1] },
        },
      },
    };
    const api = {
      runtime: { id: 'test-extension', getURL: (path: string) => new URL(path, window.location.href).href, sendMessage: async () => ({}), openOptionsPage: async () => {} },
      storage: {
        local: {
          get: async (key: string) => ({ [key]: store[key] }),
          set: async (values: Record<string, unknown>) => { Object.assign(store, values); },
        },
        onChanged: { addListener: () => {} },
      },
    };
    Object.defineProperty(window, 'browser', { value: api, configurable: true });
    Object.defineProperty(window, 'chrome', { value: api, configurable: true });
  }, { empty });
}

for (const theme of ['light', 'dark'] as const) {
  test(`popup weather, charts, and focus in ${theme} mode`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await mockExtension(page);
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('popup.html');
    await expect(page.locator('#temp-value')).toHaveText('20C');
    await expect(page.locator('html')).toHaveCSS('color-scheme', theme);
    await expect(page.locator('.hero')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(32, 42, 54)' : 'rgb(255, 248, 239)');
    for (const [metric, dark, light] of [
      ['temp', 'rgb(255, 161, 138)', 'rgb(231, 111, 81)'],
      ['wind', 'rgb(109, 211, 196)', 'rgb(42, 157, 143)'],
      ['humidity', 'rgb(165, 180, 255)', 'rgb(76, 110, 245)'],
      ['precip', 'rgb(133, 186, 255)', 'rgb(58, 134, 255)'],
    ]) {
      await page.locator(`[data-metric="${metric}"]`).click();
      await expect(page.locator('#chart-main polyline')).toHaveCSS('stroke', theme === 'dark' ? dark : light);
    }
    await page.locator('#next-btn').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#refresh-btn')).toBeFocused();
    await expect(page.locator('#refresh-btn')).toHaveCSS('outline-style', 'solid');
    await page.locator('#next-btn').click();
    await expect(page.locator('#location-label')).toHaveText('Second City');
    await page.locator('#prev-btn').click();
    await expect(page.locator('#location-label')).toHaveText('Test City');
    expect(errors).toEqual([]);
  });

  test(`empty popup is visible in ${theme} mode`, async ({ page }) => {
    await mockExtension(page, true);
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('popup.html');
    await expect(page.getByRole('button', { name: 'Open Options' })).toBeVisible();
    await expect(page.locator('#popup')).toBeHidden();
    await expect(page.locator('html')).toHaveCSS('color-scheme', theme);
  });

  test(`Options inputs, suggestions, errors, and units in ${theme} mode`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await mockExtension(page);
    await page.route('https://geocoding-api.open-meteo.com/**', (route) => route.fulfill({
      json: { results: [{ id: 1, name: 'Lisbon', country: 'Portugal', latitude: 38.72, longitude: -9.14 }] },
    }));
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('options.html');
    await expect(page.locator('.location-row')).toHaveCount(2);
    await expect(page.locator('html')).toHaveCSS('color-scheme', theme);
    await expect(page.locator('#location-query')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(24, 35, 48)' : 'rgb(255, 255, 255)');
    await page.getByRole('button', { name: 'Add location' }).click();
    await expect(page.locator('#add-error')).toHaveText('Select a location from the suggestions.');
    if (theme === 'dark') await expect(page.locator('#add-error')).toHaveCSS('color', 'rgb(255, 180, 165)');
    await page.locator('#location-query').fill('Lisbon');
    await expect(page.locator('.suggestion')).toHaveText('Lisbon, Portugal');
    await page.locator('.suggestion').click();
    await page.getByRole('button', { name: 'Add location' }).click();
    await expect(page.locator('.location-row')).toHaveCount(3);
    await page.locator('#temp-unit').selectOption('f');
    await expect(page.locator('#temp-unit')).toHaveValue('f');
    expect(errors).toEqual([]);
  });
}

for (const entry of ['popup.html', 'options.html']) {
  test(`${entry} follows appearance changes without reloading`, async ({ page }) => {
    await mockExtension(page);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(entry);
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
    await expect(page.locator('.card').first()).toHaveCSS('background-color', 'rgb(32, 42, 54)');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  });
}
