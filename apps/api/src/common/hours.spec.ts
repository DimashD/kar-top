import { DEFAULT_HOURS, hoursOf, isOpenAt, parseHours } from './hours';

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
});
