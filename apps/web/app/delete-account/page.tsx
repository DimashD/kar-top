import Link from 'next/link';
import { LangSwitcher } from '../../components/LangProvider';
import { getDict } from '../../lib/i18n-server';

export function generateMetadata() {
  const t = getDict();
  return { title: t.deleteMetaTitle, description: t.deleteMetaDescription, robots: { index: true } };
}

export default function DeleteAccountPage() {
  const t = getDict();
  const mail = <a href="mailto:support@kar-top.kz" style={{ color: 'var(--carrot-600)' }}>support@kar-top.kz</a>;
  return (
    <main>
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <Link href="/" style={{ fontWeight: 900, fontSize: 24, color: 'var(--carrot)' }}>Kartop</Link>
          <LangSwitcher />
        </div>
      </header>
      <article className="container" style={{ maxWidth: 760, padding: '32px 20px', lineHeight: 1.65 }}>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>{t.deleteTitle}</h1>
        <p className="muted" style={{ marginBottom: 24 }}>{t.deleteService}</p>

        <Section title={t.deleteHowTitle}>
          <p>{t.deleteHowBefore} {mail} {t.deleteHowAfter}</p>
        </Section>

        <Section title={t.deleteWhatTitle}>
          <ul>
            {t.deleteWhat.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </Section>

        <Section title={t.deleteKeepTitle}>
          <p>{t.deleteKeepText}</p>
        </Section>

        <Section title={t.deleteTermsTitle}>
          <p>{t.deleteTermsText}</p>
        </Section>

        <Section title={t.contactsTitle}>
          <p>{t.deleteContacts} {mail}.</p>
        </Section>

        <p style={{ marginTop: 20 }}>
          <Link className="btn btn-ghost" href="/privacy">{t.privacyPolicy}</Link>
        </p>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 19, marginBottom: 6 }}>{title}</h2>
      <div className="muted" style={{ color: 'var(--ink)' }}>{children}</div>
    </section>
  );
}
