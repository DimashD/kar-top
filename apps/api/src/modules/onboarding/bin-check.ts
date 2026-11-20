/**
 * Проверка ИИН/БИН без внешних сервисов: 12 цифр, контрольный разряд, тип (ИИН — физлицо/ИП, БИН — юрлицо).
 * Существует ли ИП/ТОО и действует ли — админ сверяет по ссылке на реестр (stat.gov.kz) в карточке заявки.
 */
export type BinCheck = { valid: boolean; kind: 'IIN' | 'BIN' | null; reason?: string };

const W1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const W2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];

export function checkBin(raw: string): BinCheck {
  const v = (raw ?? '').replace(/\s/g, '');
  if (!/^\d{12}$/.test(v)) return { valid: false, kind: null, reason: 'ИИН/БИН — 12 цифр' };
  const d = [...v].map(Number);
  let c = W1.reduce((s, w, i) => s + w * d[i], 0) % 11;
  if (c === 10) c = W2.reduce((s, w, i) => s + w * d[i], 0) % 11;
  if (c === 10 || c !== d[11]) return { valid: false, kind: null, reason: 'Неверный ИИН/БИН: не сходится контрольная цифра' };
  // У БИН 5-я цифра — тип организации (4, 5, 6); у ИИН это десятки дня рождения (0–3).
  const kind = d[4] >= 4 && d[4] <= 6 ? 'BIN' : 'IIN';
  return { valid: true, kind };
}
