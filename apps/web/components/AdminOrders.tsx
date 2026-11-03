'use client';

import { useCallback, useEffect, useState } from 'react';
import { OrderRow, listOrders, UnauthorizedError } from '../lib/admin';
import { useAdmin } from './AdminShell';
import { formatKzPhone } from '../lib/phone';
import { tenge } from '../lib/format';

const STATUS_RU: Record<string, string> = {
  CREATED: 'Создан', PLACED: 'Оформлен', ACCEPTED: 'Принят', PICKING: 'Сборка',
  AWAITING_CUSTOMER: 'Ждёт клиента', READY: 'Готов', COURIER_ASSIGNED: 'Курьер назначен',
  DELIVERING: 'Доставка', DELIVERED: 'Доставлен', COMPLETED: 'Завершён', CANCELLED: 'Отменён',
};
const FILTERS = [
  { key: 'ALL', label: 'Все' },
  { key: 'PLACED', label: 'Новые' },
  { key: 'PICKING', label: 'В сборке' },
  { key: 'DELIVERING', label: 'В доставке' },
  { key: 'COMPLETED', label: 'Завершённые' },
  { key: 'CANCELLED', label: 'Отменённые' },
];

function fmt(iso: string): string {
  try { return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

export default function AdminOrders() {
  const { signOut } = useAdmin();
  const [filter, setFilter] = useState('ALL');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (f: string) => {
    setLoading(true); setErr(null);
    try { setOrders((await listOrders(f)).orders); }
    catch (e) { if (e instanceof UnauthorizedError) signOut(); else setErr((e as Error).message); }
    finally { setLoading(false); }
  }, [signOut]);

  useEffect(() => { load(filter); }, [filter, load]);

  const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 700, color: 'var(--ink-60)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '10px 12px', fontSize: 14, borderBottom: '1px solid var(--line)' };

  return (
    <div className="container" style={{ padding: '24px 20px 56px', maxWidth: 920 }}>
      <h1 style={{ fontSize: 26, margin: '0 0 16px' }}>Заказы</h1>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={filter === f.key ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '8px 14px', fontSize: 14 }}>{f.label}</button>
        ))}
        <button className="btn btn-ghost" onClick={() => load(filter)} style={{ padding: '8px 14px', fontSize: 14, marginLeft: 'auto' }}>↻ Обновить</button>
      </div>

      {err ? <p style={{ color: 'var(--sale)' }}>{err}</p> : null}
      {loading ? <p className="muted">Загрузка…</p> : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
            <thead><tr>
              <th style={th}>№</th><th style={th}>Статус</th><th style={th}>Магазин</th>
              <th style={th}>Клиент</th><th style={th}>Сумма</th><th style={th}>Способ</th><th style={th}>Дата</th>
            </tr></thead>
            <tbody>
              {orders.length === 0 ? <tr><td style={td} colSpan={7}><span className="muted">Заказов нет.</span></td></tr> :
                orders.map((o) => (
                  <tr key={o.id}>
                    <td style={{ ...td, fontWeight: 700 }}>#{o.number}</td>
                    <td style={td}>{STATUS_RU[o.status] ?? o.status}</td>
                    <td style={td}>{o.store?.name ?? '—'}</td>
                    <td style={td}>{o.customer?.phone ? formatKzPhone(o.customer.phone) : (o.customer?.name ?? '—')}</td>
                    <td style={td}>{tenge(o.amountTiyn)}</td>
                    <td style={td}>{o.fulfillment === 'PICKUP' ? 'Самовывоз' : 'Доставка'}</td>
                    <td style={td}>{fmt(o.createdAt)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
