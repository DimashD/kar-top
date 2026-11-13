'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StoreStat, CustomersResult, Summary, OrderRow, Period,
  analyticsStores, analyticsCustomers, analyticsSummary, periodOrders, periodCsvQs, downloadCsv, UnauthorizedError,
} from '../lib/admin';
import { useAdmin } from './AdminShell';
import { STATUS_RU } from './AdminOrders';
import { formatKzPhone } from '../lib/phone';
import { tenge } from '../lib/format';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
  catch { return iso; }
}
function fmtDateTime(iso: string): string {
  try { return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' }); }
  catch { return iso; }
}

/** Сегодня по Алматы — 'YYYY-MM-DD'. */
const today = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
const shift = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

type Preset = 'today' | '7' | '30' | 'month' | 'all' | 'custom';
const PRESETS: [Preset, string][] = [['today', 'Сегодня'], ['7', '7 дней'], ['30', '30 дней'], ['month', 'Этот месяц'], ['all', 'Всё время']];
function presetPeriod(p: Preset): Period {
  const t = today();
  if (p === 'today') return { from: t, to: t };
  if (p === '7') return { from: shift(t, -6), to: t };
  if (p === '30') return { from: shift(t, -29), to: t };
  if (p === 'month') return { from: `${t.slice(0, 8)}01`, to: t };
  return {};
}

type Tab = 'stores' | 'customers';
type CustSort = 'spend' | 'orders' | 'recent';
type Focus = { kind: 'store' | 'customer'; id: string } | null;

const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 700, color: 'var(--ink-60)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '10px 12px', fontSize: 14, borderBottom: '1px solid var(--line)' };
const chip: React.CSSProperties = { padding: '6px 12px', fontSize: 13 };

/** Аналитика платформы: период → сводка с графиком, магазины и клиенты; клик по строке — подробно. */
export default function AdminAnalytics() {
  const { signOut } = useAdmin();
  const [preset, setPreset] = useState<Preset>('30');
  const [period, setPeriod] = useState<Period>(presetPeriod('30'));
  const [focus, setFocus] = useState<Focus>(null);
  const [err, setErr] = useState<string | null>(null);

  const onErr = useCallback((e: unknown) => {
    if (e instanceof UnauthorizedError) signOut(); else setErr((e as Error).message);
  }, [signOut]);

  function choose(p: Preset) { setPreset(p); setPeriod(presetPeriod(p)); }
  function custom(k: 'from' | 'to', v: string) { setPreset('custom'); setPeriod((cur) => ({ ...cur, [k]: v || undefined })); }

  return (
    <div className="container" style={{ padding: '24px 20px 56px', maxWidth: 1120 }}>
      <h1 style={{ fontSize: 26, margin: '0 0 16px' }}>Аналитика</h1>

      <div className="card" style={{ padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        {PRESETS.map(([k, l]) => (
          <button key={k} onClick={() => choose(k)} className={preset === k ? 'btn btn-primary' : 'btn btn-ghost'} style={chip}>{l}</button>
        ))}
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto', fontSize: 14 }}>
          <span className="muted">с</span>
          <input type="date" className="input" value={period.from ?? ''} max={period.to} onChange={(e) => custom('from', e.target.value)} style={{ height: 36, padding: '0 8px' }} />
          <span className="muted">по</span>
          <input type="date" className="input" value={period.to ?? ''} min={period.from} onChange={(e) => custom('to', e.target.value)} style={{ height: 36, padding: '0 8px' }} />
        </span>
      </div>

      {err ? <p style={{ color: 'var(--sale)' }}>{err}</p> : null}

      {focus
        ? <Detail focus={focus} period={period} onBack={() => setFocus(null)} onErr={onErr} />
        : <Overview period={period} onOpen={setFocus} onErr={onErr} />}
    </div>
  );
}

/** Вся платформа: сводка, график, таблицы магазинов и клиентов. */
function Overview({ period, onOpen, onErr }: { period: Period; onOpen: (f: Focus) => void; onErr: (e: unknown) => void }) {
  const [tab, setTab] = useState<Tab>('stores');
  const [sum, setSum] = useState<Summary | null>(null);
  const [stores, setStores] = useState<StoreStat[] | null>(null);
  const [cust, setCust] = useState<CustomersResult | null>(null);
  const [custSort, setCustSort] = useState<CustSort>('spend');
  const [q, setQ] = useState('');

  useEffect(() => {
    setSum(null);
    analyticsSummary(period).then(setSum).catch(onErr);
  }, [period, onErr]);
  useEffect(() => {
    if (tab === 'stores') { setStores(null); analyticsStores(period).then((r) => setStores(r.rows)).catch(onErr); }
    else { setCust(null); analyticsCustomers(custSort, period).then(setCust).catch(onErr); }
  }, [tab, custSort, period, onErr]);

  const needle = q.trim().toLowerCase();
  const digits = needle.replace(/\D/g, '');
  const storeRows = useMemo(() => (stores ?? []).filter((s) => !needle || (s.name ?? '').toLowerCase().includes(needle)), [stores, needle]);
  const custRows = useMemo(() => (cust?.rows ?? []).filter((c) => !needle
    || (c.name ?? '').toLowerCase().includes(needle)
    || (digits.length >= 3 && (c.phone ?? '').replace(/\D/g, '').includes(digits))), [cust, needle, digits]);

  async function exportCsv() {
    try {
      if (tab === 'stores') await downloadCsv(`/admin/analytics/stores.csv?${periodCsvQs(period)}`, 'stores.csv');
      else await downloadCsv(`/admin/customers.csv?${periodCsvQs(period, { sort: custSort })}`, 'customers.csv');
    } catch (e) { onErr(e); }
  }

  return (
    <>
      <Totals sum={sum} scope="platform" />
      <Chart sum={sum} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '20px 0 12px', alignItems: 'center' }}>
        <button onClick={() => setTab('stores')} className={tab === 'stores' ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '8px 14px', fontSize: 14 }}>Магазины</button>
        <button onClick={() => setTab('customers')} className={tab === 'customers' ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '8px 14px', fontSize: 14 }}>Клиенты</button>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'stores' ? 'Поиск магазина' : 'Имя или телефон'}
          style={{ flex: '1 1 180px', height: 38, padding: '0 12px' }} />
        <button onClick={exportCsv} className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 14 }}>⬇ CSV</button>
      </div>

      {tab === 'customers' ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {([['spend', 'По сумме'], ['orders', 'По заказам'], ['recent', 'По дате']] as [CustSort, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setCustSort(k)} className={custSort === k ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '6px 12px', fontSize: 13 }}>{l}</button>
          ))}
        </div>
      ) : null}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        {tab === 'stores' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead><tr>
              <th style={th}>Магазин</th><th style={th}>Заказов</th><th style={th}>Оборот</th>
              <th style={th}>Ср. чек</th><th style={th}>Рейтинг</th><th style={th}>Посл. заказ</th><th style={th} />
            </tr></thead>
            <tbody>
              {stores === null ? <tr><td style={td} colSpan={7}><span className="muted">Загрузка…</span></td></tr>
                : storeRows.length === 0 ? <tr><td style={td} colSpan={7}><span className="muted">За этот период заказов нет.</span></td></tr>
                : storeRows.map((s) => (
                  <tr key={s.storeId} onClick={() => onOpen({ kind: 'store', id: s.storeId })} style={{ cursor: 'pointer' }}>
                    <td style={{ ...td, fontWeight: 700 }}>{s.name ?? '—'}</td>
                    <td style={td}>{s.ordersCount}</td>
                    <td style={td}>{tenge(s.gmvTiyn)}</td>
                    <td style={td}>{tenge(s.avgCheckTiyn)}</td>
                    <td style={td}>{s.rating ? s.rating.toFixed(1) : '—'}</td>
                    <td style={td}>{fmtDate(s.lastOrderAt)}</td>
                    <td style={{ ...td, color: 'var(--carrot)', fontWeight: 800 }}>→</td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead><tr>
              <th style={th}>Клиент</th><th style={th}>Телефон</th><th style={th}>Заказов</th><th style={th}>Потрачено</th><th style={th}>Посл. заказ</th><th style={th} />
            </tr></thead>
            <tbody>
              {cust === null ? <tr><td style={td} colSpan={6}><span className="muted">Загрузка…</span></td></tr>
                : custRows.length === 0 ? <tr><td style={td} colSpan={6}><span className="muted">За этот период заказов нет.</span></td></tr>
                : custRows.map((c) => (
                  <tr key={c.customerId} onClick={() => onOpen({ kind: 'customer', id: c.customerId })} style={{ cursor: 'pointer' }}>
                    <td style={{ ...td, fontWeight: 700 }}>{c.name ?? '—'}</td>
                    <td style={td}>{c.phone ? formatKzPhone(c.phone) : '—'}</td>
                    <td style={td}>{c.ordersCount}</td>
                    <td style={td}>{tenge(c.spentTiyn)}</td>
                    <td style={td}>{fmtDate(c.lastOrderAt)}</td>
                    <td style={{ ...td, color: 'var(--carrot)', fontWeight: 800 }}>→</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/** Один магазин или один клиент за период: сводка, график, все заказы. */
function Detail({ focus, period, onBack, onErr }: { focus: NonNullable<Focus>; period: Period; onBack: () => void; onErr: (e: unknown) => void }) {
  const [sum, setSum] = useState<Summary | null>(null);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);

  useEffect(() => {
    setSum(null); setOrders(null);
    const f = focus.kind === 'store' ? { storeId: focus.id } : { customerId: focus.id };
    analyticsSummary(period, f).then(setSum).catch(onErr);
    periodOrders(period, f).then((r) => setOrders(r.orders)).catch(onErr);
  }, [focus, period, onErr]);

  const title = focus.kind === 'store'
    ? sum?.store?.name ?? 'Магазин'
    : sum?.customer ? (sum.customer.name || (sum.customer.phone ? formatKzPhone(sum.customer.phone) : 'Клиент')) : 'Клиент';
  const sub = focus.kind === 'store'
    ? sum?.store ? `/${sum.store.slug} · ${sum.store.status}${sum.store.rating ? ` · ★ ${sum.store.rating.toFixed(1)}` : ''}` : ''
    : sum?.customer ? `${sum.customer.phone ? formatKzPhone(sum.customer.phone) : ''} · с нами с ${fmtDate(sum.customer.createdAt)}` : '';

  return (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
        <button onClick={onBack} className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 14 }}>← Назад</button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{focus.kind === 'store' ? '🏪 ' : '👤 '}{title}</div>
          <div className="muted" style={{ fontSize: 13 }}>{sub}</div>
        </div>
      </div>

      <Totals sum={sum} scope={focus.kind} />
      <Chart sum={sum} />

      <h2 style={{ fontSize: 18, margin: '20px 0 10px' }}>Заказы за период{orders ? ` · ${orders.length}` : ''}</h2>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead><tr>
            <th style={th}>№</th><th style={th}>Когда</th><th style={th}>{focus.kind === 'store' ? 'Клиент' : 'Магазин'}</th>
            <th style={th}>Статус</th><th style={th}>Позиций</th><th style={th}>Сумма</th><th style={th}>Способ</th>
          </tr></thead>
          <tbody>
            {orders === null ? <tr><td style={td} colSpan={7}><span className="muted">Загрузка…</span></td></tr>
              : orders.length === 0 ? <tr><td style={td} colSpan={7}><span className="muted">За этот период заказов нет.</span></td></tr>
              : orders.map((o) => (
                <tr key={o.id} style={{ opacity: o.status === 'CANCELLED' ? 0.55 : 1 }}>
                  <td style={{ ...td, fontWeight: 700 }}>{o.number}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDateTime(o.createdAt)}</td>
                  <td style={td}>{focus.kind === 'store'
                    ? (o.customer?.name || (o.customer?.phone ? formatKzPhone(o.customer.phone) : '—'))
                    : (o.store?.name ?? '—')}</td>
                  <td style={td}>{STATUS_RU[o.status] ?? o.status}</td>
                  <td style={td}>{o.itemCount ?? '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{tenge(o.amountTiyn)}</td>
                  <td style={td}>{o.fulfillment === 'PICKUP' ? 'Самовывоз' : o.fulfillment ? 'Доставка' : '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Totals({ sum, scope }: { sum: Summary | null; scope: 'platform' | 'store' | 'customer' }) {
  const t = sum?.totals;
  const v = (x: string) => (t ? x : '…');
  const cards: [string, string][] = [
    ['Заказов', v(String(t?.orders ?? 0))],
    ['Оборот', v(tenge(t?.gmvTiyn ?? 0))],
    ['Средний чек', v(tenge(t?.avgCheckTiyn ?? 0))],
  ];
  if (scope !== 'customer') cards.push(['Клиентов', v(String(t?.customers ?? 0))]);
  if (scope === 'platform') cards.push(['Магазинов с заказами', v(String(t?.stores ?? 0))]);
  if (scope === 'customer') cards.push(['Магазинов', v(String(t?.stores ?? 0))]);
  cards.push(['Самовывоз', v(t && t.orders ? `${Math.round((t.pickup / t.orders) * 100)}%` : '—')]);
  cards.push(['Отмен', v(String(t?.cancelled ?? 0))]);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 12 }}>
      {cards.map(([l, val]) => (
        <div key={l} className="card" style={{ padding: '12px 16px' }}>
          <div className="muted" style={{ fontSize: 13 }}>{l}</div>
          <div style={{ fontWeight: 800, fontSize: 20, whiteSpace: 'nowrap' }}>{val}</div>
        </div>
      ))}
    </div>
  );
}

/** Столбики по дням: высота — оборот, подсказка — дата, заказы, сумма. */
function Chart({ sum }: { sum: Summary | null }) {
  const [metric, setMetric] = useState<'gmv' | 'orders'>('gmv');
  const days = sum?.days ?? [];
  if (!sum || days.length < 2) return null;
  const val = (d: Summary['days'][number]) => (metric === 'gmv' ? d.gmvTiyn : d.orders);
  const max = Math.max(1, ...days.map(val));
  const label = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <strong style={{ flex: 1 }}>По дням</strong>
        <button onClick={() => setMetric('gmv')} className={metric === 'gmv' ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '4px 10px', fontSize: 12 }}>Оборот</button>
        <button onClick={() => setMetric('orders')} className={metric === 'orders' ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '4px 10px', fontSize: 12 }}>Заказы</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: days.length > 60 ? 1 : 3, height: 140 }}>
        {days.map((d) => (
          <div key={d.date} title={`${label(d.date)}: ${d.orders} зак. · ${tenge(d.gmvTiyn)}`}
            style={{ flex: 1, minWidth: 0, height: `${Math.max(val(d) ? 4 : 1, (val(d) / max) * 100)}%`, background: val(d) ? 'var(--carrot)' : 'var(--line)', borderRadius: '3px 3px 0 0' }} />
        ))}
      </div>
      <div className="muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6 }}>
        <span>{label(days[0].date)}</span>
        <span>макс. {metric === 'gmv' ? tenge(max) : `${max} зак.`} в день</span>
        <span>{label(days[days.length - 1].date)}</span>
      </div>
    </div>
  );
}
