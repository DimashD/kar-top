// Форматирование денег и веса. Деньги — в тиынах, вес — в граммах.

/** 129000 тиын → «1 290 ₸» (неразрывные пробелы между разрядами). */
export function tenge(tiyn: number): string {
  const t = Math.round(tiyn / 100);
  return t.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₸';
}

export type Unit = 'KG' | 'G' | 'PCS' | 'BUNCH' | 'PACK';

/** Подпись единицы для цены: весовые — «за кг», штучные — «за шт». */
export function perUnit(unit: Unit): string {
  switch (unit) {
    case 'KG': case 'G': return 'за кг';
    case 'PCS': return 'за шт';
    case 'BUNCH': return 'за пучок';
    case 'PACK': return 'за упак';
  }
}

export function isWeighted(unit: Unit): boolean {
  return unit === 'KG' || unit === 'G';
}

/** 1500 г → «1.5 кг», 500 г → «500 г». */
export function grams(g: number): string {
  if (g >= 1000) return `${(g / 1000).toString().replace(/\.0$/, '')} кг`;
  return `${g} г`;
}
