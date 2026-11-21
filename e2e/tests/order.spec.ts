import { test, expect } from '@playwright/test';
import { STORE, BUYER_PHONE, OWNER_PHONE, TEST_CODE, apiLogin, watchErrors } from './helpers';

// Полный путь покупателя: магазин → корзина → оформление (самовывоз по умолчанию) →
// вход по коду → заказ принят. После теста заказ отменяется от имени магазина.
test('Покупатель оформляет заказ на самовывоз', async ({ page, request, baseURL }, info) => {
  // Настоящий заказ — только на тестовой среде (на проде нет тестового кода).
  test.skip(!/\/\/(test|localhost)/.test(baseURL ?? ''), 'заказ проверяем только на тестовой среде');
  const errors = watchErrors(page);
  let orderId: string | undefined;

  try {
    await page.goto(`/${STORE}`);
    const addBtn = page.getByRole('button', { name: /В корзину/ }).and(page.locator(':visible')).first();
    await addBtn.click();

    // Открыть корзину: на компьютере — кнопка в правой колонке, на телефоне — плашка снизу.
    if (info.project.name === 'desktop') {
      await page.locator('.dk-cart').getByRole('button', { name: 'Оформить заказ' }).click();
    } else {
      await page.getByRole('button', { name: /Корзина · 1/ }).click();
    }

    // Самовывоз выбран по умолчанию — адрес не спрашиваем.
    await expect(page.getByText('Самовывоз').first()).toBeVisible();
    const submit = page.getByRole('button', { name: 'Оформить заказ' }).and(page.locator(':visible')).last();
    await expect(submit).toBeEnabled();
    await submit.click();

    // Вход по номеру телефона и коду.
    const auth = page.getByRole('dialog', { name: /номер/i });
    await expect(auth).toBeVisible();
    await auth.getByRole('textbox').first().fill(BUYER_PHONE);
    await auth.getByRole('checkbox').check();
    await auth.getByRole('button', { name: /Код по SMS/ }).click();

    const created = page.waitForResponse((r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST');
    await page.getByLabel('Код из SMS').fill(TEST_CODE);
    const res = await created;
    expect(res.status(), 'заказ создан').toBeLessThan(300);
    orderId = (await res.json()).id;

    await expect(page.getByText(/Заказ №\d+ принят/)).toBeVisible();
    expect(errors, 'ошибки в браузере').toEqual([]);
  } finally {
    // Уборка: магазин отменяет тестовый заказ, чтобы он не висел в работе.
    if (orderId) {
      const token = await apiLogin(request, OWNER_PHONE);
      const r = await request.post(`/api/merchant/orders/${orderId}/cancel`, { headers: { authorization: `Bearer ${token}` } });
      expect(r.ok(), `отмена тестового заказа: ${r.status()}`).toBeTruthy();
    }
  }
});
