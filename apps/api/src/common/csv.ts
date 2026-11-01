// Минимальный генератор CSV (RFC 4180). Экранируем кавычки/запятые/переводы строк.
function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Собрать CSV из колонок и строк. Первый байт — BOM, чтобы Excel/Kaspi корректно читал кириллицу. */
export function toCsv(headers: string[], rows: (unknown[])[]): string {
  const lines = [headers.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))];
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** Тиыны → тенге строкой с двумя знаками (для выгрузок). */
export function tiynToTenge(tiyn: number | null | undefined): string {
  return ((tiyn ?? 0) / 100).toFixed(2);
}

/** Дата → ISO без миллисекунд (UTC). */
export function isoDate(d: Date | null | undefined): string {
  return d ? d.toISOString().replace(/\.\d{3}Z$/, 'Z') : '';
}
