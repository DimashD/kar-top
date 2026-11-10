'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CLIENT_API } from '../lib/api';
import { tenge } from '../lib/format';
import { LOCALES } from '../lib/i18n';
import { formatKzPhone } from '../lib/phone';
import { useLang, useT } from './LangProvider';
import { accessToken, AuthSheet, readSession } from './StoreView';
import StoreMenu from './StoreMenu';
import BottomNav from './BottomNav';

type MyOrder = {
  id: string; number: number; status: string; createdAt: string; fulfillment: 'DELIVERY' | 'PICKUP'; pickupAt: string | null;
  totalTiyn: number; final: boolean; itemCount: number; store: { name: string; slug: string };
};

const DONE = ['DELIVERED', 'COMPLETED', 'CANCELLED'];
// Цвет статуса: ждёт — оранжевый, нужен ответ — янтарный, в работе — синий, готов/в пути — фиолетовый, получен — зелёный.
function tone(s: string): { fg: string; bg: string } {
  if (s === 'PLACED') return { fg: 'var(--carrot-600)', bg: 'var(--carrot-50)' };
  if (s === 'AWAITING_CUSTOMER') return { fg: '#9A6700', bg: '#FFF4D6' };
  if (s === 'ACCEPTED' || s === 'PICKING') return { fg: '#1D5FBF', bg: '#E7F0FD' };
  if (s === 'READY' || s === 'COURIER_ASSIGNED' || s === 'DELIVERING') return { fg: '#6B3FC2', bg: '#F0EAFB' };
  if (s === 'DELIVERED' || s === 'COMPLETED') return { fg: 'var(--leaf)', bg: 'var(--leaf-50)' };
  return { fg: 'var(--ink-60)', bg: 'var(--line)' };
}

/** «Мои заказы»: активные сверху, затем завершённые; нажатие — страница заказа со статусом. */
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

  const active = (orders ?? []).filter((o) => !DONE.includes(o.status));
  const past = (orders ?? []).filter((o) => DONE.includes(o.status));
  const card = (o: MyOrder) => {
    const c = tone(o.status);
    return (
      <Link key={o.id} href={`/order/${o.id}`} className="card" style={{ display: 'block', padding: 16, color: 'var(--ink)', textDecoration: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 16, flex: 1, minWidth: 0 }}>{o.store.name}</div>
          <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 13, fontWeight: 700, color: c.fg, background: c.bg, whiteSpace: 'nowrap' }}>{t.orderStatus[o.status] ?? o.status}</span>
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
      <header style={{ background: 'var(--card)', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, zIndex: 5 }}>
        <div className="container" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, maxWidth: 760 }}>
          <StoreMenu />
          <h1 style={{ fontSize: 20, margin: 0, flex: 1 }}>{t.myOrders}</h1>
        </div>
      </header>
      <div className="container" style={{ padding: '16px 20px', maxWidth: 760, display: 'grid', gap: 12 }}>
        {orders === null ? <p className="muted">…</p> : needLogin ? (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}>🧾</div>
            <p style={{ margin: '8px 0 16px' }}>{t.loginToSeeOrders}</p>
            <button className="btn btn-primary" onClick={() => setAuth(true)} style={{ height: 48, padding: '0 28px' }}>{t.loginBtn}</button>
          </div>
        ) : orders.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}>🛒</div>
            <p style={{ margin: '8px 0 16px' }}>{t.noOrders}</p>
            <Link className="btn btn-primary" href="/" style={{ padding: '12px 24px' }}>{t.navStores}</Link>
          </div>
        ) : (
          <>
            {active.length ? <h2 style={{ fontSize: 16, margin: '4px 0 0' }}>{t.activeOrders}</h2> : null}
            {active.map(card)}
            {past.length ? <h2 style={{ fontSize: 16, margin: '8px 0 0' }}>{t.pastOrders}</h2> : null}
            {past.map(card)}
          </>
        )}
      </div>
      {auth ? (
        <AuthSheet initialPhone={readSession()?.phone ? formatKzPhone(readSession()!.phone) : '+7'}
          hint={t.loginToSeeOrders} onClose={() => setAuth(false)} onDone={() => { setAuth(false); load(); }} />
      ) : null}
      <BottomNav />
    </main>
  );
}
