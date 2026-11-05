import Link from 'next/link';
import { LangSwitcher } from '../components/LangProvider';
import { getDict } from '../lib/i18n-server';

// Лендинг Kartop. Витрина магазина — /<slug>.
const CAT_EMOJI = ['🥕', '🍎', '🥩', '🧀', '🥗', '🥜'];

export default function Home() {
  const t = getDict();
  return (
    <main>
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 64, flexWrap: 'wrap', padding: '10px 20px' }}>
          <div style={{ fontWeight: 900, fontSize: 24, color: 'var(--carrot)' }}>Kartop</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <LangSwitcher />
            <Link className="btn btn-ghost" href="/partner">{t.becomePartner}</Link>
            <Link className="btn btn-ghost" href="/app">{t.appLink}</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container" style={{ padding: '56px 20px 40px' }}>
        <div style={{ maxWidth: 640 }}>
          <span className="badge badge-leaf">{t.cities}</span>
          <h1 style={{ fontSize: 44, lineHeight: 1.1, margin: '16px 0 12px' }}>
            {t.heroTitle}<span style={{ color: 'var(--carrot)' }}>{t.heroAccent}</span>
          </h1>
          <p className="muted" style={{ fontSize: 19, margin: '0 0 24px' }}>{t.heroText}</p>
          {/* MVP: покупатель попадает только в свой магазин — по ссылке от продавца; общего списка магазинов нет. */}
          <div className="card" style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center', background: 'var(--carrot-50)' }}>
            <span style={{ fontSize: 26 }}>🔗</span>
            <span style={{ fontWeight: 600 }}>{t.shopLinkHint}</span>
          </div>
        </div>
      </section>

      {/* Категории */}
      <section className="container" style={{ paddingBottom: 48 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {t.cats.map((name, i) => (
            <div key={name} className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 30 }}>{CAT_EMOJI[i]}</span>
              <span style={{ fontWeight: 700 }}>{name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Как это работает */}
      <section style={{ background: 'var(--card)', borderTop: '1px solid var(--line)' }}>
        <div className="container" style={{ padding: '48px 20px' }}>
          <h2 style={{ fontSize: 28, marginBottom: 24 }}>{t.howItWorks}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {t.steps.map((s, i) => (
              <div key={i}>
                <div style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--carrot-50)', color: 'var(--carrot-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, marginBottom: 12 }}>{i + 1}</div>
                <h3 style={{ fontSize: 18, marginBottom: 6 }}>{s.t}</h3>
                <p className="muted" style={{ margin: 0 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA для магазинов */}
      <section className="container" style={{ padding: '48px 20px' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', background: 'var(--carrot-50)', border: '1px solid var(--line)' }}>
          <h2 style={{ fontSize: 26, margin: '0 0 8px' }}>{t.shopCtaTitle}</h2>
          <p className="muted" style={{ fontSize: 17, margin: '0 0 20px', maxWidth: 560, marginInline: 'auto' }}>{t.shopCtaText}</p>
          <Link className="btn btn-primary" href="/partner" style={{ fontSize: 16, padding: '14px 28px' }}>
            {t.becomePartnerArrow}
          </Link>
        </div>
      </section>

      <footer className="container" style={{ padding: '32px 20px', color: 'var(--ink-40)', fontSize: 14, display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <span>{t.footer}</span>
        <Link href="/partner" style={{ color: 'var(--ink-40)' }}>{t.becomePartner}</Link>
      </footer>
    </main>
  );
}
