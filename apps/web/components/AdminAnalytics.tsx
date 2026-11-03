'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  StoreStat, CustomerRow, CustomersResult,
  analyticsStores, analyticsCustomers, downloadCsv, UnauthorizedError,
} from '../lib/admin';
import { useAdmin } from './AdminShell';
import { formatKzPhone } from '../lib/phone';
import { tenge } from '../lib/format';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
  catch { return iso; }
}

type Tab = 'stores' | 'customers';
type CustSort = 'spend' | 'orders' | 'recent';

export default function AdminAnalytics() {
  const { signOut } = useAdmin();
  const [tab, setTab] = useState<Tab>('stores');
  const [storeRows, setStoreRows] = useState<StoreStat[]>([]);
  const [cust, setCust] = useState<CustomersResult | null>(null);
  const [custSort, setCustSort] = useState<CustSort>('spend');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      if (tab === 'stores') setStoreRows((await analyticsStores()).rows);
      else setCust(await analyticsCustomers(custSort));
    } catch (e) { if (e instanceof UnauthorizedError) signOut(); else setErr((e as Error).message); }
    finally { setLoading(false); }
  }, [tab, custSort, signOut]);

  useEffect(() => { load(); }, [load]);

  async function exportCsv() {
    try {
      if (tab === 'stores') await downloadCsv('/admin/analytics/stores.csv', 'stores.csv');
      else await downloadCsv(`/admin/customers.csv?sort=${custSort}`, 'customers.csv');
    } catch (e) { setErr((e as Error).message); }
  }

  const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 700, color: 'var(--ink-60)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '10px 12px', fontSize: 14, borderBottom: '1px solid var(--line)' };

  return (
    <div className="container" style={{ padding: '24px 20px 56px', maxWidth: 920 }}>
      <h1 style={{ fontSize: 26, margin: '0 0 16px' }}>Аналитика</h1>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <button onClick={() => setTab('stores')} className={tab === 'stores' ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '8px 14px', fontSize: 14 }}>Магазины</button>
        <button onClick={() => setTab('customers')} className={tab === 'customers' ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '8px 14px', fontSize: 14 }}>Клиенты</button>
        <button onClick={exportCsv} className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 14, marginLeft: 'auto' }}>⬇ Экспорт CSV</button>
      </div>

      {err ? <p style={{ color: 'var(--sale)' }}>{err}</p> : null}

      {tab === 'customers' && cust ? (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <Stat label="Клиентов" value={String(cust.totals.customers)} />
          <Stat label="Заказов" value={String(cust.totals.orders)} />
          <Stat label="Оборот (GMV)" value={tenge(cust.totals.gmvTiyn)} />
        </div>
      ) : null}

      {tab === 'customers' ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {([['spend', 'По сумме'], ['orders', 'По заказам'], ['recent', 'По дате']] as [CustSort, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setCustSort(k)} className={custSort === k ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '6px 12px', fontSize: 13 }}>{l}</button>
          ))}
        </div>
      ) : null}

      {loading ? <p className="muted">Загрузка…</p> : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          {tab === 'stores' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead><tr>
                <th style={th}>Магазин</th><th style={th}>Статус</th><th style={th}>Заказов</th>
                <th style={th}>Оборот</th><th style={th}>Ср. чек</th><th style={th}>Рейтинг</th><th style={th}>Посл. заказ</th>
              </tr></thead>
              <tbody>
                {storeRows.length === 0 ? <tr><td style={td} colSpan={7}><span className="muted">Данных пока нет.</span></td></tr> :
                  storeRows.map((s) => (
                    <tr key={s.storeId}>
                      <td style={{ ...td, fontWeight: 700 }}>{s.name ?? '—'}</td>
                      <td style={td}>{s.status ?? '—'}</td>
                      <td style={td}>{s.ordersCount}</td>
                      <td style={td}>{tenge(s.gmvTiyn)}</td>
                      <td style={td}>{tenge(s.avgCheckTiyn)}</td>
                      <td style={td}>{s.rating ? s.rating.toFixed(1) : '—'}</td>
                      <td style={td}>{fmtDate(s.lastOrderAt)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead><tr>
                <th style={th}>Клиент</th><th style={th}>Телефон</th><th style={th}>Заказов</th><th style={th}>Потрачено</th><th style={th}>Посл. заказ</th>
              </tr></thead>
              <tbody>
                {!cust || cust.rows.length === 0 ? <tr><td style={td} colSpan={5}><span className="muted">Данных пока нет.</span></td></tr> :
                  cust.rows.map((c) => (
                    <tr key={c.customerId}>
                      <td style={{ ...td, fontWeight: 700 }}>{c.name ?? '—'}</td>
                      <td style={td}>{c.phone ? formatKzPhone(c.phone) : '—'}</td>
                      <td style={td}>{c.ordersCount}</td>
                      <td style={td}>{tenge(c.spentTiyn)}</td>
                      <td style={td}>{fmtDate(c.lastOrderAt)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card" style={{ padding: '14px 18px', minWidth: 140 }}>
      <div className="muted" style={{ fontSize: 13 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 20 }}>{value}</div>
    </div>
  );
}
