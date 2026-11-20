export type Audience = 'customer' | 'merchant' | 'both';

export interface NotifTemplate {
  audience: Audience;
  /** Короткий заголовок пуша со значком: «🚚 Заказ №12 в пути». */
  title: (p: any) => string;
  /** Одна короткая строка пояснения (без ссылок — нажатие на пуш и так открывает заказ). */
  body: (p: any) => string;
  /** Важный статус заказа (пометка для приложения; SMS о заказах не отправляются). */
  critical?: boolean;
  /** Звук «новый заказ» в приложении магазина (повтор до принятия). */
  loud?: boolean;
}

const tenge = (tiyn?: number | null) => `${Math.round((tiyn ?? 0) / 100).toLocaleString('ru-RU')} ₸`;
const pickup = (p: any) => p.fulfillment === 'PICKUP';
const no = (p: any) => (p.number ? `№${p.number}` : '');
const sum = (p: any) => tenge(p.finalTiyn ?? p.estimatedTiyn);

/**
 * Карта событий → уведомления: короткий заголовок со значком и одна строка.
 * Покупатель получает каждое изменение статуса; магазин — новые заказы, отмены и отзывы.
 * В payload события: number, fulfillment, finalTiyn / estimatedTiyn, code, item, rating, comment.
 */
export const TEMPLATES: Record<string, NotifTemplate> = {
  // --- Магазину ---
  'order.placed': {
    audience: 'merchant',
    title: (p) => `🛒 Новый заказ ${no(p)}`,
    body: (p) => `${pickup(p) ? 'Самовывоз' : 'Доставка'}${p.estimatedTiyn ? ` · ≈ ${tenge(p.estimatedTiyn)}` : ''} — примите заказ`,
    loud: true,
    critical: true,
  },
  'order.reviewed': {
    audience: 'merchant',
    title: (p) => `⭐ Новый отзыв ${'★'.repeat(p.rating ?? 0)}`,
    body: (p) => `Заказ ${no(p)}${p.comment ? `: «${String(p.comment).slice(0, 80)}»` : ''}`,
  },

  'store.application_approved': {
    audience: 'merchant',
    title: () => '✅ Заявка одобрена',
    body: (p) => `Магазин «${p.name ?? ''}» подключён к Kartop — можно принимать заказы`,
  },
  'store.application_rejected': {
    audience: 'merchant',
    title: () => '✏️ Заявку нужно исправить',
    body: (p) => String(p.reason ?? '').slice(0, 120),
  },
  'tariff.published': {
    audience: 'merchant',
    title: () => '📄 Меняются тарифы Kartop',
    body: (p) => `Новые условия с ${p.effectiveFrom ? new Date(p.effectiveFrom).toLocaleDateString('ru-RU', { timeZone: 'Asia/Almaty' }) : ''} — посмотрите на kar-top.kz/tariffs`,
  },

  // --- Покупателю: путь заказа ---
  'order.placed_customer': {
    audience: 'customer',
    title: (p) => `✅ Заказ ${no(p)} оформлен`,
    body: (p) => `${p.code ? `Код получения ${p.code}. ` : ''}Магазин скоро подтвердит`,
    critical: true,
  },
  'order.accepted': {
    audience: 'customer',
    title: (p) => `👍 Магазин принял заказ ${no(p)}`,
    body: () => 'Скоро начнём собирать',
    critical: true,
  },
  'order.picking': {
    audience: 'customer',
    title: (p) => `🧺 Собираем заказ ${no(p)}`,
    body: () => 'Взвешиваем и упаковываем',
  },
  'order.awaiting_customer': {
    audience: 'customer',
    title: () => '📞 Нужен ваш ответ',
    body: (p) => `Магазин позвонит по заказу ${no(p)}`,
    critical: true,
  },
  'order.substitution_needed': {
    audience: 'customer',
    title: () => '⚠️ Товара нет в наличии',
    body: (p) => `${p.item ? `«${p.item}»` : 'Позицию'} убрали из заказа ${no(p)} — вы за неё не платите`,
  },
  'order.ready': {
    audience: 'customer',
    title: (p) => (pickup(p) ? `🎉 Заказ ${no(p)} готов` : `📦 Заказ ${no(p)} собран`),
    body: (p) => (pickup(p) ? `Можно забирать · ${sum(p)}` : `Итог ${sum(p)} · скоро передадим курьеру`),
    critical: true,
  },
  'order.delivering': {
    audience: 'customer',
    title: (p) => (pickup(p) ? '🛍 Заказ ждёт вас в магазине' : `🚚 Заказ ${no(p)} в пути`),
    body: (p) => (pickup(p) ? `Заказ ${no(p)} готов к выдаче` : 'Назовите курьеру код получения'),
  },
  'order.delivered': {
    audience: 'customer',
    title: (p) => `🙏 Заказ ${no(p)} получен`,
    body: () => 'Оцените заказ — это помогает магазину',
  },
  'order.price_updated': {
    audience: 'customer',
    title: () => '💰 Сумма уточнена',
    body: (p) => `Заказ ${no(p)}: ${tenge(p.finalTiyn)} после взвешивания`,
  },

  // --- Обеим сторонам ---
  'order.cancelled': {
    audience: 'both',
    title: (p) => `❌ Заказ ${no(p)} отменён`,
    body: () => 'Если это ошибка — свяжитесь с магазином',
    critical: true,
  },

  // --- Магазину: перед открытием (за час и за 30 минут) ---
  'store.update_reminder': {
    audience: 'merchant',
    title: (p) => (p.minutes >= 60 ? '🌅 Через час открываетесь' : '⏰ Через 30 минут открываетесь'),
    body: () => 'Проверьте цены. Чего нет в наличии — скройте, чтобы это не заказали',
  },

  // --- Магазину: показ всем покупателям (бесплатный период → подписка) ---
  'store.listing_ending': {
    audience: 'merchant',
    title: (p) => (p.daysLeft <= 1 ? '⏳ Завтра магазин перестанет показываться всем' : `⏳ Показ всем: осталось ${p.daysLeft} дн.`),
    body: (p) => `${p.free ? 'Бесплатный период' : 'Оплаченный период'} до ${new Date(p.until).toLocaleDateString('ru-RU', { timeZone: 'Asia/Almaty' })}. `
      + `Чтобы магазин оставался в общем списке Kartop, оплатите подписку${p.priceTiyn ? ` — ${tenge(p.priceTiyn)} в месяц` : ''}`,
    critical: true,
  },
  'store.listing_ended': {
    audience: 'merchant',
    title: () => '🔗 Магазин снова виден только по ссылке',
    body: (p) => `Период показа всем закончился. Вернуть — в Настройках → «Показывать всем покупателям»${p.priceTiyn ? ` (${tenge(p.priceTiyn)} в месяц)` : ''}`,
  },

  // --- Биллинг магазина ---
  'billing.invoice_issued': {
    audience: 'merchant',
    title: () => '🧾 Счёт на подписку',
    body: (p) => `Счёт на ${tenge(p.amountTiyn)} за ${p.period}. Оплатите в Kaspi`,
    critical: true,
  },
  'billing.invoice_paid': {
    audience: 'merchant',
    title: () => '✅ Оплата получена',
    body: (p) => `Подписка за ${p.period} оплачена. Спасибо!`,
  },
};
