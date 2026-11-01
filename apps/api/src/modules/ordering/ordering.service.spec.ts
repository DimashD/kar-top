import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderingService } from './ordering.service';

// Лёгкий мок PrismaService — проверяем арифметику суммы и эмиссию outbox без БД.
function makePrisma(overrides: any = {}) {
  return {
    store: { findFirst: jest.fn().mockResolvedValue({ id: 'store1' }) },
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
});
