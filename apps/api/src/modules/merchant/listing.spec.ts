import { MerchantService } from './merchant.service';

// Магазин в памяти + доступ «участник магазина» без проверок.
function setup(initial: Record<string, any> = {}) {
  const row: Record<string, any> = { id: 's1', listed: false, listingRequestedAt: null, pickupEnabled: true, deliveryEnabled: true, hours: null, photoAt: null, ...initial };
  const prisma: any = {
    store: {
      findUnique: jest.fn(async ({ select }: any) => (select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k] ?? null])) : row)),
      update: jest.fn(async ({ data }: any) => Object.assign(row, data)),
    },
  };
  const access: any = { assertMember: jest.fn().mockResolvedValue({ role: 'OWNER' }) };
  return { svc: new MerchantService(prisma, access), row };
}

describe('«Показывать всем покупателям» — заявка магазина, решение за платформой', () => {
  it('включение = заявка: listed не меняется, ставится время заявки; в ответе listingRequested', async () => {
    const { svc, row } = setup();
    const r: any = await svc.updateSettings('s1', 'me', { listed: true } as any);
    expect(row.listed).toBe(false);
    expect(row.listingRequestedAt).toBeInstanceOf(Date);
    expect(r.listingRequested).toBe(true);
  });
  it('повторная заявка не сбрасывает время первой', async () => {
    const first = new Date('2026-11-01T10:00:00Z');
    const { svc, row } = setup({ listingRequestedAt: first });
    await svc.updateSettings('s1', 'me', { listed: true } as any);
    expect(row.listingRequestedAt).toBe(first);
  });
  it('выключение — сразу: listed=false и заявка снята', async () => {
    const { svc, row } = setup({ listed: true, listingRequestedAt: new Date() });
    const r: any = await svc.updateSettings('s1', 'me', { listed: false } as any);
    expect(row.listed).toBe(false);
    expect(row.listingRequestedAt).toBeNull();
    expect(r.listingRequested).toBe(false);
  });
});
