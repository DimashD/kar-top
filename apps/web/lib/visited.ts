// Магазины, которые покупатель открывал (по ссылке). Магазины не «для всех» показываются в его списке
// только если он к ним заходил. Храним на устройстве: localStorage (основное) и cookie (чтобы главная
// сразу отрисовала их на сервере). Для вошедших — ещё и на сервере (/me/stores), чтобы список был на всех устройствах.
const KEY = 'kartop:visited';
const COOKIE = 'kartop_visited';
const MAX = 50;

/** Slug из cookie-строки (для главной на сервере). */
export function parseVisitedCookie(raw?: string | null): string[] {
  return (raw ?? '').split(',').map((x) => decodeURIComponent(x).trim()).filter((x) => /^[a-z0-9-]{1,64}$/.test(x)).slice(0, MAX);
}

export function visitedSlugs(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/** Запомнить магазин (самый свежий — первым). */
export function rememberVisited(slug: string) {
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) return;
  const list = [slug, ...visitedSlugs().filter((x) => x !== slug)].slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* приватный режим */ }
  try {
    // Cookie: первые 30, на год — главная на сервере видит их без JS.
    document.cookie = `${COOKIE}=${list.slice(0, 30).join(',')}; path=/; max-age=${365 * 24 * 3600}; samesite=lax`;
  } catch { /* ок */ }
}

export const VISITED_COOKIE = COOKIE;
