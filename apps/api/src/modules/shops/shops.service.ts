import { hoursOf } from '../../common/hours';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LngLat, haversineMeters } from '../../common/geo';
import { effectiveTerms, findZone, ZoneRow } from '../../common/zones';
import { visibleWhere } from './listing';

@Injectable()
export class ShopsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Активные магазины для главной: карточка, точка на карте и часы работы (чтобы показать «открыто/закрыто»).
   * Виды получения: доставка магазина (по его зонам), курьерская служба (весь город, за счёт покупателя), самовывоз.
   * Если передана точка покупателя — ownHere: довезёт ли магазин сам сюда, и условия зоны (цена, «бесплатно от», минимум).
   */
  async list(point?: LngLat, visited: string[] = []) {
    // В общем списке — магазины «для всех» (с идущим бесплатным/оплаченным периодом) плюс те, что покупатель открывал (visited).
    const stores = await this.prisma.store.findMany({
      where: { status: 'ACTIVE', OR: [visibleWhere(), ...(visited.length ? [{ slug: { in: visited } }] : [])] },
      orderBy: [{ rating: 'desc' }, { createdAt: 'asc' }],
      take: 500,
      select: { slug: true, name: true, address: true, rating: true, reviewCount: true, photoAt: true, geom: true, deliveryEnabled: true, pickupEnabled: true, hours: true,
        deliveryMode: true, ownMinOrderTiyn: true, ownFreeFromTiyn: true, zones: { select: { polygon: true, feeTiyn: true, minOrderTiyn: true, freeFromTiyn: true } } },
    });
    return stores.map(({ geom, photoAt, hours, zones, deliveryMode, ownMinOrderTiyn, ownFreeFromTiyn, ...s }) => {
      const c = (geom as any)?.coordinates as [number, number] | undefined;
      const ownDelivery = s.deliveryEnabled !== false && deliveryMode !== 'SERVICE';
      const courierDelivery = s.deliveryEnabled !== false && deliveryMode !== 'OWN';
      // Зон нет — магазин возит без ограничений (как в заказе).
      const zone = ownDelivery && point && zones.length ? findZone(zones, point) : null;
      const ownHere = !ownDelivery ? false : !point ? null : zones.length ? !!zone : true;
      return {
        ...s, hours: hoursOf(hours), photoVersion: photoAt ? photoAt.getTime() : null, location: c ? { lat: c[1], lng: c[0] } : null,
        ownDelivery, courierDelivery, ownHere,
        ownZone: zone ? termsOut(effectiveTerms({ ownMinOrderTiyn, ownFreeFromTiyn }, zone)) : null,
        // Условия своей доставки магазина (без учёта зоны): «мин. заказ», «бесплатно от».
        ownTerms: ownDelivery ? { minOrderTiyn: ownMinOrderTiyn, freeFromTiyn: ownFreeFromTiyn } : null,
      };
    });
  }

  /** Покупатель открыл витрину (по ссылке) — запоминаем, чтобы магазин был в его списке на всех устройствах. */
  async rememberVisit(userId: string, slug: string) {
    const store = await this.prisma.store.findFirst({ where: { slug, status: 'ACTIVE' }, select: { id: true } });
    if (!store) return { ok: false };
    await this.prisma.storeVisit.upsert({
      where: { userId_storeId: { userId, storeId: store.id } },
      update: { at: new Date() },
      create: { userId, storeId: store.id },
    });
    return { ok: true };
  }

  /** Магазины покупателя: открывал витрину или заказывал. Только slug — список собирает /shops?visited=… */
  async myStores(userId: string): Promise<string[]> {
    const [visits, orders] = await Promise.all([
      this.prisma.storeVisit.findMany({ where: { userId }, select: { store: { select: { slug: true } } }, orderBy: { at: 'desc' }, take: 100 }),
      this.prisma.order.findMany({ where: { customerId: userId }, select: { store: { select: { slug: true } } }, distinct: ['storeId'], take: 100 }),
    ]);
    return [...new Set([...visits, ...orders].map((x) => x.store.slug))];
  }

  /** Публичный каталог витрины: магазин + его товары, сгруппированные по категориям. */
  async photo(slug: string) {
    const s = await this.prisma.store.findFirst({ where: { slug, status: 'ACTIVE' }, select: { photo: true, photoType: true } });
    if (!s?.photo) throw new NotFoundException('Фото нет');
    return { data: Buffer.from(s.photo), type: s.photoType ?? 'image/jpeg' };
  }

  async catalog(slug: string) {
    const store = await this.prisma.store.findFirst({
      where: { slug, status: 'ACTIVE' },
      select: { id: true, slug: true, name: true, rating: true, reviewCount: true, address: true, deliveryMode: true, deliveryEnabled: true, pickupEnabled: true, pickupLeadMinutes: true, geom: true, photoAt: true, phone: true, ownDeliveryMinutes: true, courierHandoverMinutes: true, hours: true, legalName: true, legalBin: true, ownMinOrderTiyn: true, ownFreeFromTiyn: true,
        zones: { select: { polygon: true, feeTiyn: true, minOrderTiyn: true, freeFromTiyn: true } } },
    });
    if (!store) throw new NotFoundException('Магазин не найден или не активен');
    const { geom, photoAt, hours, zones, ...rest } = store;
    // Фото: /api/shops/<slug>/photo?v=<версия> — версия сбрасывает кэш после замены.
    // Зоны своей доставки — покупатель видит их на карте; кольцо [lng, lat] → [[lat, lng]] для карты.
    // Условия каждой зоны — уже с учётом настроек магазина (минимум и «бесплатно от»).
    const deliveryZones = zones.map((z) => ({
      ring: (((z.polygon as any)?.coordinates?.[0] ?? []) as [number, number][]).map(([lng, lat]) => [lat, lng] as [number, number]),
      ...termsOut(effectiveTerms(store, z)),
    })).filter((z) => z.ring.length > 2).sort((a, b) => a.feeTiyn - b.feeTiyn);
    const storeInfo = { ...rest, hours: hoursOf(hours), photoVersion: photoAt ? photoAt.getTime() : null, deliveryZones };
    const coords = (geom as any)?.coordinates as [number, number] | undefined; // GeoJSON: [lng, lat]
    const location = coords ? { lat: coords[1], lng: coords[0] } : null;

    const items = await this.prisma.storeProduct.findMany({
      where: { storeId: store.id, inStock: true },
      select: {
        id: true,
        priceTiyn: true,
        oldPriceTiyn: true,
        master: {
          select: {
            name: true, unit: true, stepG: true, avgPieceG: true, perishable: true, media: true,
            category: { select: { id: true, name: true, sort: true, parent: { select: { id: true, name: true, sort: true } } } },
          },
        },
      },
    });

    // Категория + её крупная группа («Овощи и зелень»…) — витрина строит быстрые кнопки по группам.
    const byCat = new Map<string, { category: unknown; group: unknown; sort: number; groupSort: number; items: unknown[] }>();
    for (const it of items) {
      const c = it.master.category;
      const catId = c.id;
      if (!byCat.has(catId)) {
        byCat.set(catId, {
          category: c.name,
          group: c.parent ? { id: c.parent.id, name: c.parent.name } : null,
          sort: c.sort,
          groupSort: c.parent?.sort ?? 999,
          items: [],
        });
      }
      byCat.get(catId)!.items.push({
        id: it.id,
        name: it.master.name,
        unit: it.master.unit,
        stepG: it.master.stepG,
        avgPieceG: it.master.avgPieceG,
        perishable: it.master.perishable,
        photo: (it.master.media as any)?.url ?? null, // media = { url } | null
        priceTiyn: it.priceTiyn,
        oldPriceTiyn: it.oldPriceTiyn,
      });
    }
    const categories = [...byCat.values()].sort((a, b) => a.groupSort - b.groupSort || a.sort - b.sort);
    return { store: { ...storeInfo, location }, categories };
  }

  /** Проверка, попадает ли адрес в зону доставки магазина. */
  async zoneCheck(slug: string, lat: number, lng: number) {
    const store = await this.prisma.store.findFirst({
      where: { slug, status: 'ACTIVE' },
      select: { id: true, geom: true, zones: true, ownMinOrderTiyn: true, ownFreeFromTiyn: true },
    });
    if (!store) throw new NotFoundException('Магазин не найден');

    const point: LngLat = [lng, lat];
    // Магазин ещё не задал зоны — возит везде, цена 0; минимум и «бесплатно от» — из настроек магазина.
    if (!store.zones.length) return { inZone: true, noZones: true, ...termsOut(effectiveTerms(store, null)), distanceMeters: null };
    const zone = findZone(store.zones, point);
    if (!zone) return { inZone: false };
    const storePt = (store.geom as any)?.coordinates as LngLat | undefined;
    return {
      inZone: true,
      ...termsOut(effectiveTerms(store, zone)),
      distanceMeters: storePt ? Math.round(haversineMeters(storePt, point)) : null,
    };
  }
}

/** Условия доставки для ответа API (без многоугольника). */
function termsOut(t: ZoneRow) {
  return { feeTiyn: t.feeTiyn, minOrderTiyn: t.minOrderTiyn, freeFromTiyn: t.freeFromTiyn };
}
