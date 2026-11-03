// Удалить тестовые заказы, оформленные на указанный телефон (вместе с позициями,
// событиями, отзывом и outbox-событиями). Аккаунт пользователя НЕ удаляется.
// По умолчанию — только показывает, что найдено. Для реального удаления добавить --yes.
//
//   node prisma/delete-test-orders.js +77011115999          # показать
//   node prisma/delete-test-orders.js +77011115999 --yes    # удалить
const { PrismaClient } = require('@prisma/client');

function normalizePhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  const n = d.startsWith('8') && d.length === 11 ? '7' + d.slice(1) : d;
  if (!/^77\d{9}$/.test(n)) { console.error('Телефон в формате +77XXXXXXXXX. Получено:', raw); process.exit(1); }
  return '+' + n;
}

(async () => {
  const phone = normalizePhone(process.argv[2]);
  const doDelete = process.argv.includes('--yes');
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (!user) { console.log('Пользователь с таким телефоном не найден — удалять нечего.'); return; }

    const orders = await prisma.order.findMany({
      where: { customerId: user.id },
      select: { id: true, number: true, address: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    if (orders.length === 0) { console.log('Заказов на этот телефон нет — удалять нечего.'); return; }

    console.log(`Найдено заказов: ${orders.length}`);
    for (const o of orders) console.log(`  #${o.number}  ${o.createdAt.toISOString()}  адрес: ${JSON.stringify(o.address)}`);

    if (!doDelete) { console.log('\nЭто предпросмотр. Чтобы удалить — запустите ту же команду с флагом --yes'); return; }

    const ids = orders.map((o) => o.id);
    await prisma.$transaction([
      prisma.review.deleteMany({ where: { orderId: { in: ids } } }),
      prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } }),
      prisma.orderEvent.deleteMany({ where: { orderId: { in: ids } } }),
      prisma.outboxEvent.deleteMany({ where: { aggregateType: 'order', aggregateId: { in: ids } } }),
      prisma.order.deleteMany({ where: { id: { in: ids } } }),
    ]);
    console.log(`\nУдалено заказов: ${orders.length}. Аккаунт ${phone} сохранён.`);
  } catch (e) {
    console.error('Ошибка:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
