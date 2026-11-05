import { LngLat, pointInPolygon } from './geo';

/**
 * Зоны доставки магазина. Магазин сам выбирает способ задать зону:
 *  - radius — круг вокруг магазина (храним как многоугольник + сам радиус, чтобы редактировать ползунком);
 *  - polygon — область, обведённая на карте.
 * В БД — DeliveryZone.polygon: GeoJSON Polygon с полями kind и radiusM.
 */
export type ZoneShape = { type: 'Polygon'; coordinates: LngLat[][]; kind: 'radius' | 'polygon'; radiusM?: number };
export type ZoneRow = { id?: string; polygon: unknown; feeTiyn: number; minOrderTiyn: number; freeFromTiyn: number | null };

/** Круг радиусом radiusM вокруг центра — многоугольник из n точек. */
export function circlePolygon(center: LngLat, radiusM: number, n = 48): LngLat[] {
  const [lng, lat] = center;
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  const ring: LngLat[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    ring.push([Number((lng + dLng * Math.cos(a)).toFixed(6)), Number((lat + dLat * Math.sin(a)).toFixed(6))]);
  }
  ring.push(ring[0]);
  return ring;
}

/** Зона, куда попадает точка; если несколько — с самой низкой ценой доставки. */
export function findZone<T extends ZoneRow>(zones: T[], point: LngLat): T | null {
  const hits = zones.filter((z) => pointInPolygon(point, z.polygon as any));
  return hits.sort((a, b) => a.feeTiyn - b.feeTiyn)[0] ?? null;
}

/** Цена доставки с учётом «бесплатно от суммы». */
export function deliveryFee(zone: ZoneRow, subtotalTiyn: number): number {
  return zone.freeFromTiyn != null && subtotalTiyn >= zone.freeFromTiyn ? 0 : zone.feeTiyn;
}
