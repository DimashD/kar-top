import { OpeningReminders } from './opening-reminders.service';

describe('Напоминания магазинам перед открытием', () => {
  const week9 = Array.from({ length: 7 }, () => ({ open: '09:00', close: '21:00' }));
  const mk = (stores: any[], recent: any[] = []) => {
    const created: any[] = [];
    const prisma: any = {
      store: { findMany: jest.fn(async () => stores) },
      outboxEvent: { findMany: jest.fn(async () => recent), create: jest.fn(async ({ data }: any) => created.push(data)) },
    };
    return { svc: new OpeningReminders(prisma), created };
  };

  it('за час и за 30 минут до открытия — событие для магазина', async () => {
    const { svc, created } = mk([{ id: 's1', hours: week9 }]);
    await svc.run(new Date('2026-11-09T03:00:00Z')); // 08:00 по Алматы
    await svc.run(new Date('2026-11-09T03:30:00Z')); // 08:30
    expect(created.map((c) => c.payload.minutes)).toEqual([60, 30]);
    expect(created[0]).toMatchObject({ type: 'store.update_reminder', aggregateType: 'store', aggregateId: 's1' });
  });

  it('в другое время, в выходной и после открытия — ничего', async () => {
    const off = [null, ...week9.slice(1)];
    const { svc, created } = mk([{ id: 's1', hours: week9 }, { id: 's2', hours: off }]);
    await svc.run(new Date('2026-11-09T03:10:00Z')); // 08:10 — ни 60, ни 30
    await svc.run(new Date('2026-11-09T05:00:00Z')); // 10:00 — уже открыты
    expect(created).toEqual([]);
    const two = mk([{ id: 's2', hours: off }]);
    await two.svc.run(new Date('2026-11-09T03:00:00Z')); // пн у s2 — выходной
    expect(two.created).toEqual([]);
  });

  it('повторный запуск в ту же минуту не шлёт второй раз', async () => {
    const { svc, created } = mk([{ id: 's1', hours: week9 }], [{ aggregateId: 's1', payload: { minutes: 60 } }]);
    expect(await svc.run(new Date('2026-11-09T03:00:00Z'))).toBe(0);
    expect(created).toEqual([]);
  });
});
