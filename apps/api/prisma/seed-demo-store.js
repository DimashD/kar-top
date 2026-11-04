// Демо-магазин для ТЕСТОВОЙ среды: активная витрина с товарами из мастер-каталога, зоной доставки
// и владельцем (чтобы войти в приложение магазина кодом 111111).
// Идемпотентно: повторный запуск ничего не дублирует, только добавляет недостающие товары.
// На проде НЕ запускается (защита по APP_ENV).
// Запуск (после seed-catalog.js):
//   docker compose -p kartop-staging --env-file .env.staging -f docker-compose.staging.yml \
//     exec -T staging-api node prisma/seed-demo-store.js +77011234567
const { PrismaClient } = require('@prisma/client');

// Тот же адрес, что у кнопок «Открыть витрину» на главной (apps/web/app/page.tsx).
const SLUG = 'ruslan-fruits';
const OLD_SLUGS = ['demo']; // ранние запуски создавали /demo — переименовываем
const PER_CATEGORY = 8; // сколько товаров каждой категории выставить в демо-магазин

function normalizePhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  const n = d.startsWith('8') && d.length === 11 ? '7' + d.slice(1) : d;
  return /^77\d{9}$/.test(n) ? '+' + n : null;
}

// Детерминированная «цена» по названию — чтобы при повторном запуске цены не прыгали.
function priceFor(name, unit) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [min, max] = unit === 'KG' || unit === 'G' ? [60000, 350000] : unit === 'BUNCH' ? [15000, 40000] : [20000, 150000];
  return Math.round((min + (h % (max - min))) / 1000) * 1000; // кратно 10 ₸
}

(async () => {
  if (process.env.APP_ENV !== 'staging') {
    console.error(`Отказ: демо-магазин создаётся только в тестовой среде (APP_ENV=${process.env.APP_ENV || 'не задан'}).`);
    process.exit(1);
  }
  const ownerPhone = normalizePhone(process.argv[2]);
  const prisma = new PrismaClient();
  try {
    let store = await prisma.store.findUnique({ where: { slug: SLUG } });
    if (!store) {
      const old = await prisma.store.findFirst({ where: { slug: { in: OLD_SLUGS } } });
      if (old) {
        store = await prisma.store.update({ where: { id: old.id }, data: { slug: SLUG } });
        console.log(`Магазин /${old.slug} переименован в /${SLUG}`);
      }
    }
    if (!store) {
      store = await prisma.store.create({
        data: {
          slug: SLUG,
          name: 'Демо-магазин (тест)',
          status: 'ACTIVE',
          phone: '+77010000000',
          kaspiPhone: '+77010000000',
          address: 'Алматы, Зелёный базар (тест)',
          deliveryMode: 'OWN',
          rating: 4.8,
          geom: { type: 'Point', coordinates: [76.9535, 43.2602] },
        },
      });
      await prisma.deliveryZone.create({
        data: {
          storeId: store.id,
          polygon: { rings: [[[76.80, 43.15], [77.10, 43.15], [77.10, 43.35], [76.80, 43.35], [76.80, 43.15]]] },
          feeTiyn: 50000,
          minOrderTiyn: 200000,
          freeFromTiyn: 1000000,
        },
      });
      await prisma.subscription.create({
        data: { storeId: store.id, plan: 'pro', priceTiyn: 0, status: 'active', nextInvoiceAt: null },
      });
      console.log(`Создан магазин /${SLUG}`);
    } else {
      console.log(`Магазин /${SLUG} уже есть — дополняю товары`);
    }

    const categories = await prisma.category.findMany({ select: { id: true }, orderBy: { sort: 'asc' } });
    if (!categories.length) {
      console.error('Мастер-каталог пуст — сначала запустите seed-catalog.js');
      process.exit(1);
    }
    const existing = new Set(
      (await prisma.storeProduct.findMany({ where: { storeId: store.id }, select: { masterProductId: true } }))
        .map((p) => p.masterProductId),
    );
    let added = 0;
    for (const c of categories) {
      const products = await prisma.masterProduct.findMany({
        where: { categoryId: c.id },
        take: PER_CATEGORY,
        orderBy: { id: 'asc' },
        select: { id: true, name: true, unit: true },
      });
      for (const p of products) {
        if (existing.has(p.id)) continue;
        const ru = (p.name && p.name.ru) || p.id;
        const priceTiyn = priceFor(ru, p.unit);
        await prisma.storeProduct.create({
          data: {
            storeId: store.id,
            masterProductId: p.id,
            priceTiyn,
            // каждый 5-й товар — «акция», чтобы было что проверить на витрине
            oldPriceTiyn: added % 5 === 0 ? Math.round(priceTiyn * 1.2 / 1000) * 1000 : null,
            inStock: true,
          },
        });
        added++;
      }
    }
    console.log(`Товаров добавлено: ${added} (всего в магазине: ${existing.size + added})`);

    if (ownerPhone) {
      const user = await prisma.user.upsert({
        where: { phone: ownerPhone },
        update: {},
        create: { phone: ownerPhone, name: 'Владелец демо-магазина' },
      });
      await prisma.storeMember.upsert({
        where: { storeId_userId: { storeId: store.id, userId: user.id } },
        update: { role: 'OWNER' },
        create: { storeId: store.id, userId: user.id, role: 'OWNER' },
      });
      console.log(`Владелец: ${ownerPhone} (вход в приложение «Kartop ТЕСТ» кодом 111111)`);
    }
    console.log(`Готово. Витрина: https://test.kar-top.kz/${SLUG}`);
  } catch (e) {
    console.error('Ошибка:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
