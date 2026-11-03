import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { toCsv, tiynToTenge, isoDate } from '../../common/csv';

type CustomerSort = 'spend' | 'orders' | 'recent';

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Аналитика по покупателям: кол-во заказов, сумма, последний заказ. */
  async customers(sort: CustomerSort = 'spend', limit = 50) {
    const grouped = await this.prisma.order.groupBy({
      by: ['customerId'],
      where: { customerId: { not: null }, status: { not: 'CANCELLED' } },
      _count: { _all: true },
      _sum: { finalTiyn: true, subtotalTiyn: true },
      _max: { createdAt: true },
    });
    const ids = grouped.map((g) => g.customerId!).filter(Boolean);
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, phone: true, createdAt: true },
    });
    const uMap = new Map(users.map((u) => [u.id, u]));

    const rows = grouped.map((g) => {
      const spentTiyn = (g._sum.finalTiyn ?? 0) || (g._sum.subtotalTiyn ?? 0);
      const u = uMap.get(g.customerId!);
      return {
        customerId: g.customerId,
        name: u?.name ?? null,
        phone: u?.phone ?? null,
        ordersCount: g._count._all,
        spentTiyn,
        lastOrderAt: g._max.createdAt,
        firstSeenAt: u?.createdAt ?? null,
      };
    });

    rows.sort((a, b) => {
      if (sort === 'orders') return b.ordersCount - a.ordersCount;
      if (sort === 'recent') return (b.lastOrderAt?.getTime() ?? 0) - (a.lastOrderAt?.getTime() ?? 0);
      return b.spentTiyn - a.spentTiyn;
    });

    const totals = {
      customers: rows.length,
      gmvTiyn: rows.reduce((s, r) => s + r.spentTiyn, 0),
      orders: rows.reduce((s, r) => s + r.ordersCount, 0),
    };
    return { totals, rows: rows.slice(0, limit) };
  }

  /** Аналитика по магазинам: заказы, GMV, средний чек, последний заказ. */
  async stores(limit = 100) {
    const grouped = await this.prisma.order.groupBy({
      by: ['storeId'],
      where: { status: { not: 'CANCELLED' } },
      _count: { _all: true },
      _sum: { finalTiyn: true, subtotalTiyn: true },
      _max: { createdAt: true },
    });
    const stores = await this.prisma.store.findMany({
      where: { id: { in: grouped.map((g) => g.storeId) } },
      select: { id: true, name: true, slug: true, status: true, rating: true },
    });
    const sMap = new Map(stores.map((s) => [s.id, s]));

    const rows = grouped
      .map((g) => {
        const gmvTiyn = (g._sum.finalTiyn ?? 0) || (g._sum.subtotalTiyn ?? 0);
        const s = sMap.get(g.storeId);
        return {
          storeId: g.storeId,
          name: s?.name ?? null,
          slug: s?.slug ?? null,
          status: s?.status ?? null,
          rating: s?.rating ?? null,
          ordersCount: g._count._all,
          gmvTiyn,
          avgCheckTiyn: g._count._all ? Math.round(gmvTiyn / g._count._all) : 0,
          lastOrderAt: g._max.createdAt,
        };
      })
      .sort((a, b) => b.gmvTiyn - a.gmvTiyn)
      .slice(0, limit);

    return { rows };
  }

  /** Выгрузка покупателей в CSV (кнопка «Экспорт» в админке). */
  async customersCsv(sort: CustomerSort = 'spend') {
    const { rows } = await this.customers(sort, 100000);
    return toCsv(
      ['Телефон', 'Имя', 'Заказов', 'Сумма, ₸', 'Последний заказ', 'Первый визит'],
      rows.map((r) => [r.phone, r.name, r.ordersCount, tiynToTenge(r.spentTiyn), isoDate(r.lastOrderAt), isoDate(r.firstSeenAt)]),
    );
  }

  /** Выгрузка магазинов в CSV. */
  async storesCsv() {
    const { rows } = await this.stores(100000);
    return toCsv(
      ['Магазин', 'Slug', 'Статус', 'Рейтинг', 'Заказов', 'GMV, ₸', 'Средний чек, ₸', 'Последний заказ'],
      rows.map((r) => [r.name, r.slug, r.status, r.rating, r.ordersCount, tiynToTenge(r.gmvTiyn), tiynToTenge(r.avgCheckTiyn), isoDate(r.lastOrderAt)]),
    );
  }

  /** Заказы конкретного покупателя (для провала из аналитики клиента). */
  async customerOrders(customerId: string, limit = 100) {
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, phone: true },
    });
    const orders = await this.prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, number: true, status: true, createdAt: true,
        finalTiyn: true, subtotalTiyn: true, payMethod: true,
        store: { select: { name: true, slug: true } },
        _count: { select: { items: true } },
      },
    });
    return { customer, orders: orders.map(this.mapOrderRow) };
  }

  /** Все заказы платформы (последние), с фильтром по статусу. */
  async recentOrders(limit = 100, status?: string) {
    const valid = ['CREATED','PLACED','ACCEPTED','PICKING','AWAITING_CUSTOMER','READY','COURIER_ASSIGNED','DELIVERING','DELIVERED','COMPLETED','CANCELLED'];
    const orders = await this.prisma.order.findMany({
      where: status && valid.includes(status) ? { status: status as any } : {},
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 300),
      select: {
        id: true, number: true, status: true, createdAt: true,
        finalTiyn: true, subtotalTiyn: true, payMethod: true, fulfillment: true,
        store: { select: { name: true, slug: true } },
        customer: { select: { name: true, phone: true } },
        _count: { select: { items: true } },
      },
    });
    return { orders: orders.map((o) => ({ ...this.mapOrderRow(o), fulfillment: o.fulfillment })) };
  }

  /** Заказы конкретного магазина (для провала из аналитики магазина). */
  async storeOrders(storeId: string, limit = 100) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, name: true, slug: true },
    });
    const orders = await this.prisma.order.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, number: true, status: true, createdAt: true,
        finalTiyn: true, subtotalTiyn: true, payMethod: true,
        customer: { select: { name: true, phone: true } },
        _count: { select: { items: true } },
      },
    });
    return { store, orders: orders.map(this.mapOrderRow) };
  }

  /** Карточка заказа для админа: позиции, события, стороны. */
  async orderDetail(orderId: string) {
    const o = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { name: true, slug: true } },
        customer: { select: { name: true, phone: true } },
        events: { orderBy: { at: 'asc' } },
        items: {
          select: {
            id: true, storeProductId: true, qtyRequestedG: true, qtyRequested: true,
            qtyActualG: true, priceSnapTiyn: true, status: true,
          },
        },
      },
    });
    if (!o) throw new NotFoundException('Заказ не найден');

    // Имена товаров подтягиваем отдельно (OrderItem хранит storeProductId без relation).
    const sps = await this.prisma.storeProduct.findMany({
      where: { id: { in: o.items.map((i) => i.storeProductId) } },
      select: { id: true, master: { select: { name: true, unit: true } } },
    });
    const prod = new Map(sps.map((s) => [s.id, s.master]));
    return { ...o, items: o.items.map((i) => ({ ...i, product: prod.get(i.storeProductId) ?? null })) };
  }

  private mapOrderRow(o: any) {
    return {
      id: o.id,
      number: o.number,
      status: o.status,
      createdAt: o.createdAt,
      amountTiyn: o.finalTiyn ?? o.subtotalTiyn,
      payMethod: o.payMethod,
      itemCount: o._count?.items ?? null,
      store: o.store ?? undefined,
      customer: o.customer ?? undefined,
    };
  }
}
