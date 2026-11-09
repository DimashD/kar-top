export type Audience = 'customer' | 'merchant' | 'both';

export interface NotifTemplate {
  audience: Audience;
  title: string;
  body: (p: any) => string;
  /** Критичное событие — покупателю без push отправляем резервное SMS (если включено NOTIFY_SMS_FALLBACK). */
  critical?: boolean;
  /** Звук «новый заказ» в приложении магазина (повтор до принятия). */
  loud?: boolean;
}

const tenge = (tiyn?: number | null) => `${Math.round((tiyn ?? 0) / 100).toLocaleString('ru-RU')} ₸`;
const pickup = (p: any) => p.fulfillment === 'PICKUP';

/**
 * Карта событий → уведомления. Покупателю и магазину — разные тексты.
 * Покупатель получает каждое изменение статуса; магазин — новые заказы, отмены и отзывы.
 * В payload события: number, fulfillment, finalTiyn / estimatedTiyn, code, trackUrl.
 */
export const TEMPLATES: Record<string, NotifTemplate> = {
  // --- Магазину ---
  'order.placed': {
    audience: 'merchant',
    title: 'Новый заказ',
    body: (p) => `Заказ №${p.number} · ${pickup(p) ? 'самовывоз' : 'доставка'} · примите вовремя`,
    loud: true,
    critical: true,
  },
  'order.reviewed': {
    audience: 'merchant',
    title: 'Новый отзыв',
    body: (p) => `${'★'.repeat(p.rating ?? 0)} к заказу №${p.number}${p.comment ? `: «${p.comment}»` : ''}`,
  },

  // --- Покупателю: путь заказа ---
  'order.placed_customer': {
    audience: 'customer',
    title: 'Заказ оформлен',
    body: (p) => `Заказ №${p.number} отправлен в магазин. Код получения: ${p.code}. Следить: ${p.trackUrl}`,
    critical: true,
  },
  'order.accepted': {
    audience: 'customer',
    title: 'Магазин принял заказ',
    body: (p) => `Заказ №${p.number} принят — скоро начнём собирать.`,
    critical: true,
  },
  'order.picking': {
    audience: 'customer',
    title: 'Собираем заказ',
    body: (p) => `Заказ №${p.number} собирают и взвешивают.`,
  },
  'order.awaiting_customer': {
    audience: 'customer',
    title: 'Магазину нужно уточнить заказ',
    body: (p) => `По заказу №${p.number} есть вопрос — магазин позвонит вам. Пожалуйста, ответьте.`,
    critical: true,
  },
  'order.substitution_needed': {
    audience: 'customer',
    title: 'Одной позиции нет в наличии',
    body: (p) => `В заказе №${p.number} убрали позицию${p.item ? ` «${p.item}»` : ''} — вы за неё не платите.`,
  },
  'order.ready': {
    audience: 'customer',
    title: 'Заказ собран',
    body: (p) => pickup(p)
      ? `Заказ №${p.number} готов — можно забирать. Итог: ${tenge(p.finalTiyn ?? p.estimatedTiyn)}.`
      : `Заказ №${p.number} собран, итог ${tenge(p.finalTiyn ?? p.estimatedTiyn)}. Скоро передадим курьеру.`,
    critical: true,
  },
  'order.delivering': {
    audience: 'customer',
    title: 'Заказ в пути',
    body: (p) => pickup(p) ? `Заказ №${p.number} ждёт вас в магазине.` : `Курьер везёт заказ №${p.number}. Назовите ему код получения.`,
  },
  'order.delivered': {
    audience: 'customer',
    title: 'Заказ получен',
    body: (p) => `Спасибо! Оцените заказ №${p.number} — это помогает магазину.`,
  },
  'order.price_updated': {
    audience: 'customer',
    title: 'Сумма уточнена',
    body: (p) => `После взвешивания итог по заказу №${p.number}: ${tenge(p.finalTiyn)}`,
  },

  // --- Обеим сторонам ---
  'order.cancelled': {
    audience: 'both',
    title: 'Заказ отменён',
    body: (p) => `Заказ №${p.number} отменён`,
    critical: true,
  },

  // --- Биллинг магазина ---
  'billing.invoice_issued': {
    audience: 'merchant',
    title: 'Счёт на подписку',
    body: (p) => `Счёт на ${tenge(p.amountTiyn)} за ${p.period}. Оплатите в Kaspi`,
    critical: true,
  },
  'billing.invoice_paid': {
    audience: 'merchant',
    title: 'Оплата получена',
    body: (p) => `Подписка за ${p.period} оплачена. Спасибо!`,
  },
};
