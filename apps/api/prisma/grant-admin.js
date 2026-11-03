// Назначить сотрудника платформы (роль PLATFORM_ADMIN) по телефону и задать пароль.
// Запуск в прод-контейнере (после деплоя), напр.:
//   docker compose --env-file .env.prod -f docker-compose.prod.yml exec api node prisma/grant-admin.js +77011234567 МойПароль
// Пользователь создаётся, если его ещё нет. Роль + пароль нужны для входа в веб-админку (/admin).
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

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
  const password = process.argv[3];
  if (password && password.length < 6) { console.error('Пароль — минимум 6 символов.'); process.exit(1); }
  const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.upsert({
      where: { phone },
      update: { platformRole: 'PLATFORM_ADMIN', ...(passwordHash ? { passwordHash } : {}) },
      create: { phone, name: 'Админ платформы', platformRole: 'PLATFORM_ADMIN', ...(passwordHash ? { passwordHash } : {}) },
      select: { id: true, phone: true, platformRole: true },
    });
    console.log('Готово. Сотрудник платформы:', user.phone, '→', user.platformRole, password ? '(пароль установлен)' : '(пароль НЕ задан — укажите вторым аргументом)');
  } catch (e) {
    console.error('Ошибка:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
