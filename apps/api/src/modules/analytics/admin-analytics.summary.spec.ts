import { AdminAnalyticsService, periodWhere } from './admin-analytics.service';

const at = (iso: string) => new Date(iso);

describe('Период аналитики', () => {
  it('даты по Алматы (UTC+5), «по» включительно', () => {
    const w = periodWhere({ from: '2026-11-01', to: '2026-11-10' });
    expect(w.createdAt!.gte!.toISOString()).toBe('2026-10-31T19:00:00.000Z');
    expect(w.createdAt!.lt!.toISOString()).toBe('2026-11-10T19:00:00.000Z');
  });
  it('без дат — за всё время; мусор игнорируется', () => {
    expect(periodWhere({})).toEqual({});
    expect(periodWhere({ from: 'abc' })).toEqual({});
  });
});

describe('Сводка за период', () => {
  const orders = [
    { createdAt: at('2026-11-01T05:00:00Z'), status: 'COMPLETED', finalTiyn: 100_000, subtotalTiyn: 90_000, customerId: 'c1', storeId: 's1', fulfillment: 'PICKUP' },
    // 20:00 UTC 1-го = 01:00 2-го по Алматы → попадает во 2 ноября
    { createdAt: at('2026-11-01T20:00:00Z'), status: 'DELIVERED', finalTiyn: null, subtotalTiyn: 50_000, customerId: 'c2', storeId: 's1', fulfillment: 'DELIVERY' },
    { createdAt: at('2026-11-02T06:00:00Z'), status: 'CANCELLED', finalTiyn: 70_000, subtotalTiyn: 70_000, customerId: 'c1', storeId: 's2', fulfillment: 'PICKUP' },
  ];
  const prisma: any = {
    order: { findMany: jest.fn().mockResolvedValue(orders) },
    store: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const svc = new AdminAnalyticsService(prisma);

  it('считает заказы, оборот, чек, клиентов, отмены, самовывоз и дни', async () => {
    const r = await svc.summary({ from: '2026-11-01', to: '2026-11-03' });
    expect(r.totals).toMatchObject({ orders: 2, cancelled: 1, gmvTiyn: 150_000, avgCheckTiyn: 75_000, customers: 2, stores: 1, pickup: 1 });
    expect(r.days).toEqual([
      { date: '2026-11-01', orders: 1, gmvTiyn: 100_000 },
      { date: '2026-11-02', orders: 1, gmvTiyn: 50_000 },
      { date: '2026-11-03', orders: 0, gmvTiyn: 0 },
    ]);
  });

  it('фильтр по магазину и клиенту уходит в запрос', async () => {
    await svc.summary({ from: '2026-11-01' }, 's1', 'c1');
    const where = prisma.order.findMany.mock.calls.at(-1)[0].where;
    expect(where).toMatchObject({ storeId: 's1', customerId: 'c1' });
    expect(where.createdAt.gte).toBeInstanceOf(Date);
  });
});
