// Наполнение мастер-каталога Kartop (категории + товары). Идемпотентно:
// повторный запуск не создаёт дубликаты (проверка по названию ru).
// Запуск в прод-контейнере:
//   docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T api node prisma/seed-catalog.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// u — единица по умолчанию для категории. Товар: строка (берёт u) или {n, u, step, avg}.
// step — шаг взвешивания (г) для весовых; avg — ≈ вес 1 шт (г) для штучных.
const DATA = [
  { cat: 'Цитрусовые', perishable: true, u: 'KG', step: 500, items: [
    'Лимон Ташкентский', 'Лимон Египет', 'Лимон Турция', 'Лимон Китай', 'Лайм',
    'Мандарины Турция', 'Мандарины Марокко', 'Мандарины Китай',
    'Апельсины Турция', 'Апельсины Иран (красные)', 'Апельсины Иран (белые)', 'Апельсины Китай', 'Грейпфрут',
  ]},
  { cat: 'Яблоки', perishable: true, u: 'KG', step: 500, items: [
    'Кандиль', 'Голден (Золотое превосходное)', 'Американка', 'Айдаред', 'Грэнни Смит',
    'Пеструшка', 'Белый налив', 'Столовка', 'Лимонка',
  ]},
  { cat: 'Виноград', perishable: true, u: 'KG', step: 500, items: [
    'Жемчуг (Узбекистан)', 'Кишмиш (Узбекистан)', 'Тойфи (Узбекистан)', 'Ризамат (Узбекистан)',
    'Хусайне (Узбекистан)', 'Мерседес (Узбекистан)', 'Дамские пальчики (Узбекистан)',
  ]},
  { cat: 'Томаты', perishable: true, u: 'KG', step: 500, items: [
    'Бычье сердце', 'Черри на веточке', 'Ташкент', 'Чёрный принц', 'Жёлтые сливки',
    'Черри (Китай)', 'Сливки на веточке', 'Розовые Nac Agro', 'Розовые', 'ЛСТ (теплица)', 'Чёрные черри',
  ]},
  { cat: 'Огурцы', perishable: true, u: 'KG', step: 500, items: [
    'Равва', 'Корнишоны Nac Agro', 'Корнишоны грунтовые',
  ]},
  { cat: 'Бананы', perishable: true, u: 'KG', step: 500, items: ['Бананы мини', 'Бананы Эквадор'] },
  { cat: 'Авокадо', perishable: true, u: 'PCS', items: [
    { n: 'Хас Перу', avg: 200 }, { n: 'Хас Израиль', avg: 200 }, { n: 'Хас Китай', avg: 200 },
    { n: 'Хас ЮАР', avg: 200 }, { n: 'Зелёный Перу', avg: 250 },
  ]},
  { cat: 'Ананасы', perishable: true, u: 'PCS', items: [
    { n: 'Коста-Рика Голд', avg: 1300 }, { n: 'Китай', avg: 1300 },
    { n: 'Мини (Китай)', avg: 450 }, { n: 'Мини (ЮАР)', avg: 450 },
  ]},
  { cat: 'Гранаты', perishable: true, u: 'KG', step: 500, items: ['Ташкент', 'Китай', 'Чили'] },
  { cat: 'Манго', perishable: true, u: 'KG', step: 500, items: [
    'Тайланд', 'Китай', 'Египет', { n: 'Мини манго (Китай)', u: 'PCS', avg: 150 },
  ]},
  { cat: 'Киви', perishable: true, u: 'KG', step: 500, items: [
    { n: 'Киви (пачка)', u: 'PACK' }, { n: 'Киви (шт)', u: 'PCS', avg: 90 },
  ]},
  { cat: 'Ягоды', perishable: true, coldChain: true, u: 'PACK', items: [
    'Голубика (Китай)', 'Голубика (Перу)', 'Клубника', 'Малина', 'Ежевика',
  ]},
  { cat: 'Финики и сухофрукты', u: 'KG', step: 250, items: [
    'Финики Королевские', 'Финики Аджва', 'Финики Тунис', 'Финики Иран',
    'Курага', 'Чернослив', 'Изюм', 'Инжир сушёный',
  ]},
  { cat: 'Овощи', perishable: true, u: 'KG', step: 500, items: [
    'Дайкон', 'Басай', 'Лук порей', 'Баклажан', 'Кабачок', 'Перец чили', 'Редис',
    'Чесночные стрелки', 'Брокколи', 'Цветная капуста', 'Перец полугорький',
    'Стебель сельдерея', 'Перец светофор', 'Перец ласточка', 'Спаржа', 'Капуста',
    'Тыква американка', 'Тыква японка',
  ]},
  { cat: 'Корнеплоды', u: 'KG', step: 500, items: [
    'Картофель', 'Картофель молодой', 'Картофель бэйби', 'Морковь', 'Морковь жёлтая', 'Морковь бэйби',
    'Батат', 'Лук репчатый', 'Лук красный', 'Лук белый', 'Свёкла', 'Редька', 'Чеснок',
  ]},
  { cat: 'Зелень и салаты', perishable: true, u: 'BUNCH', items: [
    'Мята', 'Щавель', 'Укроп', 'Кинза', 'Петрушка', 'Зелёный лук', 'Жусай', 'Сельдерей (листовой)',
    { n: 'Руккола', u: 'PACK' }, { n: 'Шпинат', u: 'PACK' }, { n: 'Розмарин', u: 'PACK' },
    { n: 'Тимьян', u: 'PACK' }, { n: 'Листья салата', u: 'PACK' },
    { n: 'Айсберг', u: 'PCS', avg: 400 }, { n: 'Салат романо', u: 'PCS', avg: 300 },
  ]},
  { cat: 'Грибы', perishable: true, coldChain: true, u: 'KG', step: 250, items: [
    'Шампиньоны', 'Вёшенки', { n: 'Грибы эноки', u: 'PACK' }, { n: 'Шиитаке', u: 'PACK' },
  ]},
  { cat: 'Молочная продукция', perishable: true, coldChain: true, u: 'PACK', items: [
    'Молоко', 'Кефир', 'Айран', 'Ряженка', 'Катык', 'Йогурт', 'Сливки',
    { n: 'Сметана', u: 'KG', step: 250 }, { n: 'Творог', u: 'KG', step: 250 },
    { n: 'Сыр', u: 'KG', step: 250 }, { n: 'Масло сливочное', u: 'KG', step: 250 }, { n: 'Курт', u: 'KG', step: 250 },
  ]},
  { cat: 'Яйца', perishable: true, coldChain: true, u: 'PACK', items: ['Яйцо куриное C1', 'Яйцо куриное C0', 'Яйцо перепелиное'] },
  { cat: 'Мясо и птица', perishable: true, coldChain: true, u: 'KG', step: 500, items: [
    'Говядина', 'Баранина', 'Конина', 'Курица', 'Индейка', 'Фарш говяжий', 'Фарш смешанный',
    'Печень говяжья', 'Казы (конская колбаса)', 'Субпродукты',
  ]},
];

