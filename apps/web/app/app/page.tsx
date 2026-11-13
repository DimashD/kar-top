import Logo from '../../components/Logo';
import Link from 'next/link';
import AppBanner from '../../components/AppBanner';
import { LangSwitcher } from '../../components/LangProvider';
import { getDict } from '../../lib/i18n-server';

export function generateMetadata() {
  const t = getDict();
  return { title: t.appMetaTitle, description: t.appMetaDescription };
}

export default function AppPage() {
  return (
    <main>
      <header className="m-only" style={{ borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <Logo size={28} />
          <LangSwitcher />
        </div>
      </header>
      <section className="container" style={{ padding: '56px 20px' }}>
        <AppBanner variant="full" />
      </section>
    </main>
  );
}
