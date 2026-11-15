import { ShopsService } from './shops.service';

// Квадрат ~2 км вокруг точки [76.95, 43.26].
const square = { type: 'Polygon', kind: 'polygon', coordinates: [[[76.94, 43.25], [76.96, 43.25], [76.96, 43.27], [76.94, 43.27], [76.94, 43.25]]] };
const store = (over: Record<string, unknown>) => ({
  slug: 's', name: 'S', address: null, rating: 5, reviewCount: 0, photoAt: null, geom: null, hours: null,
  deliveryEnabled: true, pickupEnabled: true, deliveryMode: 'BOTH',
  zones: [{ polygon: square, feeTiyn: 50000, minOrderTiyn: 200000, freeFromTiyn: 1500000 }], ...over,
});
const svc = (stores: unknown[]) => new ShopsService({ store: { findMany: jest.fn().mockResolvedValue(stores) } } as any);

describe('Список магазинов: виды доставки', () => {
  it('без точки покупателя: видно, какие доставки есть, но «довезёт ли сюда» неизвестно', async () => {
    const [s] = await svc([store({})]).list();
    expect(s).toMatchObject({ ownDelivery: true, courierDelivery: true, pickupEnabled: true, ownHere: null, ownZone: null });
    expect((s as any).zones).toBeUndefined();
  });
  it('точка в зоне: магазин довезёт сам, с условиями зоны', async () => {
    const [s] = await svc([store({})]).list([76.95, 43.26]);
    expect(s).toMatchObject({ ownHere: true, ownZone: { feeTiyn: 50000, minOrderTiyn: 200000, freeFromTiyn: 1500000 } });
  });
  it('точка вне зоны: сам не довезёт, курьер — да', async () => {
    const [s] = await svc([store({})]).list([77.2, 43.5]);
    expect(s).toMatchObject({ ownHere: false, courierDelivery: true });
  });
  it('магазин без зон возит везде; только курьер — своей доставки нет; доставка выключена — ничего', async () => {
    const r = await svc([store({ zones: [] }), store({ deliveryMode: 'SERVICE' }), store({ deliveryEnabled: false })]).list([77.2, 43.5]);
    expect(r[0]).toMatchObject({ ownHere: true });
    expect(r[1]).toMatchObject({ ownDelivery: false, courierDelivery: true, ownHere: false });
    expect(r[2]).toMatchObject({ ownDelivery: false, courierDelivery: false });
  });
});

describe('Видимость магазинов: только «для всех» и те, что покупатель открывал', () => {
  it('без visited: в запросе только listed', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    await new ShopsService({ store: { findMany } } as any).list();
    expect(findMany.mock.calls[0][0].where).toEqual({ status: 'ACTIVE', OR: [{ listed: true }] });
  });
  it('с visited: listed ИЛИ slug из посещённых', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    await new ShopsService({ store: { findMany } } as any).list(undefined, ['ruslan-fruits', 'demo']);
    expect(findMany.mock.calls[0][0].where).toEqual({ status: 'ACTIVE', OR: [{ listed: true }, { slug: { in: ['ruslan-fruits', 'demo'] } }] });
  });
  it('parseSlugs: чистит мусор, дубли и регистр, не больше 100', () => {
    const { parseSlugs } = require('./shops.controller');
    expect(parseSlugs('Ruslan-Fruits, demo,demo,../etc,  ,a b')).toEqual(['ruslan-fruits', 'demo']);
    expect(parseSlugs(Array.from({ length: 150 }, (_, i) => `s${i}`).join(','))).toHaveLength(100);
    expect(parseSlugs(undefined)).toEqual([]);
  });
  it('визит запоминается только у активного магазина; мои магазины = визиты + заказы без дублей', async () => {
    const prisma = {
      store: { findFirst: jest.fn().mockResolvedValueOnce({ id: 'st1' }).mockResolvedValueOnce(null) },
      storeVisit: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([{ store: { slug: 'a' } }, { store: { slug: 'b' } }]),
      },
      order: { findMany: jest.fn().mockResolvedValue([{ store: { slug: 'b' } }, { store: { slug: 'c' } }]) },
    };
    const s = new ShopsService(prisma as any);
    await expect(s.rememberVisit('u1', 'a')).resolves.toEqual({ ok: true });
    expect(prisma.storeVisit.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId_storeId: { userId: 'u1', storeId: 'st1' } } }));
    await expect(s.rememberVisit('u1', 'closed')).resolves.toEqual({ ok: false });
    await expect(s.myStores('u1')).resolves.toEqual(['a', 'b', 'c']);
  });
});
