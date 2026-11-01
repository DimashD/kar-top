import { toCsv, tiynToTenge, isoDate } from './csv';

describe('csv', () => {
  it('экранирует запятые, кавычки и переводы строк', () => {
    const out = toCsv(['a', 'b'], [['простой', 'с, запятой'], ['с "кавычкой"', 'строка\nвторая']]);
    expect(out.startsWith('﻿')).toBe(true); // BOM
    expect(out).toContain('"с, запятой"');
    expect(out).toContain('"с ""кавычкой"""');
    expect(out).toContain('"строка\nвторая"');
  });

  it('разделяет строки CRLF и завершает переводом', () => {
    const out = toCsv(['h'], [['1'], ['2']]);
    const body = out.replace('﻿', '');
    expect(body).toBe('h\r\n1\r\n2\r\n');
  });

  it('пустые значения — пустые ячейки', () => {
    const out = toCsv(['a', 'b'], [[null, undefined]]);
    expect(out.replace('﻿', '')).toBe('a,b\r\n,\r\n');
  });

  it('тиыны → тенге с двумя знаками', () => {
    expect(tiynToTenge(129000)).toBe('1290.00');
    expect(tiynToTenge(89950)).toBe('899.50');
    expect(tiynToTenge(0)).toBe('0.00');
    expect(tiynToTenge(null)).toBe('0.00');
  });

  it('даты в ISO без миллисекунд', () => {
    expect(isoDate(new Date('2026-11-01T09:56:53.123Z'))).toBe('2026-11-01T09:56:53Z');
    expect(isoDate(null)).toBe('');
  });
});
