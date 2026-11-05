export type PayMethod = 'CASH' | 'CARD_COURIER' | 'KASPI_TRANSFER';

/**
 * Какими способами можно оплатить заказ (MVP, онлайн-оплаты нет):
 *  - самовывоз и своя доставка магазина — наличными, картой продавцу при получении или переводом Kaspi;
 *  - доставка курьерской службой (deliveryMode SERVICE) — курьер деньги не принимает, только перевод Kaspi заранее.
 * CARD_COURIER — исторический код «картой при получении».
 */
export function allowedPayMethods(fulfillment: 'DELIVERY' | 'PICKUP', deliveryMode: string): PayMethod[] {
  if (fulfillment === 'DELIVERY' && deliveryMode === 'SERVICE') return ['KASPI_TRANSFER'];
  return ['CASH', 'CARD_COURIER', 'KASPI_TRANSFER'];
}
