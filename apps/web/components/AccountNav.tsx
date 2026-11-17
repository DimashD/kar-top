'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Icon, { IconName } from './Icon';
import { useT } from './LangProvider';
import { useUnread } from './BottomNav';
import { readSession } from './StoreView';
import { formatKzPhone } from '../lib/phone';

/** Личный кабинет на компьютере: слева номер покупателя и разделы; на телефоне скрыто (там нижнее меню). */
export default function AccountNav() {
  const t = useT();
  const path = usePathname() ?? '';
  const unread = useUnread();
  const [phone, setPhone] = useState<string | null>(null);
  useEffect(() => { setPhone(readSession()?.phone ?? null); }, []);
  const item = (href: string, icon: IconName, label: string, badge = 0) => (
    <Link href={href} className="acct-link" aria-current={path.startsWith(href) ? 'page' : undefined}>
      <Icon name={icon} size={20} /><span style={{ flex: 1 }}>{label}</span>
      {badge ? <span className="site-badge">{badge > 99 ? '99+' : badge}</span> : null}
    </Link>
  );
  return (
    <aside className="acct-nav">
      <div className="acct-me">
        <span className="acct-ava"><Icon name="user" size={22} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800 }}>{t.navProfile}</div>
          <div className="muted" style={{ fontSize: 13 }}>{phone ? formatKzPhone(phone) : t.notLoggedIn}</div>
        </div>
      </div>
      {item('/orders', 'receipt', t.myOrders)}
      {item('/notifications', 'bell', t.navNotifications, path.startsWith('/notifications') ? 0 : unread)}
      {item('/profile', 'user', t.navProfile)}
      <div className="acct-sep" />
      <Link href="/" className="acct-link"><Icon name="store" size={20} />{t.navStores}</Link>
      <Link href="/partner" className="acct-link"><Icon name="package" size={20} />{t.sellerShort}</Link>
    </aside>
  );
}
