import Link from 'next/link';
import { fetchCatalog } from '../../lib/api';
import StoreView from '../../components/StoreView';

export const dynamic = 'force-dynamic';

// Витрина магазина: kartop.kz/<slug> (SSR для SEO/OpenGraph).
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const c = await fetchCatalog(params.slug);
  if (!c) return { title: 'Магазин не найден — Kartop' };
  return {
    title: `${c.store.name} — Kartop`,
    description: `Свежие продукты из магазина «${c.store.name}» с доставкой. Онлайн зелёный базар Kartop.`,
    openGraph: { title: `${c.store.name} — Kartop`, type: 'website' },
  };
}

export default async function StorePage({ params }: { params: { slug: string } }) {
  const catalog = await fetchCatalog(params.slug);

  if (!catalog) {
    return (
      <main className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Магазин не найден</h1>
        <p className="muted">Витрина «{params.slug}» недоступна или на модерации.</p>
        <p style={{ marginTop: 20 }}><Link className="btn btn-ghost" href="/">На главную</Link></p>
      </main>
    );
  }

  return <StoreView catalog={catalog} slug={params.slug} />;
}
