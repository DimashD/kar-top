import { PrismaClient, Unit } from '@prisma/client';

const prisma = new PrismaClient();

// Дерево категорий всего зелёного базара (docs/01 §5a). perishable/coldChain — скоропорт.
const CATEGORIES: { key: string; ru: string; kk?: string; perishable?: boolean; coldChain?: boolean }[] = [
  { key: 'vegetables', ru: 'Овощи', kk: 'Көкөністер' },
  { key: 'fruits', ru: 'Фрукты', kk: 'Жемістер' },
  { key: 'greens', ru: 'Зелень и травы' },
  { key: 'berries', ru: 'Ягоды' },
  { key: 'dried', ru: 'Сухофрукты' },
  { key: 'nuts', ru: 'Орехи и семечки' },
  { key: 'meat', ru: 'Мясо', perishable: true, coldChain: true },
  { key: 'poultry', ru: 'Птица', perishable: true, coldChain: true },
  { key: 'dairy', ru: 'Молочное и сыры', perishable: true, coldChain: true },
  { key: 'korean_salads', ru: 'Корейские салаты', perishable: true },
  { key: 'pickles', ru: 'Соленья и квашеное', perishable: true },
  { key: 'grocery', ru: 'Бакалея' },
  { key: 'eggs', ru: 'Яйца' },
  { key: 'bakery', ru: 'Лепёшки и выпечка' },
];

async function main() {
  const byKey: Record<string, string> = {};
  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = CATEGORIES[i];
    const name = { ru: c.ru, kk: c.kk ?? c.ru, en: c.key };
    const created = await prisma.category.create({
      data: { name, perishable: !!c.perishable, coldChain: !!c.coldChain, sort: i },
    });
    byKey[c.key] = created.id;
  }

  // Демо мастер-товары (для разработки витрины). priceTiyn — цена в тиынах для демо-магазина.
  const products = [
    { cat: 'fruits', ru: 'Яблоки Апорт', unit: Unit.KG, stepG: 500, avgPieceG: 220, priceTiyn: 89000 },
    { cat: 'fruits', ru: 'Хурма Королёк', unit: Unit.KG, stepG: 500, avgPieceG: 280, priceTiyn: 129000 },
    { cat: 'vegetables', ru: 'Помидоры розовые', unit: Unit.KG, stepG: 500, priceTiyn: 119000 },
    { cat: 'greens', ru: 'Укроп', unit: Unit.BUNCH, priceTiyn: 25000 },
    { cat: 'meat', ru: 'Говядина (мякоть)', unit: Unit.KG, stepG: 500, perishable: true, storage: 'хранить при 0…+4 °C', priceTiyn: 320000 },
    { cat: 'dairy', ru: 'Сулугуни', unit: Unit.KG, stepG: 250, perishable: true, storage: 'хранить при +2…+6 °C', priceTiyn: 290000 },
    { cat: 'korean_salads', ru: 'Морковь по-корейски', unit: Unit.KG, stepG: 250, perishable: true, priceTiyn: 90000 },
  ];
  const masterByName: Record<string, { id: string; priceTiyn: number }> = {};
  for (const p of products) {
    const mp = await prisma.masterProduct.create({
      data: {
        categoryId: byKey[p.cat],
        name: { ru: p.ru, kk: p.ru, en: p.ru },
        unit: p.unit,
        stepG: p.stepG ?? null,
        avgPieceG: p.avgPieceG ?? null,
        perishable: !!p.perishable,
        storage: p.storage ?? null,
      },
    });
    masterByName[p.ru] = { id: mp.id, priceTiyn: p.priceTiyn };
  }

  // Демо-магазин для сквозного теста: активен, со своими ценами, зоной и подпиской.
  const store = await prisma.store.create({
    data: {
      slug: 'ruslan-fruits',
      name: 'Фрукты у Руслана',
      status: 'ACTIVE',
      phone: '+77012223344',
      kaspiPhone: '+77012223344',
      address: 'Алматы, Зелёный базар',
      deliveryMode: 'OWN',
      rating: 4.9,
      geom: { type: 'Point', coordinates: [76.9535, 43.2602] }, // Алматы, центр
    },
  });
  for (const ru of Object.keys(masterByName)) {
    await prisma.storeProduct.create({
      data: {
        storeId: store.id,
        masterProductId: masterByName[ru].id,
        priceTiyn: masterByName[ru].priceTiyn,
        inStock: true,
      },
    });
  }
  // Зона доставки вокруг центра Алматы (GeoJSON-полигон).
  await prisma.deliveryZone.create({
    data: {
      storeId: store.id,
      polygon: { rings: [[[76.90, 43.23], [77.00, 43.23], [77.00, 43.29], [76.90, 43.29], [76.90, 43.23]]] },
      feeTiyn: 50000,
      minOrderTiyn: 300000,
      freeFromTiyn: 1000000,
    },
  });
  await prisma.subscription.create({
    data: {
      storeId: store.id,
      plan: 'pro',
      priceTiyn: 1490000,
      status: 'active',
      nextInvoiceAt: new Date(),
    },
  });

  console.log(`Сид готов: ${CATEGORIES.length} категорий, ${products.length} товаров, демо-магазин /${store.slug}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
