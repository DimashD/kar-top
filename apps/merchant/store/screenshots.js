// Скриншоты для Google Play: веб-сборка приложения магазина + тестовая среда (демо-магазин).
// Запускается в CI (.github/workflows/play-store.yml):
//   node apps/merchant/store/screenshots.js <url веб-сборки> <api тестовой среды> <папка для png>
// Вход — телефоном владельца демо-магазина с тестовым кодом 111111 (работает только на staging).
// Размер кадра 1080×1920 (360×640 @3x) — подходит под требования Google Play (стороны ≤ 2:1).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [APP, API, OUT] = process.argv.slice(2);
const PHONE = process.env.SHOT_PHONE || '+77011115999';
const CODE = process.env.SHOT_CODE || '111111';
const SLUG = process.env.SHOT_STORE || 'ruslan-fruits';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Несколько заказов в демо-магазине, чтобы экран «Заказы» не был пустым. */
async function seedOrders() {
  const r = await fetch(`${API}/shops/${SLUG}/catalog`);
  if (!r.ok) throw new Error(`catalog ${r.status}`);
  const cat = await r.json();
  const items = cat.categories.flatMap((c) => c.items);
  const pick = (i) => items[i % items.length];
  const line = (p, n) => (p.unit === 'KG' || p.unit === 'G' ? { storeProductId: p.id, qtyG: 1000 * n } : { storeProductId: p.id, qty: n });
  const orders = [
    { phone: '+77011111111', addr: 'ул. Абая, 52, кв. 14', lines: [line(pick(0), 2), line(pick(9), 1), line(pick(21), 1)] },
    { phone: '+77012222222', addr: 'пр. Достык, 105', lines: [line(pick(3), 1), line(pick(40), 2)] },
    { phone: '+77013333333', addr: 'мкр. Самал-2, 33', lines: [line(pick(60), 1), line(pick(77), 3), line(pick(90), 1), line(pick(101), 1)] },
  ];
  for (const o of orders) {
    const res = await fetch(`${API}/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        storeSlug: SLUG, phone: o.phone, payMethod: 'CASH', fulfillment: 'DELIVERY',
        items: o.lines, address: { line: o.addr, lat: 43.24, lng: 76.95 },
      }),
    });
    console.log(`заказ ${o.phone}: ${res.status}`);
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  try { await seedOrders(); } catch (e) { console.warn('Заказы не созданы:', e.message); }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, locale: 'ru-RU', isMobile: true, hasTouch: true });
  page.on('console', (m) => { if (m.type() === 'error') console.log('[app]', m.text()); });
  let n = 0;
  const shot = async (name, num) => {
    await page.mouse.move(2, 2); // убрать «наведение» с карточек
    await sleep(1500);
    const f = path.join(OUT, `${num || ++n}_${name}.png`);
    await page.screenshot({ path: f });
    console.log('📸', f);
  };
  const debug = async (name) => page.screenshot({ path: path.join(OUT, `debug_${name}.png`) }).catch(() => {});

  // Flutter web: включаем дерево доступности, чтобы находить поля и кнопки по тексту.
  const enableSemantics = async () => {
    await page.evaluate(() => {
      const p = document.querySelector('flt-semantics-placeholder');
      if (p) p.click();
    });
    await sleep(800);
  };
  const tapText = async (text, opts = {}) => {
    const loc = page.getByRole('button', { name: text, exact: !!opts.exact }).or(page.getByText(text, { exact: !!opts.exact })).first();
    await loc.waitFor({ timeout: opts.timeout || 20000 });
    await loc.click();
  };
  // Поле ввода: index — номер поля, 'last' — последнее. Содержимое заменяется целиком (в поле телефона уже есть «+7»).
  const typeInto = async (index, value) => {
    const all = page.getByRole('textbox');
    const box = index === 'last' ? all.last() : all.nth(index);
    await box.waitFor({ timeout: 20000 });
    await box.click();
    await sleep(300);
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(value, { delay: 40 });
  };

  try {
    await page.goto(APP, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForSelector('flutter-view, flt-glass-pane', { timeout: 60000 });
    await sleep(3000);
    await enableSemantics();

    // 1. Вход
    await typeInto(0, PHONE);
    await shot('login', 9); // экран входа — последним
    await tapText('Получить код');
    await sleep(2000);
    await typeInto('last', CODE);
    await tapText('Войти', { exact: true });
    await sleep(4000);
    await enableSemantics();

    // 2. Выбор магазина (если их несколько) → главный экран
    try { await tapText('Руслана', { timeout: 8000 }); await sleep(3000); } catch { /* сразу главный экран */ }
    await enableSemantics();
    await shot('orders');

    // 3. Карточка нового заказа → принять → экран сборки (взвешивание)
    try {
      await tapText('№', { timeout: 8000 });
      await sleep(2500);
      await shot('order');
      try {
        await tapText('Принять заказ', { timeout: 8000 });
        await sleep(3000);
        await enableSemantics();
        await shot('picking');
      } catch (e) { console.warn('принять:', e.message); await debug('picking'); }
      await page.goBack().catch(() => {});
      await sleep(2000);
      await enableSemantics();
    } catch (e) { console.warn('карточка заказа:', e.message); await debug('order'); }

    // 4. Вкладки нижнего меню — по координатам (360×640: высота меню ~56 px, 3 вкладки по 120 px).
    const tab = async (i) => { await page.mouse.click(60 + 120 * i, 640 - 28); await sleep(2500); };
    try { await tab(1); await shot('catalog'); } catch (e) { console.warn('товары:', e.message); await debug('catalog'); }
    try { await tab(2); await shot('settings'); } catch (e) { console.warn('настройки:', e.message); await debug('settings'); }
  } catch (e) {
    console.error('Ошибка сценария:', e.message);
    await debug('fail');
  } finally {
    await browser.close();
  }
  const pngs = fs.readdirSync(OUT).filter((f) => /^\d+_.*\.png$/.test(f));
  console.log(`Готово: ${pngs.length} скриншотов`);
  if (pngs.length < 2) process.exit(1); // Google Play требует минимум 2
}

main();
