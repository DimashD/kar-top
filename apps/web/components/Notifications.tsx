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
import { IconName, IconTile } from './Icon';

/** Значок и цвет по событию: сразу видно, что случилось с заказом. */
function lookOf(type: string): { icon: IconName; bg: string; fg: string } {
  const m: Record<string, [IconName, string, string]> = {
    'order.placed_customer': ['checkCircle', '#E9F2EB', '#2F7A4D'], 'order.accepted': ['thumb', '#E7F0FD', '#2A5DB0'], 'order.picking': ['basket', '#E7F0FD', '#2A5DB0'],
    'order.awaiting_customer': ['phone', '#FFF4D6', '#8A5A00'], 'order.substitution_needed': ['alert', '#FFF4D6', '#8A5A00'], 'order.ready': ['package', '#F0EAFB', '#6B3FB5'],
    'order.delivering': ['scooter', '#F0EAFB', '#6B3FB5'], 'order.delivered': ['heart', '#E9F2EB', '#2F7A4D'], 'order.price_updated': ['tenge', '#FCF4E6', '#8A5A00'], 'order.cancelled': ['xCircle', '#F4F2F0', '#6B625C'],
  };
  const [icon, bg, fg] = m[type] ?? ['bell', '#F4F2F0', '#6B625C'];
  return { icon, bg, fg };
}
/** Заголовок без значка в начале (значок уже слева в кружке). */
const plain = (s: string) => s.replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, '');
/** Группы по дням: «Сегодня», «Вчера», дата. */
function groups(items: Item[], lang: string, t: { today: string; yesterday: string }): [string, Item[]][] {
  const out = new Map<string, Item[]>();
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = day(new Date());
  for (const n of items) {
    const d = new Date(n.createdAt);
    const diff = Math.round((today - day(d)) / 86400000);
    const label = diff === 0 ? t.today : diff === 1 ? t.yesterday : d.toLocaleDateString(LOCALES[lang as keyof typeof LOCALES], { day: 'numeric', month: 'long' });
    out.set(label, [...(out.get(label) ?? []), n]);
  }
  return [...out.entries()];
}

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
      <header className="page-head" style={{ background: 'var(--card)', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, zIndex: 5 }}>
        <div className="container" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, maxWidth: 760 }}>
          <span className="m-only"><StoreMenu /></span>
          <h1 style={{ fontSize: 20, margin: 0, flex: 1 }}>{t.navNotifications}</h1>
        </div>
      </header>
      <div className="container" style={{ padding: '16px 20px', maxWidth: 760, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>
        {items === null ? <p className="muted">…</p> : needLogin ? (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <IconTile name="bell" size={56} round />
            <p style={{ margin: '8px 0 16px' }}>{t.loginToSeeOrders}</p>
            <button className="btn btn-primary" onClick={() => setAuth(true)} style={{ height: 48, padding: '0 28px' }}>{t.loginBtn}</button>
          </div>
        ) : items.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}><IconTile name="bell" size={56} round /><p>{t.noNotifications}</p></div>
        ) : groups(items, lang, t).map(([day, list]) => (
          <section key={day}>
            <div className="muted" style={{ fontSize: 13, fontWeight: 700, margin: '6px 4px 8px' }}>{day}</div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {list.map((n, i) => {
                const look = lookOf(n.type);
                const href = n.type.startsWith('order.') && n.refId ? `/order/${n.refId}` : null;
                const row = (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: i ? '1px solid var(--line)' : 'none', background: n.readAt ? 'transparent' : 'var(--carrot-50)' }}>
                    <IconTile name={look.icon} size={40} bg={look.bg} color={look.fg} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: n.readAt ? 700 : 800, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plain(n.title)}</span>
                      <span className="muted" style={{ display: 'block', fontSize: 13, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.body}</span>
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flex: 'none' }}>
                      <span className="muted" style={{ fontSize: 12 }}>{new Date(n.createdAt).toLocaleTimeString(LOCALES[lang], { hour: '2-digit', minute: '2-digit' })}</span>
                      {n.readAt ? null : <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--carrot)' }} />}
                    </span>
                  </div>
                );
                return href ? <Link key={n.id} href={href} style={{ color: 'var(--ink)', textDecoration: 'none', display: 'block' }}>{row}</Link> : <div key={n.id}>{row}</div>;
              })}
            </div>
          </section>
        ))}
      </div>
      {auth ? (
        <AuthSheet initialPhone={readSession()?.phone ? formatKzPhone(readSession()!.phone) : '+7'}
          hint={t.loginToSeeOrders} confirmLabel={t.loginBtn} onClose={() => setAuth(false)} onDone={() => { setAuth(false); load(); }} />
      ) : null}
      <BottomNav />
    </main>
  );
}
