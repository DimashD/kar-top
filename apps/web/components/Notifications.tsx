'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CLIENT_API } from '../lib/api';
import { LOCALES } from '../lib/i18n';
import { formatKzPhone } from '../lib/phone';
import { useLang, useT } from './LangProvider';
import { accessToken, AuthSheet, readSession } from './StoreView';
import StoreMenu from './StoreMenu';
import BottomNav from './BottomNav';

type Item = { id: string; type: string; refId: string | null; title: string; body: string; url: string | null; readAt: string | null; createdAt: string };

/** Центр уведомлений покупателя: статусы заказов; новые выделены, при открытии отмечаются прочитанными. */
export default function Notifications() {
  const t = useT();
  const lang = useLang();
  const [items, setItems] = useState<Item[] | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [auth, setAuth] = useState(false);

  const load = useCallback(async () => {
    const token = await accessToken();
    if (!token) { setNeedLogin(true); setItems([]); return; }
    setNeedLogin(false);
    const r = await fetch(`${CLIENT_API}/me/notifications?app=customer`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' }).catch(() => null);
    setItems(r?.ok ? (await r.json()).items : []);
    fetch(`${CLIENT_API}/me/notifications/read?app=customer`, { method: 'POST', headers: { authorization: `Bearer ${token}` } }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <header style={{ background: 'var(--card)', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, zIndex: 5 }}>
        <div className="container" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, maxWidth: 760 }}>
          <StoreMenu />
          <h1 style={{ fontSize: 20, margin: 0, flex: 1 }}>{t.navNotifications}</h1>
        </div>
      </header>
      <div className="container" style={{ padding: '16px 20px', maxWidth: 760, display: 'grid', gap: 10 }}>
        {items === null ? <p className="muted">…</p> : needLogin ? (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}>🔔</div>
            <p style={{ margin: '8px 0 16px' }}>{t.loginToSeeOrders}</p>
            <button className="btn btn-primary" onClick={() => setAuth(true)} style={{ height: 48, padding: '0 28px' }}>{t.loginBtn}</button>
          </div>
        ) : items.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}><div style={{ fontSize: 40 }}>🔔</div><p>{t.noNotifications}</p></div>
        ) : items.map((n) => {
          const href = n.type.startsWith('order.') && n.refId ? `/order/${n.refId}` : null;
          const body = (
            <div className="card" style={{ padding: 14, display: 'flex', gap: 12, background: n.readAt ? 'var(--card)' : 'var(--carrot-50)' }}>
              <span style={{ fontSize: 24 }}>{n.type.startsWith('order.') ? '🧾' : '🔔'}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: n.readAt ? 700 : 800 }}>{n.title}</span>
                <span style={{ display: 'block', fontSize: 14, marginTop: 2 }}>{n.body}</span>
                <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
                  {new Date(n.createdAt).toLocaleString(LOCALES[lang], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </span>
            </div>
          );
          return href ? <Link key={n.id} href={href} style={{ color: 'var(--ink)', textDecoration: 'none' }}>{body}</Link> : <div key={n.id}>{body}</div>;
        })}
      </div>
      {auth ? (
        <AuthSheet initialPhone={readSession()?.phone ? formatKzPhone(readSession()!.phone) : '+7'}
          hint={t.loginToSeeOrders} onClose={() => setAuth(false)} onDone={() => { setAuth(false); load(); }} />
      ) : null}
      <BottomNav />
    </main>
  );
}
