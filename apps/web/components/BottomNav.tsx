'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CLIENT_API } from '../lib/api';
import { accessToken, readSession } from './StoreView';
import { useT } from './LangProvider';
import Icon, { IconName } from './Icon';

/** Высота нижнего меню — страницы оставляют под него место. */
export const BOTTOM_NAV_H = 64;

/** Нижнее меню покупателя (сайт и приложение): Магазины · Заказы · Уведомления · Профиль. */
export default function BottomNav() {
  const t = useT();
  const path = usePathname() ?? '/';
  const unread = useUnread();
  const tab = (href: string, icon: IconName, label: string, active: boolean, badge = 0) => (
    <Link href={href} style={{ ...item, color: active ? 'var(--carrot)' : 'var(--ink-60)' }}>
      <span style={{ lineHeight: 0, position: 'relative' }}><Icon name={icon} size={24} stroke={active ? 2.2 : 1.8} />
        {badge > 0 ? <span style={{ position: 'absolute', top: -6, right: -12, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: 'var(--carrot)', color: '#fff', fontSize: 11, fontWeight: 800, lineHeight: '18px', textAlign: 'center' }}>{badge > 99 ? '99+' : badge}</span> : null}
      </span>
      <span style={{ fontSize: 12, fontWeight: active ? 800 : 600 }}>{label}</span>
    </Link>
  );
  return (
    <>
      <div className="m-only" style={{ height: BOTTOM_NAV_H }} />
      <nav className="m-only" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 15, background: 'var(--card)', borderTop: '1px solid var(--line)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div style={{ display: 'flex', maxWidth: 560, margin: '0 auto', height: BOTTOM_NAV_H }}>
          {tab('/', 'store', t.navStores, !path.startsWith('/orders') && !path.startsWith('/order/') && !path.startsWith('/notifications') && !path.startsWith('/profile'))}
          {tab('/orders', 'receipt', t.navOrders, path.startsWith('/orders') || path.startsWith('/order/'))}
          {tab('/notifications', 'bell', t.navNotifications, path.startsWith('/notifications'), path.startsWith('/notifications') ? 0 : unread)}
          {tab('/profile', 'user', t.navProfile, path.startsWith('/profile'))}
        </div>
      </nav>
    </>
  );
}

const item: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, textDecoration: 'none' };

/** Непрочитанные уведомления вошедшего покупателя (обновляется раз в 30 с и при возврате на вкладку). */
export function useUnread(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!readSession() || document.visibilityState !== 'visible') return;
      const token = await accessToken();
      if (!token) return;
      const r = await fetch(`${CLIENT_API}/me/notifications?app=customer`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' }).catch(() => null);
      if (alive && r?.ok) setN((await r.json()).unread ?? 0);
    };
    load();
    const id = setInterval(load, 30_000);
    document.addEventListener('visibilitychange', load);
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', load); };
  }, []);
  return n;
}
