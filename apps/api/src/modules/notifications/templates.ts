export type Audience = 'customer' | 'merchant' | 'both';

export interface NotifTemplate {
  audience: Audience;
  title: string;
  body: (p: any) => string;
  /** Критичное событие — при отсутствии push отправляем резервный SMS. */
  critical?: boolean;
  /** Звук «новый заказ» в приложении магазина (повтор до принятия). */
  loud?: boolean;
}

/** Карта событий → уведомления. Покупателю и магазину — разные тексты. */
export const TEMPLATES: Record<string, NotifTemplate> = {
  'order.placed': {
    audience: 'merchant',
    title: 'Новый заказ',
    body: (p) => `Заказ №${p.number} · ${p.district ?? 'доставка'} · примите вовремя`,
    loud: true,
    critical: true,
  },
  'order.placed_customer': {
    audience: 'customer',
    title: 'Заказ оформлен',
    body: (p) => `Заказ №${p.number} принят. Код получения: ${p.code}. Следите за заказом в приложении: ${p.trackUrl}`,
    critical: true,
  },
  'order.accepted': {
    audience: 'customer',
    title: 'Магазин принял заказ',
    body: (p) => `Заказ №${p.number} собирают. Привезём в слот ${p.slot ?? ''}`.trim(),
    critical: true,
  },
  'order.substitution_needed': {
    audience: 'customer',
    title: 'Нужна замена',
    body: (p) => `В заказе №${p.number} нет «${p.item ?? 'товара'}». Выберите: заменить или убрать`,
    critical: true,
  },
  'order.price_updated': {
    audience: 'customer',
    title: 'Сумма уточнена',
    body: (p) => `После взвешивания итог по заказу №${p.number}: ~${Math.round((p.finalTiyn ?? 0) / 100)} ₸`,
  },
  'order.ready': {
    audience: 'customer',
    title: 'Заказ готов',
    body: (p) => `Заказ №${p.number} собран, скоро выедет курьер`,
  },
  'order.delivering': {
    audience: 'customer',
    title: 'Курьер в пути',
    body: (p) => `Заказ №${p.number} едет к вам`,
  },
  'order.delivered': {
    audience: 'customer',
    title: 'Заказ доставлен',
    body: (p) => `Приятного аппетита! Оцените заказ №${p.number}`,
  },
  'order.cancelled': {
    audience: 'both',
    title: 'Заказ отменён',
    body: (p) => `Заказ №${p.number} отменён`,
  },
  'billing.invoice_issued': {
    audience: 'merchant',
    title: 'Счёт на подписку',
    body: (p) => `Счёт на ${Math.round((p.amountTiyn ?? 0) / 100)} ₸ за ${p.period}. Оплатите в Kaspi`,
    critical: true,
  },
  'billing.invoice_paid': {
    audience: 'merchant',
    title: 'Оплата получена',
    body: (p) => `Подписка за ${p.period} оплачена. Спасибо!`,
  },
};
