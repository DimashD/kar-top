import { DEFAULT_HOURS, hoursOf, isOpenAt, minutesUntilOpen, parseHours } from './hours';

describe('часы работы', () => {
  const week = parseHours([{ open: '09:00', close: '21:00' }, null, null, null, null, null, { open: '10:00', close: '24:00' }]);

  it('проверяет формат и порядок времени', () => {
    expect(() => parseHours([])).toThrow('7 дней');
    expect(() => parseHours(Array(7).fill({ open: '21:00', close: '09:00' }))).toThrow('позже открытия');
    expect(() => parseHours(Array(7).fill(null))).toThrow('рабочим');
  });

  it('пустые или битые часы — 08:00–22:00', () => {
    expect(hoursOf(null)).toEqual(DEFAULT_HOURS);
  });

  it('открыт/закрыт по Алматы (UTC+5)', () => {
    // 9 ноября 2026 — понедельник.
    expect(isOpenAt(week, new Date('2026-11-09T04:00:00Z'))).toBe(true); // пн 09:00
    expect(isOpenAt(week, new Date('2026-11-09T16:00:00Z'))).toBe(false); // пн 21:00 — уже закрыт
    expect(isOpenAt(week, new Date('2026-11-10T06:00:00Z'))).toBe(false); // вт — выходной
    expect(isOpenAt(week, new Date('2026-11-15T18:30:00Z'))).toBe(true); // вс 23:30, до полуночи
  });

  it('минуты до открытия', () => {
    expect(minutesUntilOpen(week, new Date('2026-11-09T03:00:00Z'))).toBe(60); // пн 08:00, откроются в 09:00
    expect(minutesUntilOpen(week, new Date('2026-11-09T03:30:00Z'))).toBe(30);
    expect(minutesUntilOpen(week, new Date('2026-11-09T04:10:00Z'))).toBeNull(); // уже открыты
    expect(minutesUntilOpen(week, new Date('2026-11-10T03:00:00Z'))).toBeNull(); // вт — выходной
  });
});

import { preorderEarliest } from './hours';

describe('Предзаказ: до cutoff — на следующий рабочий день, после — через день', () => {
  // 2026-11-16 — понедельник. Время по Алматы = UTC+5.
  const at = (iso: string) => new Date(iso);
  const week = Array.from({ length: 7 }, () => ({ open: '09:00', close: '20:00' }));

  it('пн 15:00 (до 20:00) → вт 09:00', () => {
    expect(preorderEarliest(week, '20:00', at('2026-11-16T10:00:00Z')).toISOString()).toBe('2026-11-17T04:00:00.000Z');
  });
  it('пн 21:30 (после 20:00) → ср 09:00', () => {
    expect(preorderEarliest(week, '20:00', at('2026-11-16T16:30:00Z')).toISOString()).toBe('2026-11-18T04:00:00.000Z');
  });
  it('следующий день — выходной → ближайший рабочий', () => {
    const w: ({ open: string; close: string } | null)[] = [...week]; w[1] = null; // вторник выходной
    expect(preorderEarliest(w, '20:00', at('2026-11-16T10:00:00Z')).toISOString()).toBe('2026-11-18T04:00:00.000Z');
  });
  it('полночь по Алматы считается уже новым днём', () => {
    // пн 23:59 UTC = вт 04:59 Алматы (до 20:00) → ср 09:00
    expect(preorderEarliest(week, '20:00', at('2026-11-16T23:59:00Z')).toISOString()).toBe('2026-11-18T04:00:00.000Z');
  });
});
