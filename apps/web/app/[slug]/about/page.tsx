import Link from 'next/link';
import { fetchCatalog } from '../../../lib/api';
import { getDict } from '../../../lib/i18n-server';
import { LangSwitcher } from '../../../components/LangProvider';
import StoreMenu from '../../../components/StoreMenu';
import FeedbackButton from '../../../components/FeedbackButton';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const c = await fetchCatalog(params.slug);
  return { title: c ? `${c.store.name} — ${getDict().aboutStore}` : getDict().storeNotFoundTitle };
}

// «О магазине»: фото, адрес и маршрут, связь, как получить заказ — чтобы покупатель понимал, у кого покупает.
export default async function AboutStorePage({ params }: { params: { slug: string } }) {
  const t = getDict();
  const c = await fetchCatalog(params.slug);
  if (!c) {
    return (
      <main className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28 }}>{t.storeNotFound}</h1>
        <p style={{ marginTop: 20 }}><Link className="btn btn-ghost" href="/">{t.toHome}</Link></p>
      </main>
    );
  }
  const s = c.store;
  const photo = s.photoVersion ? `/api/shops/${encodeURIComponent(s.slug)}/photo?v=${s.photoVersion}` : null;
  const phone = s.phone?.replace(/\D/g, '');
  const loc = s.location;
  const btn: React.CSSProperties = { flex: '1 1 0', minWidth: 0, padding: '12px 8px', fontSize: 14, textAlign: 'center' };
  const card: React.CSSProperties = { padding: 16, marginTop: 12 };
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <header style={{ background: 'var(--card)', borderBottom: '1px solid var(--line)' }}>
        <div className="container" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, maxWidth: 760 }}>
          <StoreMenu />
          <Link href={`/${s.slug}`} style={{ flex: 1, fontWeight: 800, color: 'var(--ink)', textDecoration: 'none' }}>← {t.toProducts}</Link>
          <LangSwitcher />
        </div>
      </header>
      {photo ? <img src={photo} alt={s.name} style={{ display: 'block', width: '100%', maxWidth: 760, height: 220, objectFit: 'cover', margin: '0 auto' }} /> : null}
      <div className="container" style={{ padding: '16px 20px 40px', maxWidth: 760 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>{s.name}</h1>
        <div className="muted" style={{ marginTop: 4 }}>★ {s.rating.toFixed(1)}{s.reviewCount ? ` · ${t.reviewsShort(s.reviewCount)}` : ''}</div>
        {s.address ? <div style={{ marginTop: 8, fontSize: 15 }}>📍 {s.address}</div> : null}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          {phone ? <a className="btn btn-ghost" style={btn} href={`tel:+${phone}`}>📞 {t.storeCall}</a> : null}
          {phone ? <a className="btn btn-ghost" style={btn} href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer">💬 {t.storeWhatsapp}</a> : null}
          {loc ? <a className="btn btn-ghost" style={btn} href={`https://2gis.kz/geo/${loc.lng},${loc.lat}`} target="_blank" rel="noreferrer">🧭 {t.storeRoute}</a> : null}
        </div>

        <div className="card" style={card}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>{t.howToGet}</div>
          {s.pickupEnabled ? <div>🛍️ {t.pickupIn(s.pickupLeadMinutes)}</div> : null}
          {s.deliveryEnabled !== false ? (
            <div style={{ marginTop: 4 }}>🚚 {s.deliveryMode === 'OWN' ? t.ownDeliveryIn(s.ownDeliveryMinutes ?? 60) : t.courierDeliveryNote}</div>
          ) : null}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20 }}><Link className="btn btn-primary" href={`/${s.slug}`}>{t.toProducts}</Link></p>
        <FeedbackButton storeSlug={s.slug} />
      </div>
    </main>
  );
}
