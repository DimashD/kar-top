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
  priceTiyn: number;
  oldPriceTiyn: number | null;
}
export interface CatalogCategory { category: { ru: string }; items: CatalogProduct[] }
export interface Catalog {
  store: { id: string; slug: string; name: string; rating: number; address: string | null; deliveryMode: string };
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
