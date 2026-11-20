import Link from 'next/link';
import Logo from '../../components/Logo';
import { SERVER_API } from '../../lib/api';
import { TariffsOverview, Tariff, feeText, dateRu } from '../../lib/tariffs';

export const metadata = { title: 'Тарифы для магазинов — Kartop', robots: { index: true } };
export const revalidate = 300;

async function load(): Promise<TariffsOverview | null> {
  try {
    const r = await fetch(`${SERVER_API}/tariffs`, { next: { revalidate: 300 } });
    return r.ok ? ((await r.json()) as TariffsOverview) : null;
  } catch { return null; }
}

function Card({ t, note }: { t: Tariff; note: string }) {
  return (
    <section className="card" style={{ padding: '16px 18px', marginBottom: 14 }}>
      <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>{note}</div>
      <h2 style={{ fontSize: 20, margin: '0 0 6px' }}>{t.title}</h2>
      <p style={{ fontWeight: 700, margin: '0 0 8px' }}>{feeText(t)}</p>
      {t.body.split('\n').filter(Boolean).map((line, i) => <p key={i} style={{ margin: '0 0 6px' }}>{line}</p>)}
    </section>
  );
}

// Тарифы для магазинов — отдельно от оферты (оферта, раздел 7, ссылается на эту страницу).
export default async function TariffsPage() {
  const o = await load();
  return (
    <main>
      <header className="m-only" style={{ borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', height: 64 }}><Logo size={28} /></div>
      </header>
      <article className="container" style={{ maxWidth: 760, padding: '32px 20px', lineHeight: 1.6 }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Тарифы для магазинов</h1>
        <p className="muted" style={{ marginBottom: 20 }}>
          Эти тарифы — часть <Link href="/merchant-offer">оферты для магазинов</Link>. Новые тарифы публикуются здесь не позже чем за 30 дней до начала действия; подписывать договор заново не нужно.
        </p>
        {!o ? <p className="muted">Не удалось загрузить тарифы. Обновите страницу.</p> : (
          <>
            {o.upcoming.map((t) => <Card key={t.id} t={t} note={`Начнёт действовать ${dateRu(t.effectiveFrom)}`} />)}
            {o.current ? <Card t={o.current} note={`Действует с ${dateRu(o.current.effectiveFrom)}`} /> : <p className="muted">Тарифы пока не опубликованы — условия сообщаются при подключении.</p>}
            {o.archive.length ? (
              <section style={{ marginTop: 24 }}>
                <h2 style={{ fontSize: 18, marginBottom: 8 }}>Прежние редакции</h2>
                {o.archive.map((t) => (
                  <p key={t.id} className="muted" style={{ margin: '0 0 6px' }}>С {dateRu(t.effectiveFrom)}: {t.title} — {feeText(t)}</p>
                ))}
              </section>
            ) : null}
          </>
        )}
        <p style={{ marginTop: 20 }}><Link className="btn btn-ghost" href="/">На главную</Link></p>
      </article>
    </main>
  );
}
