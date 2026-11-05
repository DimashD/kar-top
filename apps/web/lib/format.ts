// Форматирование денег и веса. Деньги — в тиынах, вес — в граммах.
import type { Dict } from './i18n';

/** 129000 тиын → «1 290 ₸» (неразрывные пробелы между разрядами). */
export function tenge(tiyn: number): string {
  const t = Math.round(tiyn / 100);
  return t.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₸';
}

export type Unit = 'KG' | 'G' | 'PCS' | 'BUNCH' | 'PACK';

/** Подпись единицы для цены: весовые — «за кг», штучные — «за шт». */
export function perUnit(unit: Unit, t: Dict): string {
  switch (unit) {
    case 'KG': case 'G': return t.perKg;
    case 'PCS': return t.perPcs;
    case 'BUNCH': return t.perBunch;
    case 'PACK': return t.perPack;
  }
}

export function isWeighted(unit: Unit): boolean {
  return unit === 'KG' || unit === 'G';
}

/** 1500 г → «1.5 кг», 500 г → «500 г». */
export function grams(g: number, t: Dict): string {
  if (g >= 1000) return `${(g / 1000).toString().replace(/\.0$/, '')} ${t.kg}`;
  return `${g} ${t.g}`;
}

/** Количество в корзине: весовые — в граммах/кг, штучные — «3 шт». */
export function qtyLabel(unit: Unit, qty: number, t: Dict): string {
  return isWeighted(unit) ? grams(qty, t) : `${qty} ${t.pcs}`;
}
