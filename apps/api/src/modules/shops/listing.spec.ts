import { ListingService, listingState, visibleNow, trialDays } from './listing';

const NOW = new Date('2026-11-15T10:00:00Z');
const day = (n: number) => new Date(NOW.getTime() + n * 86400e3);

function setup(initial: Record<string, any> = {}) {
  const row: Record<string, any> = { id: 's1', listed: false, listedFreeUntil: null, listedPaidUntil: null, listingRequestedAt: null, listingPriceTiyn: null, listingReminder: null, ...initial };
  const events: any[] = [];
  const prisma: any = {
    store: {
      findUnique: jest.fn(async () => ({ ...row })),
      findMany: jest.fn(async () => [{ ...row }]),
      update: jest.fn(async ({ data }: any) => Object.assign(row, data)),
    },
    outboxEvent: { create: jest.fn(async ({ data }: any) => events.push(data)) },
  };
  return { svc: new ListingService(prisma), row, events };
}

describe('Показ всем: бесплатный период → подписка', () => {
  it('по умолчанию бесплатный период — 60 дней (LISTING_TRIAL_DAYS)', () => {
    const old = process.env.LISTING_TRIAL_DAYS;
    delete process.env.LISTING_TRIAL_DAYS;
    expect(trialDays()).toBe(60);
    process.env.LISTING_TRIAL_DAYS = '30';
    expect(trialDays()).toBe(30);
    process.env.LISTING_TRIAL_DAYS = old;
  });

  it('одобрение: виден всем, бесплатно до now+дни, заявка закрыта', async () => {
    const { svc, row } = setup({ listingRequestedAt: day(-1) });
    const st = await svc.approve('s1', 30, NOW);
    expect(row.listedFreeUntil).toEqual(day(30));
    expect(st).toMatchObject({ listed: true, listingFree: true, listingRequested: false, listedUntil: day(30).toISOString() });
  });

  it('бесплатный период кончился и нет оплаты → снова только по ссылке (listingExpired)', () => {
    const s = { listed: true, listedFreeUntil: day(-1), listedPaidUntil: null, listingRequestedAt: null, listingPriceTiyn: 500000 };
    expect(visibleNow(s, NOW)).toBe(false);
    expect(listingState(s, NOW)).toMatchObject({ listed: false, listingExpired: true, listingPriceTiyn: 500000 });
  });

  it('оплата +1 месяц считается от конца бесплатного периода, если он ещё идёт', async () => {
    const { svc, row } = setup({ listed: true, listedFreeUntil: day(10) });
    const st = await svc.markPaid('s1', 1, NOW);
    const expected = new Date(day(10)); expected.setMonth(expected.getMonth() + 1);
    expect(row.listedPaidUntil).toEqual(expected);
    expect(st).toMatchObject({ listed: true, listingFree: false });
  });

  it('оплата после окончания — от сегодня', async () => {
    const { svc, row } = setup({ listed: true, listedFreeUntil: day(-5) });
    await svc.markPaid('s1', 2, NOW);
    const expected = new Date(NOW); expected.setMonth(expected.getMonth() + 2);
    expect(row.listedPaidUntil).toEqual(expected);
  });

  it('напоминания: за 7 дней одно (без повторов), затем за день, затем «закончился»', async () => {
    const { svc, row, events } = setup({ listed: true, listedFreeUntil: day(6), listingPriceTiyn: 500000 });
    await svc.remind(NOW);
    await svc.remind(NOW); // повтор — не шлём
    expect(events.map((e) => e.type)).toEqual(['store.listing_ending']);
    expect(events[0].payload).toMatchObject({ daysLeft: 6, free: true, priceTiyn: 500000 });
    await svc.remind(day(5.5));
    expect(events.map((e) => e.type)).toEqual(['store.listing_ending', 'store.listing_ending']);
    await svc.remind(day(6.1));
    expect(events.map((e) => e.type)).toEqual(['store.listing_ending', 'store.listing_ending', 'store.listing_ended']);
    expect(row.listingReminder).toMatch(/^ended:/);
  });
});
