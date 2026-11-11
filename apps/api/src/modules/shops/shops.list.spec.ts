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
