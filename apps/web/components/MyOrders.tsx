'use client';

import Link from 'next/link';
import AppOnly, { useInApp } from './AppOnly';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CLIENT_API } from '../lib/api';
import { tenge } from '../lib/format';
import { LOCALES } from '../lib/i18n';
import { formatKzPhone } from '../lib/phone';
import { useLang, useT } from './LangProvider';
import { accessToken, AuthSheet, readSession } from './StoreView';
import StoreMenu from './StoreMenu';
import AccountNav from './AccountNav';
import BottomNav from './BottomNav';
import { IconTile } from './Icon';

type MyOrder = {
  id: string; number: number; status: string; createdAt: string; fulfillment: 'DELIVERY' | 'PICKUP'; pickupAt: string | null;
  totalTiyn: number; final: boolean; itemCount: number; store: { name: string; slug: string };
};

const RECEIVED = ['DELIVERED', 'COMPLETED'];
const DONE = [...RECEIVED, 'CANCELLED'];
type Filter = 'all' | 'active' | 'received' | 'cancelled';
const inFilter = (f: Filter, s: string) =>
  f === 'all' ? true : f === 'active' ? !DONE.includes(s) : f === 'received' ? RECEIVED.includes(s) : s === 'CANCELLED';
// Цвет статуса: ждёт — оранжевый, нужен ответ — янтарный, в работе — синий, готов/в пути — фиолетовый, получен — зелёный.
function tone(s: string): { fg: string; bg: string } {
  if (s === 'PLACED') return { fg: 'var(--carrot-600)', bg: 'var(--carrot-50)' };
  if (s === 'AWAITING_CUSTOMER') return { fg: '#9A6700', bg: '#FFF4D6' };
  if (s === 'ACCEPTED' || s === 'PICKING') return { fg: '#1D5FBF', bg: '#E7F0FD' };
  if (s === 'READY' || s === 'COURIER_ASSIGNED' || s === 'DELIVERING') return { fg: '#6B3FC2', bg: '#F0EAFB' };
  if (s === 'DELIVERED' || s === 'COMPLETED') return { fg: 'var(--leaf)', bg: 'var(--leaf-50)' };
  return { fg: 'var(--ink-60)', bg: 'var(--line)' };
}

/**
 * «Мои заказы». В приложении — фильтр по статусам (Все / В работе / Получены / Отменены, со счётчиками),
 * заказы «Нужен ваш ответ» — первыми. В браузере статусов нет (они только в приложении) — простой список по дате.
 */
export default function MyOrders() {
  const t = useT();
  const lang = useLang();
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [auth, setAuth] = useState(false);

  const load = useCallback(async () => {
    const token = await accessToken();
    if (!token) { setNeedLogin(true); setOrders([]); return; }
    setNeedLogin(false);
    const r = await fetch(`${CLIENT_API}/me/orders`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' }).catch(() => null);
    setOrders(r?.ok ? await r.json() : []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const inApp = useInApp();
  const counts = useMemo(() => {
    const list = orders ?? [];
    return (['all', 'active', 'received', 'cancelled'] as Filter[]).map((f) => [f, list.filter((o) => inFilter(f, o.status)).length] as const);
  }, [orders]);
  // По умолчанию: есть заказы в работе — показываем их, иначе все.
  const [filter, setFilter] = useState<Filter | null>(null);
  const current: Filter = filter ?? ((counts.find(([f]) => f === 'active')?.[1] ?? 0) > 0 ? 'active' : 'all');
  const shown = useMemo(() => (orders ?? [])
    .filter((o) => !inApp || inFilter(current, o.status))
    // «Нужен ваш ответ» — всегда сверху; дальше новые выше.
    .sort((a, b) => (inApp ? Number(b.status === 'AWAITING_CUSTOMER') - Number(a.status === 'AWAITING_CUSTOMER') : 0)
      || +new Date(b.createdAt) - +new Date(a.createdAt)), [orders, inApp, current]);
  const label: Record<Filter, string> = { all: t.filterAll, active: t.filterActive, received: t.filterReceived, cancelled: t.filterCancelled };
  const card = (o: MyOrder) => {
    const c = tone(o.status);
    return (
      <Link key={o.id} href={`/order/${o.id}`} className="card" style={{ display: 'block', padding: 16, color: 'var(--ink)', textDecoration: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 16, flex: 1, minWidth: 0 }}>{o.store.name}</div>
          {/* Статус заказа — только в приложении. */}
          <AppOnly><span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 13, fontWeight: 700, color: c.fg, background: c.bg, whiteSpace: 'nowrap' }}>{t.orderStatus[o.status] ?? o.status}</span></AppOnly>
        </div>
        <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
          {t.orderNo(o.number)} · {new Date(o.createdAt).toLocaleString(LOCALES[lang], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          {' · '}{o.fulfillment === 'PICKUP' ? t.pickup : t.delivery}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <span className="muted" style={{ fontSize: 14 }}>{t.itemsCount}: {o.itemCount}</span>
          <span style={{ fontWeight: 800 }}>{o.final ? '' : '≈ '}{tenge(o.totalTiyn)} ›</span>
        </div>
      </Link>
    );
  };

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div className="acct">
      <AccountNav />
      <div className="acct-main">
      <header className="page-head" style={{ background: 'var(--card)', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, zIndex: 5 }}>
        <div className="container dk-wide" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, maxWidth: 760 }}>
          <span className="m-only"><StoreMenu /></span>
          <h1 style={{ fontSize: 20, margin: 0, flex: 1 }}>{t.myOrders}</h1>
        </div>
      </header>
      <div className="container dk-wide orders-grid" style={{ padding: '16px 20px', maxWidth: 760, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
        {orders === null ? <p className="muted">…</p> : needLogin ? (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <IconTile name="receipt" size={56} round />
            <p style={{ margin: '8px 0 16px' }}>{t.loginToSeeOrders}</p>
            <button className="btn btn-primary" onClick={() => setAuth(true)} style={{ height: 48, padding: '0 28px' }}>{t.loginBtn}</button>
          </div>
        ) : orders.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <IconTile name="cart" size={56} round />
            <p style={{ margin: '8px 0 16px' }}>{t.noOrders}</p>
            <Link className="btn btn-primary" href="/" style={{ padding: '12px 24px' }}>{t.navStores}</Link>
          </div>
        ) : (
          <>
            {inApp ? (
              <div role="tablist" aria-label={t.myOrders} style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -20px', padding: '0 20px 2px', flex: 'none' }}>
                {counts.filter(([f, n]) => f === 'all' || n > 0).map(([f, n]) => (
                  <button key={f} role="tab" aria-selected={current === f} onClick={() => setFilter(f)}
                    style={{ flex: 'none', padding: '8px 14px', borderRadius: 999, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                      border: current === f ? '2px solid var(--carrot)' : '1px solid var(--line)', background: current === f ? 'var(--carrot-50)' : 'var(--card)', color: 'var(--ink)' }}>
                    {label[f]} <span style={{ color: 'var(--ink-60)', fontWeight: 600 }}>{n}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {shown.length ? shown.map(card) : <p className="muted" style={{ textAlign: 'center', margin: '24px 0' }}>{t.noOrdersInFilter}</p>}
          </>
        )}
      </div>
      {auth ? (
        <AuthSheet initialPhone={readSession()?.phone ? formatKzPhone(readSession()!.phone) : '+7'}
          hint={t.loginToSeeOrders} confirmLabel={t.loginBtn} onClose={() => setAuth(false)} onDone={() => { setAuth(false); load(); }} />
      ) : null}
      </div>
      </div>
      <BottomNav />
    </main>
  );
}
