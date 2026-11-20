'use client';

import { useEffect, useState } from 'react';
import { CLIENT_API } from '../../../lib/api';
import { LEGAL, OFFER_EDITION } from '../../../lib/legal';
import { OFFER_LEAD, OFFER_SECTIONS, OFFER_TITLE } from '../../../lib/merchant-offer';
import { formatKzPhone } from '../../../lib/phone';

type Data = { storeName: string; address: string | null; legalName: string | null; bin: string | null; phone: string | null; date: string };

const line: React.CSSProperties = { borderBottom: '1px solid #000', display: 'inline-block', minWidth: 220, height: 18 };

// Печатная форма договора: заявление о присоединении с данными магазина + полный текст оферты.
// Открывается из приложения магазина по ссылке с токеном (действует 2 дня). Печать или «Сохранить как PDF».
export default function OfferPrintPage() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t') ?? '';
    fetch(`${CLIENT_API}/contract?t=${encodeURIComponent(t)}`, { cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.message || 'Ссылка устарела — откройте договор из приложения ещё раз');
        setD(j as Data);
      })
      .catch((e) => setErr((e as Error).message));
  }, []);

  if (err) return <main className="container" style={{ padding: 32 }}><p>{err}</p></main>;
  if (!d) return <main className="container" style={{ padding: 32 }}><p className="muted">Загружаем договор…</p></main>;

  const today = new Date(d.date).toLocaleDateString('ru-RU', { timeZone: 'Asia/Almaty' });
  return (
    <main style={{ background: '#fff', color: '#000' }}>
      <style>{'@media print { .no-print { display: none !important; } @page { margin: 16mm; } } .doc p, .doc li { font-size: 13px; }'}</style>
      <div className="no-print container" style={{ maxWidth: 800, padding: '16px 20px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={() => window.print()}>Распечатать или сохранить PDF</button>
        <span className="muted" style={{ fontSize: 14 }}>Подпишите каждую страницу, поставьте печать, если есть, сфотографируйте и загрузите в заявку.</span>
      </div>
      <article className="doc container" style={{ maxWidth: 800, padding: '8px 20px 40px', lineHeight: 1.5 }}>
        <h1 style={{ fontSize: 20, textAlign: 'center', margin: '8px 0 4px' }}>Заявление о присоединении к оферте</h1>
        <p style={{ textAlign: 'center', margin: '0 0 16px' }}>к «{OFFER_TITLE}» в редакции от {OFFER_EDITION}</p>
        <p>Магазин, указанный ниже, присоединяется к оферте Картопа целиком (ст. 389 ГК РК) и подтверждает, что ознакомился с её текстом и с Тарифами на странице kar-top.kz/tariffs.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '10px 0 16px', fontSize: 13 }}>
          <tbody>
            {[
              ['ИП / ТОО', d.legalName ?? ''],
              ['ИИН / БИН', d.bin ?? ''],
              ['Магазин на Kartop', d.storeName],
              ['Адрес магазина', d.address ?? ''],
              ['Телефон владельца', d.phone ? formatKzPhone(d.phone) : ''],
              ['Руководитель (ФИО)', ''],
              ['Удостоверение личности №, кем и когда выдано', ''],
            ].map(([k, v]) => (
              <tr key={k}>
                <td style={{ border: '1px solid #000', padding: '6px 8px', width: '38%' }}>{k}</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px', height: 22 }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>Дата: {today}</p>
        <p style={{ marginTop: 18 }}>Подпись: <span style={line} />&nbsp;&nbsp; ФИО: <span style={line} />&nbsp;&nbsp; М.П. (если есть)</p>

        <hr style={{ margin: '28px 0 16px' }} />
        <h2 style={{ fontSize: 17, textAlign: 'center', marginBottom: 6 }}>{OFFER_TITLE}</h2>
        <p style={{ textAlign: 'center', marginTop: 0 }}>Редакция от {OFFER_EDITION}</p>
        <p>{OFFER_LEAD}</p>
        {OFFER_SECTIONS.map((s) => (
          <section key={s.h} style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, margin: '10px 0 4px' }}>{s.h}</h3>
            {s.p.map((x, i) => Array.isArray(x)
              ? <ul key={i} style={{ margin: '0 0 6px', paddingLeft: 20 }}>{x.map((li) => <li key={li}>{li}</li>)}</ul>
              : <p key={i} style={{ margin: '0 0 6px' }}>{x}</p>)}
          </section>
        ))}
        <p style={{ marginTop: 24 }}>Картоп: {LEGAL.operator}, {LEGAL.bin}</p>
        <p style={{ marginTop: 18 }}>Магазин: подпись <span style={line} />&nbsp;&nbsp; М.П. (если есть)</p>
      </article>
    </main>
  );
}
