import { Injectable, NotFoundException } from '@nestjs/common';
import { StoreStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Модерация магазинов платформой: список, одобрение, блокировка. */
@Injectable()
export class AdminStoresService {
  constructor(private readonly prisma: PrismaService) {}

  /** Список магазинов для модерации (по статусу, по умолчанию — ожидающие). */
  async list(status?: StoreStatus, limit = 100) {
    const stores = await this.prisma.store.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, slug: true, name: true, status: true, phone: true,
        address: true, deliveryMode: true, createdAt: true,
        _count: { select: { products: true, orders: true } },
        members: { where: { role: 'OWNER' }, select: { user: { select: { phone: true, name: true } } } },
      },
    });
    return stores.map((s) => ({
      id: s.id, slug: s.slug, name: s.name, status: s.status, phone: s.phone,
      address: s.address, deliveryMode: s.deliveryMode, createdAt: s.createdAt,
      productCount: s._count.products, orderCount: s._count.orders,
      owner: s.members[0]?.user ?? null,
    }));
  }

  private async setStatus(id: string, status: StoreStatus) {
    const store = await this.prisma.store.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!store) throw new NotFoundException('Магазин не найден');
    if (store.status === status) return { id, status, changed: false };
    await this.prisma.store.update({ where: { id }, data: { status } });
    return { id, status, changed: true };
  }

  approve(id: string) { return this.setStatus(id, StoreStatus.ACTIVE); }      // PENDING → ACTIVE
  suspend(id: string) { return this.setStatus(id, StoreStatus.SUSPENDED); }   // временно (напр. неоплата подписки)
  block(id: string)   { return this.setStatus(id, StoreStatus.BLOCKED); }     // нарушение правил
}
