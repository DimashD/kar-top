'use client';

import { useEffect, useState } from 'react';
import { listTariffs, publishTariff, cancelTariff } from '../lib/admin';
import { TariffsOverview, Tariff, feeText, dateRu } from '../lib/tariffs';

const DAY = 24 * 3600 * 1000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Тарифы: действующий, будущие (можно отменить до начала) и публикация нового — не раньше чем через 30 дней. */
export default function AdminTariffs() {
  const [o, setO] = useState<TariffsOverview | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [fee, setFee] = useState('');
  const [pct, setPct] = useState('');
  const [from, setFrom] = useState(isoDate(new Date(Date.now() + 31 * DAY)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const reload = () => listTariffs().then(setO).catch((e) => setErr((e as Error).message));
  useEffect(() => { reload(); }, []);
  const first = !!o && !o.current && o.upcoming.length === 0;

  async function publish() {
    setErr(null); setOk(null);
    const feeT = fee.trim() === '' ? null : Math.round(Number(fee.replace(',', '.')) * 100);
    const bp = pct.trim() === '' ? null : Math.round(Number(pct.replace(',', '.')) * 100);
    if ((feeT != null && Number.isNaN(feeT)) || (bp != null && Number.isNaN(bp))) { setErr('Абонплата и процент — числа'); return; }
    if (!confirm(first ? 'Опубликовать первый тариф? Он сразу появится на kar-top.kz/tariffs.' : `Опубликовать тариф с ${from}? Всем магазинам придёт уведомление.`)) return;
    setBusy(true);
    try {
      await publishTariff({ title: title.trim(), body: body.trim(), monthlyFeeTiyn: feeT, commissionBp: bp, effectiveFrom: new Date(`${from}T00:00:00+05:00`).toISOString() });
      setOk('Опубликовано'); setTitle(''); setBody(''); setFee(''); setPct('');
      await reload();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function cancel(t: Tariff) {
    if (!confirm(`Отменить тариф «${t.title}» с ${dateRu(t.effectiveFrom)}?`)) return;
    try { await cancelTariff(t.id); await reload(); } catch (e) { setErr((e as Error).message); }
  }

  const input: React.CSSProperties = { padding: '8px 10px', fontSize: 14, border: '1px solid var(--line)', borderRadius: 10, font: 'inherit', width: '100%', boxSizing: 'border-box' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
      <div className="card" style={{ padding: '14px 16px' }}>
        <strong>Сейчас действует</strong>
        {o?.current ? (
          <p style={{ margin: '6px 0 0' }}>{o.current.title} — {feeText(o.current)} <span className="muted">(с {dateRu(o.current.effectiveFrom)})</span></p>
        ) : <p className="muted" style={{ margin: '6px 0 0' }}>Тариф ещё не опубликован.</p>}
        {o?.upcoming.map((t) => (
          <p key={t.id} style={{ margin: '8px 0 0' }}>
            С {dateRu(t.effectiveFrom)}: {t.title} — {feeText(t)}{' '}
            <button className="btn btn-ghost" style={{ padding: '2px 10px', fontSize: 13 }} onClick={() => cancel(t)}>Отменить</button>
          </p>
        ))}
        <p className="muted" style={{ fontSize: 13, margin: '10px 0 0' }}>Магазины видят тарифы на <a href="/tariffs" target="_blank" rel="noreferrer">kar-top.kz/tariffs</a>. Оферта ссылается на эту страницу, переподписывать договоры не нужно.</p>
      </div>

      <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <strong>Новый тариф</strong>
        <input style={input} placeholder="Название, например «Процент с заказа»" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea style={input} rows={4} placeholder="Условия простыми словами: что входит, как считается, бесплатный период" value={body} onChange={(e) => setBody(e.target.value)} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <label style={{ fontSize: 13 }}>Абонплата, ₸ в месяц<input style={input} inputMode="decimal" placeholder="пусто — нет" value={fee} onChange={(e) => setFee(e.target.value)} /></label>
          <label style={{ fontSize: 13 }}>Процент с заказа, %<input style={input} inputMode="decimal" placeholder="пусто — нет" value={pct} onChange={(e) => setPct(e.target.value)} /></label>
          <label style={{ fontSize: 13 }}>Действует с<input style={input} type="date" value={from} min={first ? undefined : isoDate(new Date(Date.now() + 30 * DAY))} onChange={(e) => setFrom(e.target.value)} /></label>
        </div>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          {first ? 'Первый тариф можно ввести с любой даты.' : 'По оферте новый тариф начинает действовать не раньше чем через 30 дней. Всем магазинам придёт уведомление в приложение.'}
        </p>
        <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={busy || !title.trim() || !body.trim() || (!fee.trim() && !pct.trim())} onClick={publish}>Опубликовать</button>
        {err ? <p style={{ color: 'var(--sale)', margin: 0 }}>{err}</p> : null}
        {ok ? <p style={{ color: 'var(--leaf)', margin: 0 }}>{ok}</p> : null}
      </div>
    </div>
  );
}
