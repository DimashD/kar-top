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

  // Демо мастер-товары (для разработки витрины).
  const products = [
    { cat: 'fruits', ru: 'Яблоки Апорт', unit: Unit.KG, stepG: 500, avgPieceG: 220 },
    { cat: 'fruits', ru: 'Хурма Королёк', unit: Unit.KG, stepG: 500, avgPieceG: 280 },
    { cat: 'vegetables', ru: 'Помидоры розовые', unit: Unit.KG, stepG: 500 },
    { cat: 'greens', ru: 'Укроп', unit: Unit.BUNCH },
    { cat: 'meat', ru: 'Говядина (мякоть)', unit: Unit.KG, stepG: 500, perishable: true, storage: 'хранить при 0…+4 °C' },
    { cat: 'dairy', ru: 'Сулугуни', unit: Unit.KG, stepG: 250, perishable: true, storage: 'хранить при +2…+6 °C' },
    { cat: 'korean_salads', ru: 'Морковь по-корейски', unit: Unit.KG, stepG: 250, perishable: true },
  ];
  for (const p of products) {
    await prisma.masterProduct.create({
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
  }

  console.log(`Сид готов: ${CATEGORIES.length} категорий, ${products.length} товаров.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
