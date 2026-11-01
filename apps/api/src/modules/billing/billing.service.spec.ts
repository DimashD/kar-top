import { BillingService } from './billing.service';

function makeDeps(existingPeriods: Record<string, boolean>) {
  const prisma = {
    subscription: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'sub-a', priceTiyn: 1490000, storeId: 'store-a' },
        { id: 'sub-b', priceTiyn: 1490000, storeId: 'store-b' },
      ]),
    },
    invoice: {
      findUnique: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(existingPeriods[where.subscriptionId_period.subscriptionId] ? { id: 'exists' } : null),
      ),
      create: jest.fn().mockResolvedValue({}),
    },
    outboxEvent: { create: jest.fn().mockResolvedValue({}) },
  };
  const config = { get: jest.fn().mockReturnValue(undefined) }; // KASPI_MERCHANT_ID не задан → заглушка
  return { prisma, config };
}

describe('BillingService.issueMonthlyInvoices', () => {
  it('выставляет счёт каждой активной подписке и эмитит outbox', async () => {
    const { prisma, config } = makeDeps({});
    const svc = new BillingService(prisma as any, config as any);
    const res = await svc.issueMonthlyInvoices(new Date('2026-11-15T00:00:00Z'));

    expect(res).toEqual({ period: '2026-11', created: 2 });
    expect(prisma.invoice.create).toHaveBeenCalledTimes(2);
    expect(prisma.outboxEvent.create).toHaveBeenCalledTimes(2);
    expect(prisma.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'billing.invoice_issued' }) }),
    );
  });

  it('идемпотентно: не дублирует уже выставленный за месяц счёт', async () => {
    const { prisma, config } = makeDeps({ 'sub-a': true }); // у sub-a счёт уже есть
    const svc = new BillingService(prisma as any, config as any);
    const res = await svc.issueMonthlyInvoices(new Date('2026-11-15T00:00:00Z'));

    expect(res.created).toBe(1); // только sub-b
    expect(prisma.invoice.create).toHaveBeenCalledTimes(1);
  });

  it('период считается в UTC как YYYY-MM', async () => {
    const { prisma, config } = makeDeps({});
    const svc = new BillingService(prisma as any, config as any);
    const res = await svc.issueMonthlyInvoices(new Date('2026-01-31T23:59:00Z'));
    expect(res.period).toBe('2026-01');
  });
});
