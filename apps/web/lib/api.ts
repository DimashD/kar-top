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
  perishable: boolean;
  photo: string | null;
  priceTiyn: number;
  oldPriceTiyn: number | null;
}
export interface CatalogCategory { category: { ru: string; kk?: string; en?: string }; items: CatalogProduct[] }
export interface Catalog {
  store: {
    id: string; slug: string; name: string; rating: number; address: string | null;
    deliveryMode: string; pickupEnabled: boolean; pickupLeadMinutes: number; reviewCount?: number;
  };
  categories: CatalogCategory[];
}

/** SSR-загрузка витрины магазина. */
export async function fetchCatalog(slug: string): Promise<Catalog | null> {
  try {
    const r = await fetch(`${SERVER_API}/shops/${encodeURIComponent(slug)}/catalog`, {
      next: { revalidate: 60 },
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
  pickupAt: string | null;
  estimatedTiyn: number;
  finalTiyn: number | null;
  itemCount: number;
  missingCount: number;
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
