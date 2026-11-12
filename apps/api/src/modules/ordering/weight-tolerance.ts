/**
 * Допуск при взвешивании (несимметричный — защищает покупателя от переплаты):
 *  - больше заказанного — не более +10 %, максимум +300 г;
 *  - меньше заказанного — до −20 % (покупатель просто платит меньше);
 *  - в обе стороны не меньше 20 г, чтобы мелкие позиции можно было взвесить.
 * Вне диапазона вес сохраняется только с подтверждением, что покупатель согласен.
 */
export function weightRange(requestedG: number): { minG: number; maxG: number } {
  const over = Math.min(Math.max(Math.round(requestedG * 0.1), 20), 300);
  const under = Math.max(Math.round(requestedG * 0.2), 20);
  return { minG: Math.max(1, requestedG - under), maxG: requestedG + over };
}
