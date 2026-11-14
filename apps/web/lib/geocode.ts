// Геокодирование адресов (OpenStreetMap): Photon — основной, Nominatim — запасной.
// Без ключей и новых зависимостей; вызывается из браузера покупателя.
export type Point = { lat: number; lng: number };
export type Suggestion = { label: string; sub: string; point: Point; km: number | null; rank: number };

/** Расстояние по прямой, км. */
export function distKm(a: Point, b: Point) {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

/** «Улица, дом» из свойств Photon/Nominatim; без улицы — название места или район. */
function label(street: string | null | undefined, house: string | null | undefined, fallback: string | null | undefined) {
  if (street) return [street, house].filter(Boolean).join(', ');
  return fallback || null;
}

async function photon(q: string, near: Point | null, bbox: boolean, signal?: AbortSignal): Promise<Suggestion[]> {
  const params = new URLSearchParams({ q, limit: '10' });
  if (near) {
    // Сильный приоритет близких мест (по умолчанию Photon больше смотрит на «известность» места).
    params.set('lat', String(near.lat)); params.set('lon', String(near.lng));
    params.set('location_bias_scale', '0.1'); params.set('zoom', '14');
    // Сначала только в радиусе ~25 км — город вокруг; если пусто — без ограничения.
    if (bbox) params.set('bbox', [near.lng - 0.3, near.lat - 0.22, near.lng + 0.3, near.lat + 0.22].join(','));
  }
  const r = await fetch(`https://photon.komoot.io/api/?${params}`, { signal });
  const d = await r.json();
  const seen = new Set<string>();
  return (d.features ?? [])
    .filter((f: any) => !f.properties?.countrycode || f.properties.countrycode === 'KZ')
    .map((f: any, i: number) => {
      const p = f.properties ?? {};
      const street = p.street ?? (p.type === 'street' ? p.name : null);
      const text = label(street, p.housenumber, p.name) ?? '';
      const sub = [street && p.name && p.name !== street ? p.name : null, p.district, p.city].filter(Boolean).join(', ');
      const [lng, lat] = f.geometry?.coordinates ?? [];
      const point = { lat, lng };
      return { label: text, sub, point, km: near && Number.isFinite(lat) ? distKm(near, point) : null, rank: i };
    })
    .filter((s: Suggestion) => {
      const key = `${s.label}|${s.sub}`;
      if (!s.label || !Number.isFinite(s.point.lat) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * В OpenStreetMap улицы Алматы записаны по-казахски («Абай даңғылы», «Жароков көшесі»), а пишут
 * «пр. Абая 52», «ул. Жарокова». Второй вариант запроса: без «ул./пр.» и без родительного падежа
 * («Абая» → «Абай», «Сатпаева» → «Сатпаев», «Ауэзова» → «Ауэзов»).
 */
export function queryVariants(q: string): string[] {
  const plain = q
    .replace(/(^|\s)(ул(ица)?|пр(-?т|оспект)?|мкр|микрорайон|б(-?р|ульвар)|пер(еулок)?|ш(оссе)?)\.?(?=\s|$)/gi, ' ')
    .split(/\s+/).filter(Boolean)
    .map((w) => w.length < 4 || /\d/.test(w) ? w
      : w.replace(/([бвгджзклмнпрстфхцчшщ])а$/i, '$1').replace(/ая$/i, 'ай').replace(/ия$/i, 'ий'))
    .join(' ');
  return plain && plain.toLowerCase() !== q.trim().toLowerCase() ? [q, plain] : [q];
}

/** Подсказки адресов: сначала в городе вокруг (ближайшие — выше), если пусто — шире. */
export async function suggest(q: string, near: Point | null, signal?: AbortSignal): Promise<Suggestion[]> {
  const search = async (bbox: boolean) => {
    const lists = await Promise.all(queryVariants(q).map((v) => photon(v, near, bbox, signal).catch(() => [] as Suggestion[])));
    // Ранг — лучший из вариантов; дубликаты (одинаковый адрес) убираем.
    const seen = new Set<string>();
    return lists.flat().filter((s) => { const k = `${s.label}|${s.sub}`; if (seen.has(k)) return false; seen.add(k); return true; });
  };
  const local = await search(true);
  const list = local.length || !near ? local : await search(false);
  return list.sort((a, b) => (a.km ?? 0) - (b.km ?? 0)).slice(0, 6);
}

/**
 * Лучшее совпадение для адреса, набранного руками: тот же номер дома важнее всего,
 * затем релевантность поиска; далёкие (> 15 км от города/магазина) — в конце.
 */
export function bestMatch(items: Suggestion[], q = ''): Suggestion | null {
  const house = q.match(/\d+[а-яa-z]?(\/\d+)?/i)?.[0]?.toLowerCase() ?? null;
  const score = (s: Suggestion) => {
    const sameHouse = house && s.label.toLowerCase().split(/[\s,]+/).includes(house);
    return (house && !sameHouse ? 10 : 0) + s.rank + (s.km != null && s.km > 15 ? 20 : 0);
  };
  return items.length ? items.reduce((a, b) => (score(b) < score(a) ? b : a)) : null;
}

/** Адрес по точке: Photon (чаще знает номера домов), затем Nominatim. null — если ничего не нашли. */
export async function reverseGeocode(point: Point, lang: string): Promise<string | null> {
  const l = lang === 'en' ? 'en' : 'ru';
  try {
    const r = await fetch(`https://photon.komoot.io/reverse?lat=${point.lat}&lon=${point.lng}&limit=1${l === 'en' ? '&lang=en' : ''}`);
    const p = (await r.json()).features?.[0]?.properties;
    // Нашёлся дом — берём; иначе пусть попробует Nominatim (а если и он не найдёт — хотя бы улица от Photon).
    const text = p ? label(p.street ?? (p.type === 'street' ? p.name : null), p.housenumber, null) : null;
    if (text && p.housenumber) return text;
    const viaNominatim = await nominatim(point, l);
    return viaNominatim ?? text;
  } catch {
    return nominatim(point, l).catch(() => null);
  }
}

async function nominatim(point: Point, lang: string): Promise<string | null> {
  const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${point.lat}&lon=${point.lng}&zoom=18&accept-language=${lang}`);
  const d = await r.json();
  const a = d.address ?? {};
  return label(a.road ?? a.pedestrian ?? a.residential, a.house_number, a.neighbourhood ?? a.suburb ?? null);
}
