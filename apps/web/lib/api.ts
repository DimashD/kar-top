// Базовый URL API.
// SSR внутри контейнера ходит на внутренний адрес; браузер — через относительный /api (Caddy).
export const SERVER_API =
  process.env.API_BASE_INTERNAL || process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:3000/api';
export const CLIENT_API = process.env.NEXT_PUBLIC_API_BASE || '/api';

export interface CatalogProduct {
  id: string;
  name: { ru: string; kk?: string; en?: string };
  unit: 'KG' | 'G' | 'PCS' | 'BUNCH' | 'PACK';
  stepG: number | null;
  avgPieceG?: number | null;
  perishable: boolean;
  photo: string | null;
  priceTiyn: number;
  oldPriceTiyn: number | null;
}
export type I18nName = { ru: string; kk?: string; en?: string };
export interface CatalogCategory {
  category: I18nName;
  /** Крупная группа каталога («Овощи и зелень»); null — без группы. */
  group?: { id: string; name: I18nName } | null;
  items: CatalogProduct[];
}
export interface Catalog {
  store: {
    id: string; slug: string; name: string; rating: number; address: string | null;
    deliveryMode: string; deliveryEnabled?: boolean; pickupEnabled: boolean;
    /** Точка магазина — карта выбора адреса открывается рядом с ним. */
    location?: { lat: number; lng: number } | null; pickupLeadMinutes: number; reviewCount?: number;
    /** Версия фото магазина (null — фото нет): /shops/<slug>/photo?v=<версия>. */
    photoVersion?: number | null;
    /** Телефон магазина и средний срок своей доставки (мин) — для страницы «О магазине». */
    phone?: string | null; ownDeliveryMinutes?: number; courierHandoverMinutes?: number;
    /** Часы работы: 7 дней (пн первый), { open, close } 'HH:MM' или null — выходной. */
    hours?: ({ open: string; close: string } | null)[];
  };
  categories: CatalogCategory[];
}

/** SSR-загрузка витрины магазина. */
export async function fetchCatalog(slug: string): Promise<Catalog | null> {
  try {
    const r = await fetch(`${SERVER_API}/shops/${encodeURIComponent(slug)}/catalog`, {
      // Настройки магазина (сроки, способы получения) должны применяться почти сразу.
      next: { revalidate: 10 },
    });
    if (!r.ok) return null;
    return (await r.json()) as Catalog;
  } catch {
    return null;
  }
}

export type OrderStatus =
  | 'CREATED' | 'PLACED' | 'ACCEPTED' | 'PICKING' | 'AWAITING_CUSTOMER'
  | 'READY' | 'COURIER_ASSIGNED' | 'DELIVERING' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';

export interface OrderTrack {
  id: string;
  number: number;
  status: OrderStatus;
  createdAt: string;
  store: { name: string; slug: string; address: string | null; kaspiPhone?: string | null };
  payMethod: 'CASH' | 'CARD_COURIER' | 'KASPI_TRANSFER';
  fulfillment: 'DELIVERY' | 'PICKUP';
  /** Кто везёт: OWN — магазин, SERVICE — курьерская служба (за счёт покупателя, отдельно). */
  deliveryBy?: 'OWN' | 'SERVICE' | null;
  pickupAt: string | null;
  estimatedTiyn: number;
  /** Платная доставка — уже входит в estimatedTiyn и finalTiyn. */
  deliveryFeeTiyn?: number;
  finalTiyn: number | null;
  itemCount: number;
  missingCount: number;
  /** Состав: заказано / взвешено / убрано — чтобы покупатель видел, откуда изменилась сумма. */
  items?: {
    id: string; names: { ru: string; kk?: string; en?: string }; unit: 'KG' | 'G' | 'PCS' | 'BUNCH' | 'PACK'; status: string;
    qtyRequestedG: number | null; qtyRequested: number | null; qtyActualG: number | null;
    priceTiyn: number; orderedTiyn: number; actualTiyn: number;
  }[];
  timeline: { to: OrderStatus; at: string }[];
  deliveryCode: string | null;
  canReview: boolean;
  review: { rating: number; comment: string | null } | null;
}

/** SSR-загрузка трекинга заказа. */
export async function fetchTrack(orderId: string): Promise<OrderTrack | null> {
  try {
    const r = await fetch(`${SERVER_API}/orders/${encodeURIComponent(orderId)}/track`, { cache: 'no-store' });
    if (!r.ok) return null;
    return (await r.json()) as OrderTrack;
  } catch {
    return null;
  }
}

/** Магазин в списке на главной. */
export interface StoreCard {
  slug: string; name: string; address: string | null; rating: number; reviewCount: number;
  photoVersion: number | null; location: { lat: number; lng: number } | null;
  deliveryEnabled: boolean; pickupEnabled: boolean;
  hours: ({ open: string; close: string } | null)[];
}

/** SSR: активные магазины для главной. */
export async function fetchStores(): Promise<StoreCard[]> {
  try {
    const r = await fetch(`${SERVER_API}/shops`, { next: { revalidate: 60 } });
    return r.ok ? ((await r.json()) as StoreCard[]) : [];
  } catch {
    return [];
  }
}
