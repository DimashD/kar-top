import { TariffsService } from './tariffs.service';
import { applicationState } from '../onboarding/onboarding.service';

const DAY = 24 * 3600 * 1000;
const now = new Date('2026-12-01T00:00:00Z');

function mockPrisma(existing: any[]) {
  const created: any[] = [];
  const events: any[] = [];
  return {
    created, events,
    tariff: {
      findMany: jest.fn(async () => [...existing].sort((a, b) => b.effectiveFrom - a.effectiveFrom)),
      count: jest.fn(async () => existing.length),
      create: jest.fn(async ({ data }: any) => { created.push(data); return data; }),
      findUnique: jest.fn(async ({ where }: any) => existing.find((t) => t.id === where.id) ?? null),
      delete: jest.fn(async () => ({})),
    },
    store: { findMany: jest.fn(async () => [{ id: 's1' }, { id: 's2' }]) },
    outboxEvent: { createMany: jest.fn(async ({ data }: any) => { events.push(...data); }) },
  };
}

describe('TariffsService', () => {
  const t = (id: string, days: number) => ({ id, title: id, body: 'x', monthlyFeeTiyn: 100, commissionBp: null, effectiveFrom: new Date(now.getTime() + days * DAY), createdAt: now });

  it('делит тарифы на действующий, будущие и архив', async () => {
    const svc = new TariffsService(mockPrisma([t('old', -60), t('cur', -5), t('next', 40)]) as any);
    const o = await svc.overview(now);
    expect(o.current?.id).toBe('cur');
    expect(o.upcoming.map((x) => x.id)).toEqual(['next']);
    expect(o.archive.map((x) => x.id)).toEqual(['old']);
  });

  it('первый тариф можно ввести сразу, без уведомлений', async () => {
    const p = mockPrisma([]);
    await new TariffsService(p as any).publish('a', { title: 'Старт', body: 'Абонплата', monthlyFeeTiyn: 0, effectiveFrom: now.toISOString() }, now);
    expect(p.created).toHaveLength(1);
    expect(p.events).toHaveLength(0);
  });

  it('новый тариф — не раньше чем через 30 дней', async () => {
    const p = mockPrisma([t('cur', -5)]);
    const svc = new TariffsService(p as any);
    await expect(svc.publish('a', { title: 'Процент', body: '2%', commissionBp: 200, effectiveFrom: new Date(now.getTime() + 10 * DAY).toISOString() }, now)).rejects.toThrow('30 дней');
    await svc.publish('a', { title: 'Процент', body: '2%', commissionBp: 200, effectiveFrom: new Date(now.getTime() + 30 * DAY).toISOString() }, now);
    expect(p.events.map((e) => e.aggregateId)).toEqual(['s1', 's2']);
    expect(p.events[0].type).toBe('tariff.published');
  });

  it('нужна абонплата или процент', async () => {
    const svc = new TariffsService(mockPrisma([]) as any);
    await expect(svc.publish('a', { title: 'Пусто', body: 'x', effectiveFrom: now.toISOString() }, now)).rejects.toThrow('абонплату');
  });

  it('действующий тариф отменить нельзя', async () => {
    const svc = new TariffsService(mockPrisma([t('cur', -5), t('next', 40)]) as any);
    await expect(svc.cancel('cur', now)).rejects.toThrow('уже действует');
    await expect(svc.cancel('next', now)).resolves.toEqual({ ok: true });
  });
});

describe('applicationState', () => {
  it('черновик, на проверке, отклонена, одобрена', () => {
    expect(applicationState('PENDING' as any, null, null)).toBe('DRAFT');
    expect(applicationState('PENDING' as any, new Date(), null)).toBe('SUBMITTED');
    expect(applicationState('PENDING' as any, null, 'нечёткое фото')).toBe('REJECTED');
    expect(applicationState('ACTIVE' as any, null, null)).toBe('APPROVED');
  });
});
