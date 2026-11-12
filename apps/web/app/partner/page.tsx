import Logo from '../../components/Logo';
import Link from 'next/link';
import PartnerForm from '../../components/PartnerForm';
import { LangSwitcher } from '../../components/LangProvider';
import { getDict } from '../../lib/i18n-server';
import { IconName, IconTile } from '../../components/Icon';

export function generateMetadata() {
  const t = getDict();
  return { title: t.partnerMetaTitle, description: t.partnerMetaDescription };
}

const PERK_ICON: IconName[] = ['cart', 'package', 'card'];

export default function PartnerPage() {
  const t = getDict();
  return (
    <main>
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <Logo size={28} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <LangSwitcher />
            <Link className="btn btn-ghost" href="/">{t.toHome}</Link>
          </div>
        </div>
      </header>

      <section className="container" style={{ padding: '48px 20px 24px' }}>
        <div style={{ maxWidth: 640 }}>
          <span className="badge badge-leaf">{t.forShops}</span>
          <h1 style={{ fontSize: 40, lineHeight: 1.1, margin: '16px 0 12px' }}>
            {t.partnerHeroTitle}<span style={{ color: 'var(--carrot)' }}>{t.partnerHeroAccent}</span>
          </h1>
          <p className="muted" style={{ fontSize: 18, margin: 0 }}>{t.partnerHeroText}</p>
        </div>
      </section>

      <section className="container" style={{ paddingBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {t.perks.map((p, i) => (
            <div key={p.t} className="card" style={{ padding: 20 }}>
              <div style={{ marginBottom: 10 }}><IconTile name={PERK_ICON[i]} size={48} /></div>
              <h3 style={{ fontSize: 17, marginBottom: 6 }}>{p.t}</h3>
              <p className="muted" style={{ margin: 0, fontSize: 15 }}>{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container" style={{ padding: '16px 20px 56px' }}>
        <PartnerForm />
      </section>

      <footer className="container" style={{ padding: '32px 20px', color: 'var(--ink-40)', fontSize: 14 }}>
        {t.footer}
      </footer>
    </main>
  );
}