async function findCategory(ru) {
  return prisma.category.findFirst({ where: { name: { path: ['ru'], equals: ru } }, select: { id: true } });
}
async function findProduct(categoryId, ru) {
  return prisma.masterProduct.findFirst({ where: { categoryId, name: { path: ['ru'], equals: ru } }, select: { id: true } });
}

(async () => {
  let cCreated = 0, pCreated = 0, pSkipped = 0;
  try {
    for (let i = 0; i < DATA.length; i++) {
      const g = DATA[i];
      let cat = await findCategory(g.cat);
      if (!cat) {
        cat = await prisma.category.create({
          data: { name: { ru: g.cat }, perishable: !!g.perishable, coldChain: !!g.coldChain, sort: i },
          select: { id: true },
        });
        cCreated++;
      }
      for (const raw of g.items) {
        const it = typeof raw === 'string' ? { n: raw } : raw;
        const unit = it.u || g.u || 'KG';
        if (await findProduct(cat.id, it.n)) { pSkipped++; continue; }
        await prisma.masterProduct.create({
          data: {
            categoryId: cat.id,
            name: { ru: it.n },
            unit,
            stepG: unit === 'KG' || unit === 'G' ? (it.step || g.step || 500) : null,
            avgPieceG: unit === 'PCS' ? (it.avg || null) : null,
            perishable: !!g.perishable,
            storage: g.coldChain ? 'Хранить в холоде' : null,
          },
        });
        pCreated++;
      }
    }
    console.log(`Готово. Категорий создано: ${cCreated}. Товаров создано: ${pCreated}, пропущено (уже были): ${pSkipped}.`);
  } catch (e) {
    console.error('Ошибка:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
