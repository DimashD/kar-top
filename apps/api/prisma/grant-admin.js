// Назначить сотрудника платформы (роль PLATFORM_ADMIN) по телефону.
// Запуск в прод-контейнере (после деплоя), напр.:
//   docker compose --env-file .env.prod -f docker-compose.prod.yml exec api node prisma/grant-admin.js +77011234567
// Пользователь создаётся, если его ещё нет. Роль нужна для входа в веб-админку (/admin/partners).
const { PrismaClient } = require('@prisma/client');

function normalizePhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  const n = d.startsWith('8') && d.length === 11 ? '7' + d.slice(1) : d;
  if (!/^77\d{9}$/.test(n)) {
    console.error('Телефон в формате +77XXXXXXXXX. Получено:', raw);
    process.exit(1);
  }
  return '+' + n;
}

(async () => {
  const phone = normalizePhone(process.argv[2]);
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.upsert({
      where: { phone },
      update: { platformRole: 'PLATFORM_ADMIN' },
      create: { phone, name: 'Админ платформы', platformRole: 'PLATFORM_ADMIN' },
      select: { id: true, phone: true, platformRole: true },
    });
    console.log('Готово. Сотрудник платформы:', user.phone, '→', user.platformRole);
  } catch (e) {
    console.error('Ошибка:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
