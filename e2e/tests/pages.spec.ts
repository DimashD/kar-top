import { test, expect } from '@playwright/test';
import { STORE, watchErrors } from './helpers';

// Каждая страница: открывается, без ошибок в браузере, есть главное содержимое.
const PAGES: { path: string; name: string; expectText: RegExp }[] = [
  { path: '/', name: 'Главная', expectText: /Kartop/i },
  { path: `/${STORE}`, name: 'Магазин', expectText: /В корзину/ },
  { path: `/${STORE}/about`, name: 'О магазине', expectText: /магазин/i },
  { path: '/orders', name: 'Мои заказы', expectText: /заказ/i },
  { path: '/notifications', name: 'Уведомления', expectText: /уведомлен/i },
  { path: '/profile', name: 'Профиль', expectText: /.+/ },
  { path: '/partner', name: 'Для магазинов', expectText: /магазин/i },
  { path: '/tariffs', name: 'Тарифы', expectText: /тариф/i },
  { path: '/terms', name: 'Соглашение', expectText: /соглашени/i },
  { path: '/privacy', name: 'Конфиденциальность', expectText: /персональн/i },
  { path: '/consent', name: 'Согласие на ПДн', expectText: /согласи/i },
  { path: '/merchant-offer', name: 'Оферта', expectText: /оферт/i },
];

for (const p of PAGES) {
  test(`${p.name} (${p.path}) открывается без ошибок`, async ({ page }) => {
    const errors = watchErrors(page);
    const res = await page.goto(p.path);
    expect(res?.status(), 'код ответа').toBeLessThan(400);
    await expect(page.locator('body')).toContainText(p.expectText);
    await page.waitForLoadState('networkidle');
    expect(errors, 'ошибки в браузере').toEqual([]);
  });
}

test('Шапка для компьютера и нижнее меню для телефона', async ({ page }, info) => {
  await page.goto('/');
  if (info.project.name === 'desktop') {
    await expect(page.locator('.site-head')).toBeVisible();
  } else {
    await expect(page.locator('.site-head')).toBeHidden();
    await expect(page.getByRole('link', { name: /Мои заказы|Заказы/ }).first()).toBeVisible();
  }
});

test('В магазине на компьютере видна корзина сбоку и переключатель «Плитка/Список»', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'только для компьютера');
  await page.goto(`/${STORE}`);
  await expect(page.locator('.dk-cart')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Вид' })).toBeVisible();
});

test('Страница не уезжает вбок на телефоне', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'только для телефона');
  for (const path of ['/', `/${STORE}`, '/orders']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `горизонтальная прокрутка на ${path}`).toBeLessThanOrEqual(1);
  }
});
