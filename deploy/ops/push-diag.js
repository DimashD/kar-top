// Диагностика пушей (запуск в контейнере api через Server ops → push-diagnostics): ключ Firebase есть?
// сколько токенов устройств, последние события outbox и пробная отправка на последний токен каждого пользователя-роли.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  console.log('FIREBASE_SERVICE_ACCOUNT задан:', !!process.env.FIREBASE_SERVICE_ACCOUNT);
  try { const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}'); console.log('project_id:', sa.project_id || '—'); } catch { console.log('FIREBASE_SERVICE_ACCOUNT: не JSON'); }
  const tokens = await prisma.pushToken.findMany({ orderBy: { createdAt: 'desc' }, take: 20, select: { platform: true, createdAt: true, token: true, user: { select: { phone: true, platformRole: true, members: { select: { role: true } } } } } }).catch((e) => { console.log('tokens error', e.message); return []; });
  console.log(`Токенов устройств (последние ${tokens.length}):`);
  for (const t of tokens) console.log(' ', t.createdAt.toISOString(), t.platform, (t.user?.phone || '').slice(0, 5) + '***', t.user?.members?.length ? 'магазин' : 'покупатель', t.token.slice(0, 12) + '…');
  const evs = await prisma.outboxEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 15, select: { type: true, createdAt: true, processedAt: true, attempts: true } });
  console.log('Последние события:');
  for (const e of evs) console.log(' ', e.createdAt.toISOString(), e.type, e.processedAt ? 'обработано' : 'ждёт', 'попыток:', e.attempts);
  await prisma.$disconnect();
})();
