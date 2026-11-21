import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const STORE = process.env.E2E_STORE || 'ruslan-fruits';
// Тестовые номера тестовой среды: код подтверждения там всегда 111111.
export const BUYER_PHONE = '+77009990011';
export const OWNER_PHONE = '+77011115999';
export const TEST_CODE = '111111';

/** Собирает ошибки страницы: падения скриптов и ошибки в консоли (в т.ч. гидрация React). */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    // Недоступная картинка или счётчик — не поломка сайта.
    if (/Failed to load resource/i.test(text)) return;
    errors.push(`console: ${text}`);
  });
  return errors;
}

/** Вход по номеру через API (тестовый код) — для служебных действий в тестах. */
export async function apiLogin(request: APIRequestContext, phone: string): Promise<string> {
  const r1 = await request.post('/api/auth/otp/request', { data: { phone, channel: 'sms' } });
  expect(r1.ok(), `запрос кода: ${r1.status()}`).toBeTruthy();
  const r2 = await request.post('/api/auth/otp/verify', { data: { phone, code: TEST_CODE } });
  expect(r2.ok(), `проверка кода: ${r2.status()}`).toBeTruthy();
  const body = await r2.json();
  const token = body.access ?? body.accessToken;
  expect(token, 'токен входа').toBeTruthy();
  return token;
}
