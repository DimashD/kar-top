// Единый формат телефона Казахстана: +7 7XX XXX XX XX.
// Храним/показываем отформатированную строку; на сервер уходит E.164 (+77XXXXXXXXX).

/** Только цифры, страна 7, максимум 11 знаков (7 + 10). «8…» → «7…». */
export function kzDigits(raw: string): string {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('8')) d = '7' + d.slice(1);
  if (d && !d.startsWith('7')) d = '7' + d;
  return d.slice(0, 11);
}

/** Красивый ввод: +7 701 111 59 99 (по мере набора). */
export function formatKzPhone(raw: string): string {
  const d = kzDigits(raw);
  if (d.length <= 1) return '+7';
  const rest = d.slice(1); // после кода страны 7
  const parts = [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6, 8), rest.slice(8, 10)].filter(Boolean);
  return '+7' + (parts.length ? ' ' + parts.join(' ') : '');
}

/** Валидный мобильный РК: +7 7XX XXX XX XX. */
export function isValidKzPhone(raw: string): boolean {
  return /^77\d{9}$/.test(kzDigits(raw));
}

/** Формат для API: +77XXXXXXXXX. */
export function kzPhoneE164(raw: string): string {
  return '+' + kzDigits(raw);
}
