import { BadRequestException, NotFoundException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { OrderingService } from './ordering.service';
import { weightRange } from './weight-tolerance';
import { allowedPayMethods } from './payment-rules';

// Лёгкий мок PrismaService — проверяем арифметику суммы и эмиссию outbox без БД.
function makePrisma(overrides: any = {}) {
  return {
    store: { findFirst: jest.fn().mockResolvedValue({ id: 'store1', pickupEnabled: true, pickupLeadMinutes: 60, hours: ALLDAY }) },
    $transaction: jest.fn().mockImplementation((ops: any[]) => Promise.resolve(ops)),
    storeProduct: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'sp-kg', priceTiyn: 120000, master: { unit: 'KG' } },   // 1200 ₸/кг
        { id: 'sp-pcs', priceTiyn: 25000, master: { unit: 'PCS' } },  // 250 ₸/шт
      ]),
    },
    user: { upsert: jest.fn().mockResolvedValue({ id: 'user1' }) },
    order: {
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'order1', number: 7, status: data.status, subtotalTiyn: data.subtotalTiyn }),
      ),
    },
    outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    ...overrides,
  };
}

// Круглосуточный магазин — тесты не зависят от времени запуска.
const ALLDAY = Array.from({ length: 7 }, () => ({ open: '00:00', close: '24:00' }));

