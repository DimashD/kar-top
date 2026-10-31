import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
}
