import { defineConfig, devices } from '@playwright/test';

// Автотесты сайта против живой среды (по умолчанию — тестовой).
// BASE_URL=https://test.kar-top.kz npx playwright test
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'https://test.kar-top.kz',
    locale: 'ru-RU',
    timezoneId: 'Asia/Almaty',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 850 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
});
