import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LngLat, pointInPolygon, haversineMeters } from '../../common/geo';

@Injectable()
export class ShopsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Публичный каталог витрины: магазин + его товары, сгруппированные по категориям. */
  async catalog(slug: string) {
    const store = await this.prisma.store.findFirst({
      where: { slug, status: 'ACTIVE' },
      select: { id: true, slug: true, name: true, rating: true, address: true, deliveryMode: true, pickupEnabled: true, pickupLeadMinutes: true },
    });
    if (!store) throw new NotFoundException('Магазин не найден или не активен');

    const items = await this.prisma.storeProduct.findMany({
      where: { storeId: store.id, inStock: true },
      select: {
        id: true,
        priceTiyn: true,
        oldPriceTiyn: true,
        master: {
          select: { name: true, unit: true, stepG: true, avgPieceG: true, perishable: true, media: true, category: { select: { id: true, name: true } } },
        },
      },
    });

    const byCat = new Map<string, { category: unknown; items: unknown[] }>();
    for (const it of items) {
      const catId = it.master.category.id;
      if (!byCat.has(catId)) byCat.set(catId, { category: it.master.category.name, items: [] });
      byCat.get(catId)!.items.push({
        id: it.id,
        name: it.master.name,
        unit: it.master.unit,
        stepG: it.master.stepG,
        perishable: it.master.perishable,
        photo: (it.master.media as any)?.url ?? null, // media = { url } | null
        priceTiyn: it.priceTiyn,
        oldPriceTiyn: it.oldPriceTiyn,
      });
    }
    return { store, categories: [...byCat.values()] };
  }

  /** Проверка, попадает ли адрес в зону доставки магазина. */
  async zoneCheck(slug: string, lat: number, lng: number) {
    const store = await this.prisma.store.findFirst({
      where: { slug, status: 'ACTIVE' },
      select: { id: true, geom: true, zones: true },
    });
    if (!store) throw new NotFoundException('Магазин не найден');

    const point: LngLat = [lng, lat];
    for (const zone of store.zones) {
      if (pointInPolygon(point, zone.polygon as any)) {
        const storePt = (store.geom as any)?.coordinates as LngLat | undefined;
        const distance = storePt ? Math.round(haversineMeters(storePt, point)) : null;
        return {
          inZone: true,
          feeTiyn: zone.feeTiyn,
          minOrderTiyn: zone.minOrderTiyn,
          freeFromTiyn: zone.freeFromTiyn,
          distanceMeters: distance,
        };
      }
    }
    return { inZone: false };
  }
}