describe('OrderingService.create', () => {
  it('считает весовой товар как цена×граммы/1000, штучный — цена×кол-во', async () => {
    const prisma = makePrisma();
    const svc = new OrderingService(prisma as any);
    const res = await svc.create({
      storeSlug: 'ruslan', phone: '+77011112233', payMethod: 'CASH',
      items: [
        { storeProductId: 'sp-kg', qtyG: 1500 },  // 1200 * 1500/1000 = 1800 ₸ = 180000 тиын
        { storeProductId: 'sp-pcs', qty: 3 },      // 250 * 3 = 750 ₸ = 75000 тиын
      ],
    } as any);

    expect(res.subtotalTiyn).toBe(180000 + 75000);
    expect(res.estimatedTiyn).toBe(255000);
    // зафиксирована нужная сумма в order.create
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subtotalTiyn: 255000, status: 'PLACED' }) }),
    );
  });

  it('эмитит outbox order.placed при создании', async () => {
    const prisma = makePrisma();
    const svc = new OrderingService(prisma as any);
    await svc.create({ storeSlug: 'ruslan', phone: '+77011112233', payMethod: 'CASH', items: [{ storeProductId: 'sp-pcs', qty: 1 }] } as any);
    expect(prisma.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'order.placed', aggregateType: 'order' }) }),
    );
  });

  it('требует qtyG для весового товара', async () => {
    const prisma = makePrisma();
    const svc = new OrderingService(prisma as any);
    await expect(
      svc.create({ storeSlug: 'ruslan', phone: '+77011112233', payMethod: 'CASH', items: [{ storeProductId: 'sp-kg' }] } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404, если магазин не активен', async () => {
    const prisma = makePrisma({ store: { findFirst: jest.fn().mockResolvedValue(null) } });
    const svc = new OrderingService(prisma as any);
    await expect(
      svc.create({ storeSlug: 'нет', phone: '+77011112233', payMethod: 'CASH', items: [{ storeProductId: 'sp-pcs', qty: 1 }] } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('отклоняет недоступный товар', async () => {
    const prisma = makePrisma();
    const svc = new OrderingService(prisma as any);
    await expect(
      svc.create({ storeSlug: 'ruslan', phone: '+77011112233', payMethod: 'CASH', items: [{ storeProductId: 'нет-такого', qty: 1 }] } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('создаёт заказ с 4-значным кодом получения', async () => {
    const prisma = makePrisma();
    const svc = new OrderingService(prisma as any);
    await svc.create({ storeSlug: 'ruslan', phone: '+77011112233', payMethod: 'CASH', items: [{ storeProductId: 'sp-pcs', qty: 1 }] } as any);
    const data = (prisma.order.create as jest.Mock).mock.calls[0][0].data;
    expect(data.deliveryCode).toMatch(/^\d{4}$/);
  });

  it('уведомляет покупателя (order.placed_customer) со ссылкой и кодом', async () => {
    const prisma = makePrisma();
    const svc = new OrderingService(prisma as any);
    await svc.create({ storeSlug: 'ruslan', phone: '+77011112233', payMethod: 'CASH', items: [{ storeProductId: 'sp-pcs', qty: 1 }] } as any);
    const types = (prisma.outboxEvent.create as jest.Mock).mock.calls.map((c) => c[0].data.type);
    expect(types).toContain('order.placed');
    expect(types).toContain('order.placed_customer');
  });
});

describe('OrderingService.create — самовывоз', () => {
  it('самовывоз: заказ создаётся без адреса', async () => {
    const prisma = makePrisma();
    const svc = new OrderingService(prisma as any);
    await svc.create({ storeSlug: 'ruslan', phone: '+77011112233', payMethod: 'CASH', fulfillment: 'PICKUP', items: [{ storeProductId: 'sp-pcs', qty: 1 }] } as any);
    const data = (prisma.order.create as jest.Mock).mock.calls[0][0].data;
    expect(data.fulfillment).toBe('PICKUP');
    expect(data.address).toBeUndefined();
  });

  it('самовывоз выключен в магазине → 400', async () => {
    const prisma = makePrisma({ store: { findFirst: jest.fn().mockResolvedValue({ id: 'store1', pickupEnabled: false, pickupLeadMinutes: 60, hours: ALLDAY }) } });
    const svc = new OrderingService(prisma as any);
    await expect(
      svc.create({ storeSlug: 'ruslan', phone: '+77011112233', payMethod: 'CASH', fulfillment: 'PICKUP', items: [{ storeProductId: 'sp-pcs', qty: 1 }] } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('время самовывоза раньше лид-тайма → 400', async () => {
    const prisma = makePrisma();
    const svc = new OrderingService(prisma as any);
    const tooSoon = new Date(Date.now() + 5 * 60000).toISOString(); // через 5 мин < 60
    await expect(
      svc.create({ storeSlug: 'ruslan', phone: '+77011112233', payMethod: 'CASH', fulfillment: 'PICKUP', pickupAt: tooSoon, items: [{ storeProductId: 'sp-pcs', qty: 1 }] } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('корректное время самовывоза (после лид-тайма) проходит', async () => {
    const prisma = makePrisma();
    const svc = new OrderingService(prisma as any);
    const ok = new Date(Date.now() + 90 * 60000).toISOString(); // через 90 мин > 60
    await svc.create({ storeSlug: 'ruslan', phone: '+77011112233', payMethod: 'CASH', fulfillment: 'PICKUP', pickupAt: ok, items: [{ storeProductId: 'sp-pcs', qty: 1 }] } as any);
    const data = (prisma.order.create as jest.Mock).mock.calls[0][0].data;
    expect(data.pickupAt).toBeInstanceOf(Date);
  });
});

describe('OrderingService.forMerchant (приватность ПДн)', () => {
  const addr = { line: 'ул. Абая 10, кв 5', district: 'Медеуский', lat: 43.23817, lng: 76.94529 };
  function prismaFor(status: string) {
    return {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'o1', number: 5, status, storeId: 'store1', subtotalTiyn: 1000, finalTiyn: null,
          payMethod: 'CASH', fulfillment: 'DELIVERY', pickupAt: null, address: addr,
          customer: { name: 'Айгерим', phone: '+77011112233' },
          items: [{ id: 'i1', storeProductId: 'sp1', qtyRequestedG: 500, qtyRequested: null, qtyActualG: null, priceSnapTiyn: 1000, status: 'ok' }],
        }),
      },
      storeMember: { findUnique: jest.fn().mockResolvedValue({ role: 'OWNER' }) },
      storeProduct: { findMany: jest.fn().mockResolvedValue([{ id: 'sp1', master: { name: { ru: 'Яблоки' }, unit: 'KG' } }]) },
    };
  }

  it('до принятия: нет ПДн, адрес скрыт, видна только огрублённая зона и район', async () => {
    const prisma = prismaFor('PLACED');
    const svc = new OrderingService(prisma as any);
    const r: any = await svc.forMerchant('o1', 'user1');
    expect(r.pii).toBeNull();
    expect(r.district).toBe('Медеуский');
    expect(r.items[0].name).toBe('Яблоки'); // состав виден
    // координаты огрублены до 2 знаков (~1 км), не точные
    expect(r.approxLocation).toEqual({ lat: 43.24, lng: 76.95 });
    // точный адрес/телефон не утекли
    expect(JSON.stringify(r)).not.toContain('Айгерим');
    expect(JSON.stringify(r)).not.toContain('+77011112233');
    expect(JSON.stringify(r)).not.toContain('Абая');
    expect(JSON.stringify(r)).not.toContain('43.23817');
  });

  it('после принятия: точный адрес, контакты и координаты доступны', async () => {
    const prisma = prismaFor('ACCEPTED');
    const svc = new OrderingService(prisma as any);
    const r: any = await svc.forMerchant('o1', 'user1');
    expect(r.pii.name).toBe('Айгерим');
    expect(r.pii.phone).toBe('+77011112233');
    expect(r.pii.address.line).toContain('Абая');
    expect(r.location).toEqual({ lat: 43.23817, lng: 76.94529 });
  });
});

describe('OrderingService.delivered (код получения — «страховка»)', () => {
  function prismaWith(deliveryCode: string | null) {
    return {
      order: { findUnique: jest.fn().mockResolvedValue({ storeId: 'store1', deliveryCode }) },
      storeMember: { findUnique: jest.fn().mockResolvedValue({ role: 'COURIER' }) },
    };
  }

  it('неверный код → BadRequest, заказ не закрывается', async () => {
    const prisma = prismaWith('7605');
    const svc = new OrderingService(prisma as any);
    await expect(svc.delivered('o1', 'user1', '0000')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('нет кода у заказа → BadRequest', async () => {
    const prisma = prismaWith(null);
    const svc = new OrderingService(prisma as any);
    await expect(svc.delivered('o1', 'user1', '1234')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('не член магазина → Forbidden (IDOR)', async () => {
    const prisma = prismaWith('7605');
    prisma.storeMember.findUnique = jest.fn().mockResolvedValue(null);
    const svc = new OrderingService(prisma as any);
    await expect(svc.delivered('o1', 'stranger', '7605')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('weightRange (допуск при взвешивании)', () => {
  it('1 кг: от 800 г до 1100 г', () => {
    expect(weightRange(1000)).toEqual({ minG: 800, maxG: 1100 });
  });
  it('перевес не больше 300 г даже на крупном заказе', () => {
    expect(weightRange(5000).maxG).toBe(5300);
  });
  it('мелкая позиция: допуск не меньше 20 г', () => {
    expect(weightRange(100)).toEqual({ minG: 80, maxG: 120 });
  });
});

describe('OrderingService.weighItem (лимит веса)', () => {
  function prismaFor(qtyRequestedG: number | null) {
    return {
      order: {
        findUnique: jest.fn().mockResolvedValue({ storeId: 'store1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      storeMember: { findUnique: jest.fn().mockResolvedValue({ role: 'PICKER' }) },
      orderItem: {
        findFirst: jest.fn().mockResolvedValue({ id: 'it1', priceSnapTiyn: 100000, qtyRequestedG }),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    };
  }

  it('вес в допуске сохраняется', async () => {
    const prisma = prismaFor(1000);
    await new OrderingService(prisma as any).weighItem('o1', 'it1', 1050, 'user1');
    expect(prisma.orderItem.update).toHaveBeenCalled();
  });

  it('перевес сверх допуска без согласия покупателя → 400, вес не сохраняется', async () => {
    const prisma = prismaFor(1000);
    await expect(new OrderingService(prisma as any).weighItem('o1', 'it1', 1200, 'user1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.orderItem.update).not.toHaveBeenCalled();
  });

  it('с согласием покупателя сохраняется и пишется в outbox', async () => {
    const prisma = prismaFor(1000);
    await new OrderingService(prisma as any).weighItem('o1', 'it1', 1200, 'user1', true);
    expect(prisma.orderItem.update).toHaveBeenCalled();
    expect(prisma.outboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'order.weight_override' }) }));
  });
});

describe('Оплата по способу получения', () => {
  it('курьерская служба: только перевод Kaspi', () => {
    expect(allowedPayMethods('DELIVERY', 'SERVICE')).toEqual(['KASPI_TRANSFER']);
  });
  it('своя доставка и самовывоз: наличные, карта при получении, Kaspi', () => {
    expect(allowedPayMethods('DELIVERY', 'OWN')).toHaveLength(3);
    expect(allowedPayMethods('PICKUP', 'SERVICE')).toHaveLength(3);
  });
  it('заказ наличными при доставке курьерской службой → 400', async () => {
    const prisma = makePrisma({
      store: { findFirst: jest.fn().mockResolvedValue({ id: 'store1', pickupEnabled: true, pickupLeadMinutes: 60, hours: ALLDAY, deliveryMode: 'SERVICE' }) },
    });
    const svc = new OrderingService(prisma as any);
    await expect(svc.create({
      storeSlug: 's', phone: '+77011234567', payMethod: 'CASH', fulfillment: 'DELIVERY',
      address: { line: 'ул. Абая, 1' }, items: [{ storeProductId: 'sp-pcs', qty: 1 }],
    } as any)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('OrderingService.createForUser (заказ только с подтверждённым номером)', () => {
  it('без телефона в аккаунте → 401', async () => {
    const prisma = makePrisma({ user: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() } });
    const svc = new OrderingService(prisma as any);
    await expect(svc.createForUser({ storeSlug: 's', payMethod: 'CASH', fulfillment: 'PICKUP', items: [{ storeProductId: 'sp-pcs', qty: 1 }] } as any, 'u1'))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('телефон заказа — из аккаунта, а не из формы', async () => {
    const prisma = makePrisma({ user: { findUnique: jest.fn().mockResolvedValue({ phone: '+77010000001' }), upsert: jest.fn().mockResolvedValue({ id: 'user1' }) } });
    const svc = new OrderingService(prisma as any);
    await svc.createForUser({ storeSlug: 's', phone: '+77019999999', payMethod: 'CASH', fulfillment: 'PICKUP', items: [{ storeProductId: 'sp-pcs', qty: 1 }] } as any, 'u1');
    expect(prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { phone: '+77010000001' } }));
  });
});

describe('Зоны доставки', () => {
  // Квадрат ~1 км вокруг точки [76.95, 43.26].
  const square = { type: 'Polygon', kind: 'polygon', coordinates: [[[76.94, 43.25], [76.96, 43.25], [76.96, 43.27], [76.94, 43.27], [76.94, 43.25]]] };
  function prismaWithZone(minOrderTiyn = 0) {
    return makePrisma({
      store: { findFirst: jest.fn().mockResolvedValue({ id: 'store1', pickupEnabled: true, pickupLeadMinutes: 60, hours: ALLDAY, deliveryMode: 'OWN', deliveryEnabled: true,
        zones: [{ polygon: square, feeTiyn: 50000, minOrderTiyn, freeFromTiyn: null }] }) },
    });
  }
  const base = { storeSlug: 's', phone: '+77011234567', payMethod: 'CASH', fulfillment: 'DELIVERY', items: [{ storeProductId: 'sp-pcs', qty: 1 }] };

  it('адрес вне зоны → 400', async () => {
    const svc = new OrderingService(prismaWithZone() as any);
    await expect(svc.create({ ...base, address: { line: 'x', lat: 43.5, lng: 77.2 } } as any)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('без точки на карте → 400', async () => {
    const svc = new OrderingService(prismaWithZone() as any);
    await expect(svc.create({ ...base, address: { line: 'x' } } as any)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('сумма ниже минимальной → 400', async () => {
    const svc = new OrderingService(prismaWithZone(1_000_000) as any);
    await expect(svc.create({ ...base, address: { line: 'x', lat: 43.26, lng: 76.95 } } as any)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('в зоне — заказ с ценой доставки', async () => {
    const prisma = prismaWithZone();
    const svc = new OrderingService(prisma as any);
    const r = await svc.create({ ...base, address: { line: 'x', lat: 43.26, lng: 76.95 } } as any);
    expect(r.deliveryFeeTiyn).toBe(50000);
    expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryFeeTiyn: 50000 }) }));
  });
});

describe('Два вида доставки: магазин и курьерская служба', () => {
  const square = { type: 'Polygon', kind: 'polygon', coordinates: [[[76.94, 43.25], [76.96, 43.25], [76.96, 43.27], [76.94, 43.27], [76.94, 43.25]]] };
  const storeWith = (deliveryMode: string) => makePrisma({
    store: { findFirst: jest.fn().mockResolvedValue({ id: 'store1', pickupEnabled: true, pickupLeadMinutes: 60, hours: ALLDAY, deliveryMode, deliveryEnabled: true,
      zones: [{ polygon: square, feeTiyn: 50000, minOrderTiyn: 1_000_000, freeFromTiyn: null }] }) },
  });
  const far = { line: 'мкр. Алгабас, 5', lat: 43.5, lng: 77.2 };
  const base = { storeSlug: 's', phone: '+77011234567', fulfillment: 'DELIVERY', items: [{ storeProductId: 'sp-pcs', qty: 1 }] };

  it('курьер: любая точка города, без минимальной суммы, цена доставки в заказ не входит', async () => {
    const prisma = storeWith('BOTH');
    const r = await new OrderingService(prisma as any).create({ ...base, deliveryBy: 'SERVICE', payMethod: 'KASPI_TRANSFER', address: far } as any);
    expect(r.deliveryFeeTiyn).toBe(0);
    expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryBy: 'SERVICE', deliveryFeeTiyn: 0 }) }));
  });
  it('курьер: наличными нельзя (курьер деньги не берёт) → 400', async () => {
    await expect(new OrderingService(storeWith('BOTH') as any).create({ ...base, deliveryBy: 'SERVICE', payMethod: 'CASH', address: far } as any))
      .rejects.toBeInstanceOf(BadRequestException);
  });
  it('доставка магазина в ту же точку вне зоны → 400', async () => {
    await expect(new OrderingService(storeWith('BOTH') as any).create({ ...base, deliveryBy: 'OWN', payMethod: 'CASH', address: far } as any))
      .rejects.toBeInstanceOf(BadRequestException);
  });
  it('магазин без своей доставки: OWN → 400; без курьера: SERVICE → 400', async () => {
    await expect(new OrderingService(storeWith('SERVICE') as any).create({ ...base, deliveryBy: 'OWN', payMethod: 'CASH', address: far } as any))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(new OrderingService(storeWith('OWN') as any).create({ ...base, deliveryBy: 'SERVICE', payMethod: 'KASPI_TRANSFER', address: far } as any))
      .rejects.toBeInstanceOf(BadRequestException);
  });
  it('самовывоз: вид доставки не записывается', async () => {
    const prisma = storeWith('BOTH');
    await new OrderingService(prisma as any).create({ ...base, fulfillment: 'PICKUP', deliveryBy: 'SERVICE', payMethod: 'CASH' } as any);
    expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deliveryBy: null }) }));
  });
});
