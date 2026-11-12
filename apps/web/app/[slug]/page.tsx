import Link from 'next/link';
import { fetchCatalog } from '../../lib/api';
import { getDict } from '../../lib/i18n-server';
import StoreView from '../../components/StoreView';

export const dynamic = 'force-dynamic';

// Витрина магазина: kartop.kz/<slug> (SSR для SEO/OpenGraph).
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const t = getDict();
  const c = await fetchCatalog(params.slug);
  if (!c) return { title: t.storeNotFoundTitle };
  return {
    title: `${c.store.name} — Kartop`,
    description: t.storeMetaDescription(c.store.name),
    openGraph: { title: `${c.store.name} — Kartop`, type: 'website' },
  };
}

export default async function StorePage({ params }: { params: { slug: string } }) {
  const t = getDict();
  const catalog = await fetchCatalog(params.slug);

  if (!catalog) {
    return (
      <main className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>{t.storeNotFound}</h1>
        <p className="muted">{t.storeUnavailable(params.slug)}</p>
        <p style={{ marginTop: 20 }}><Link className="btn btn-ghost" href="/">{t.toHome}</Link></p>
      </main>
    );
  }

  return <StoreView catalog={catalog} slug={params.slug} />;
}
