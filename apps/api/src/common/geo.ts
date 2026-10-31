export type LngLat = [number, number];

/**
 * Точка в полигоне (ray casting). Полигон — GeoJSON-кольцо [[lng,lat], ...].
 * В проде проверка зоны делается в PostGIS (ST_Contains) — это запасной расчёт.
 */
export function pointInRing(point: LngLat, ring: LngLat[]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(point: LngLat, polygon: { rings?: LngLat[][]; coordinates?: LngLat[][] }): boolean {
  const rings = polygon.rings ?? polygon.coordinates ?? [];
  if (!rings.length) return false;
  // первое кольцо — внешнее; последующие — «дыры»
  if (!pointInRing(point, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) if (pointInRing(point, rings[i])) return false;
  return true;
}

/** Грубое расстояние по гаверсинусу, метры (для «N км от магазина»). */
export function haversineMeters(a: LngLat, b: LngLat): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
