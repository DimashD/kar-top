// Часы работы магазина: 7 дней, понедельник первый; день — { open: 'HH:MM', close: 'HH:MM' } или null (выходной).
// Время — по Алматы (Казахстан, UTC+5). Не заданы — 08:00–22:00 каждый день.
export type DayHours = { open: string; close: string } | null;
export type WeekHours = DayHours[];

export const DEFAULT_HOURS: WeekHours = Array.from({ length: 7 }, () => ({ open: '08:00', close: '22:00' }));
const TZ = 'Asia/Almaty';
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/** Проверка и нормализация присланных часов. Бросает Error с понятным текстом. */
export function parseHours(raw: unknown): WeekHours {
  if (!Array.isArray(raw) || raw.length !== 7) throw new Error('Часы работы: нужно 7 дней');
  const week = raw.map((d) => {
    if (d == null) return null;
    const open = String((d as any).open ?? ''), close = String((d as any).close ?? '');
    // Закрытие может быть 24:00 — «до полуночи».
    if (!HHMM.test(open) || !(HHMM.test(close) || close === '24:00')) throw new Error('Часы работы: время в формате ЧЧ:ММ');
    if (minutes(close) <= minutes(open)) throw new Error('Часы работы: закрытие должно быть позже открытия');
    return { open, close };
  });
  if (week.every((d) => d == null)) throw new Error('Часы работы: хотя бы один день должен быть рабочим');
  return week;
}

export function hoursOf(stored: unknown): WeekHours {
  try { return parseHours(stored); } catch { return DEFAULT_HOURS; }
}

/** День недели (0 — понедельник) и минуты от полуночи по Алматы. */
function localParts(at: Date): { day: number; min: number } {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'));
  return { day, min: Number(get('hour')) * 60 + Number(get('minute')) };
}

/** Магазин работает в этот момент (открытие включительно, закрытие — нет). */
export function isOpenAt(week: WeekHours, at: Date): boolean {
  const { day, min } = localParts(at);
  const d = week[day];
  return !!d && min >= minutes(d.open) && min < minutes(d.close);
}

/** Сколько минут осталось до сегодняшнего открытия по Алматы; null — сегодня выходной или уже открылись. */
export function minutesUntilOpen(week: WeekHours, at: Date): number | null {
  const { day, min } = localParts(at);
  const d = week[day];
  if (!d) return null;
  const left = minutes(d.open) - min;
  return left > 0 ? left : null;
}

/**
 * Предзаказ («собираем заранее»): заказы до cutoff (ЧЧ:ММ по Алматы) — на следующий рабочий день, после — через день.
 * Возвращает самое раннее время получения: открытие магазина в этот день (по Алматы). Выходные пропускаем (до 14 дней).
 */
export function preorderEarliest(week: WeekHours, cutoff: string, now: Date): Date {
  const OFFSET = 5 * 60; // Алматы — UTC+5, без перехода на летнее время
  const local = new Date(now.getTime() + OFFSET * 60_000);
  const nowMin = local.getUTCHours() * 60 + local.getUTCMinutes();
  const cut = HHMM.test(cutoff) ? minutes(cutoff) : 20 * 60;
  const start = nowMin < cut ? 1 : 2;
  for (let k = start; k < start + 14; k++) {
    const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + k));
    const h = week[(d.getUTCDay() + 6) % 7]; // getUTCDay: 0 — воскресенье; у нас 0 — понедельник
    if (h) return new Date(d.getTime() + (minutes(h.open) - OFFSET) * 60_000);
  }
  // Магазин не работает 2 недели — просто «через start дней».
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + start) - OFFSET * 60_000);
}

export const isHHMM = (v: string) => HHMM.test(v);
