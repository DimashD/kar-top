import Link from 'next/link';
import Logo from './Logo';
import { LEGAL_EDITION, requisites } from '../lib/legal';

export type LegalSection = { h: string; p: (string | string[])[] };

/** Страница юридического документа: заголовок, редакция, разделы (строка = абзац, массив = список). */
export default function LegalDoc({ title, lead, sections }: { title: string; lead?: string; sections: LegalSection[] }) {
  return (
    <main>
      <header className="m-only" style={{ borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', height: 64 }}>
          <Logo size={28} />
        </div>
      </header>
      <article className="container" style={{ maxWidth: 760, padding: '32px 20px', lineHeight: 1.65 }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>{title}</h1>
        <p className="muted" style={{ marginBottom: 20 }}>Редакция от {LEGAL_EDITION}</p>
        {lead ? <p style={{ marginBottom: 20 }}>{lead}</p> : null}
        {sections.map((s) => (
          <section key={s.h} style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 19, marginBottom: 6 }}>{s.h}</h2>
            {s.p.map((x, i) => Array.isArray(x)
              ? <ul key={i} style={{ margin: '0 0 8px', paddingLeft: 22 }}>{x.map((li) => <li key={li}>{li}</li>)}</ul>
              : <p key={i} style={{ margin: '0 0 8px' }}>{x}</p>)}
          </section>
        ))}
        <p className="muted" style={{ fontSize: 14, marginTop: 24 }}>
          Документы: <Link href="/terms">соглашение</Link> · <Link href="/privacy">конфиденциальность</Link> · <Link href="/consent">согласие на ПДн</Link> · <Link href="/merchant-offer">оферта для магазинов</Link>
        </p>
        <p style={{ marginTop: 20 }}><Link className="btn btn-ghost" href="/">На главную</Link></p>
      </article>
    </main>
  );
}

/** Подвал сайта: владелец сервиса и ссылки на документы (закон о защите прав потребителей — раскрыть владельца площадки). */
export function LegalLinks() {
  return (
    <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>
      {requisites()}<br />
      <Link href="/terms" style={{ color: 'inherit' }}>Соглашение</Link> · <Link href="/privacy" style={{ color: 'inherit' }}>Конфиденциальность</Link> · <Link href="/consent" style={{ color: 'inherit' }}>Согласие на ПДн</Link> · <Link href="/merchant-offer" style={{ color: 'inherit' }}>Оферта для магазинов</Link>
    </div>
  );
}
