import Logo from '../components/Logo';
import Link from 'next/link';
import StoreMenu from '../components/StoreMenu';
import StoreList from '../components/StoreList';
import FeedbackButton from '../components/FeedbackButton';
import BottomNav from '../components/BottomNav';
import { fetchStores } from '../lib/api';
import { getDict } from '../lib/i18n-server';
import Icon, { IconTile } from '../components/Icon';

import { LegalLinks } from '../components/LegalDoc';
export const dynamic = 'force-dynamic';

// Главная — для покупателя: магазины у дома (поиск, «рядом со мной»). Продавцам — одна строка внизу.
export default async function Home() {
  const t = getDict();
  const stores = await fetchStores();
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <header className="m-only" style={{ borderBottom: '1px solid var(--line)', background: 'var(--card)', position: 'sticky', top: 0, zIndex: 5 }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px' }}>
          <StoreMenu />
          <div style={{ flex: 1 }}><Logo size={30} /></div>
        </div>
      </header>

      {/* Первый экран: на компьютере — полоса с текстом слева и витриной фото справа. */}
      <section className="home-hero">
        <div className="container home-hero-in" style={{ padding: '28px 20px 8px' }}>
          <div>
            <h1 style={{ fontSize: 32, lineHeight: 1.15, margin: '0 0 8px', maxWidth: 640 }}>
              {t.heroTitle}<span style={{ color: 'var(--carrot)' }}>{t.heroAccent}</span>
            </h1>
            <p className="muted" style={{ fontSize: 17, margin: 0, maxWidth: 640 }}>{t.buyerHeroText}</p>
            <ul className="home-trust">
              {t.trust.map((x) => <li key={x}><Icon name="checkCircle" size={18} />{x}</li>)}
            </ul>
            {/* Что делать дальше — сразу к магазинам. */}
            <a href="#stores" className="btn btn-primary d-only home-cta">{t.heroCta} ↓</a>
          </div>
          <div className="home-collage d-only" aria-hidden="true">
            {['0008', '0021', '0068', '0134', '0041', '0074'].map((n) => <img key={n} src={`/p/${n}.jpg`} alt="" />)}
          </div>
        </div>
      </section>

      <section className="container d-only home-how" style={{ padding: '0 20px' }}>
        <h2 style={{ fontSize: 22, margin: '0 0 12px' }}>{t.howTitle}</h2>
        <div className="home-steps">
          {t.howSteps.map(([h, d], i) => (
            <div key={h} className="card" style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span className="home-step-n">{i + 1}</span>
              <div><div style={{ fontWeight: 800 }}>{h}</div><div className="muted" style={{ fontSize: 14, marginTop: 2 }}>{d}</div></div>
            </div>
          ))}
        </div>
      </section>

      <section id="stores" className="container home-stores" style={{ padding: '20px 20px 32px' }}>
        <h2 style={{ fontSize: 22, margin: '0 0 12px' }}>{t.storesTitle}</h2>
        <StoreList stores={stores} />
      </section>

      <section className="container m-only" style={{ padding: '8px 20px 28px' }}>
        <h2 style={{ fontSize: 22, margin: '0 0 12px' }}>{t.howTitle}</h2>
        <div className="home-steps">
          {t.howSteps.map(([h, d], i) => (
            <div key={h} className="card" style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span className="home-step-n">{i + 1}</span>
              <div><div style={{ fontWeight: 800 }}>{h}</div><div className="muted" style={{ fontSize: 14, marginTop: 2 }}>{d}</div></div>
            </div>
          ))}
        </div>
      </section>

      <section className="container" style={{ padding: '0 20px 24px' }}>
        <Link href="/partner" className="card seller-cta" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, color: 'var(--ink)', textDecoration: 'none' }}>
          <IconTile name="store" size={44} />
          <span style={{ fontWeight: 700, flex: 1 }}>{t.sellerCta}</span>
          <span style={{ color: 'var(--carrot)', fontWeight: 800 }}>→</span>
        </Link>
      </section>

      <FeedbackButton />
      <footer className="container" style={{ padding: '16px 20px 32px', color: 'var(--ink-40)', fontSize: 14 }}>
        <div className="foot-cols d-only">
          <div><b>Kartop</b><span>{t.footer}</span></div>
          <div><b>{t.footBuyers}</b><Link href="/">{t.navStores}</Link><Link href="/orders">{t.navOrders}</Link><Link href="/app">{t.downloadApp}</Link></div>
          <div><b>{t.footShops}</b><Link href="/partner">{t.sellerCta}</Link><Link href="/merchant-offer">{t.footDocs}</Link></div>
        </div>
        <span className="m-only">{t.footer}</span><LegalLinks />
      </footer>
      <BottomNav />
    </main>
  );
}
