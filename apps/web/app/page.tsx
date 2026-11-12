import Logo from '../components/Logo';
import Link from 'next/link';
import StoreMenu from '../components/StoreMenu';
import StoreList from '../components/StoreList';
import FeedbackButton from '../components/FeedbackButton';
import BottomNav from '../components/BottomNav';
import { fetchStores } from '../lib/api';
import { getDict } from '../lib/i18n-server';

export const dynamic = 'force-dynamic';

// Главная — для покупателя: магазины у дома (поиск, «рядом со мной»). Продавцам — одна строка внизу.
export default async function Home() {
  const t = getDict();
  const stores = await fetchStores();
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--card)', position: 'sticky', top: 0, zIndex: 5 }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px' }}>
          <StoreMenu />
          <div style={{ flex: 1 }}><Logo size={30} /></div>
        </div>
      </header>

      <section className="container" style={{ padding: '28px 20px 8px' }}>
        <h1 style={{ fontSize: 32, lineHeight: 1.15, margin: '0 0 8px', maxWidth: 640 }}>
          {t.heroTitle}<span style={{ color: 'var(--carrot)' }}>{t.heroAccent}</span>
        </h1>
        <p className="muted" style={{ fontSize: 17, margin: 0, maxWidth: 640 }}>{t.buyerHeroText}</p>
      </section>

      <section className="container" style={{ padding: '20px 20px 32px' }}>
        <h2 style={{ fontSize: 22, margin: '0 0 12px' }}>{t.storesTitle}</h2>
        <StoreList stores={stores} />
      </section>

      <section className="container" style={{ padding: '0 20px 24px' }}>
        <Link href="/partner" className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, color: 'var(--ink)', textDecoration: 'none' }}>
          <span style={{ fontSize: 26 }}>🏪</span>
          <span style={{ fontWeight: 700, flex: 1 }}>{t.sellerCta}</span>
          <span style={{ color: 'var(--carrot)', fontWeight: 800 }}>→</span>
        </Link>
      </section>

      <FeedbackButton />
      <footer className="container" style={{ padding: '16px 20px 32px', color: 'var(--ink-40)', fontSize: 14 }}>{t.footer}</footer>
      <BottomNav />
    </main>
  );
}
