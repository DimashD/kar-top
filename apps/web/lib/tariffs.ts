export interface Tariff {
  id: string;
  title: string;
  body: string;
  monthlyFeeTiyn: number | null;
  /** Процент с заказа в сотых долях процента: 250 = 2,5%. */
  commissionBp: number | null;
  effectiveFrom: string;
  createdAt: string;
}
export interface TariffsOverview { current: Tariff | null; upcoming: Tariff[]; archive: Tariff[] }

export const feeText = (t: Pick<Tariff, 'monthlyFeeTiyn' | 'commissionBp'>) => {
  const parts: string[] = [];
  if (t.monthlyFeeTiyn != null) parts.push(t.monthlyFeeTiyn === 0 ? 'Абонплата: бесплатно' : `Абонплата: ${Math.round(t.monthlyFeeTiyn / 100).toLocaleString('ru-RU')} ₸ в месяц`);
  if (t.commissionBp != null) parts.push(`С заказа: ${(t.commissionBp / 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%`);
  return parts.join(' · ');
};

export const dateRu = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Almaty' });
