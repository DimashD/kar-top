'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';
import Icon, { IconName } from './Icon';
import { LangSwitcher, useT } from './LangProvider';
import { useUnread } from './BottomNav';

// Разделы сайта покупателя; всё остальное с одним сегментом пути — витрина магазина (у неё своя шапка).
const SITE = ['orders', 'order', 'notifications', 'profile', 'partner', 'app', 'terms', 'privacy', 'consent', 'merchant-offer', 'delete-account'];

/**
 * Шапка сайта на компьютере (от 1100 px): логотип, разделы вместо нижнего меню телефона, язык, «Для магазинов».
 * На телефоне скрыта CSS-классом — там нижнее меню. Не показываем в админке и на витрине магазина.
 */
export default function SiteHeader() {
  const t = useT();
  const path = usePathname() ?? '/';
  const unread = useUnread();
  const first = path.split('/')[1] ?? '';
  if (first === 'admin' || (first && !SITE.includes(first) && path.split('/').length === 2)) return null;
  const item = (href: string, icon: IconName, label: string, active: boolean, badge = 0) => (
    <Link href={href} aria-current={active ? 'page' : undefined} className="site-tab">
      <Icon name={icon} size={19} />{label}
      {badge ? <span className="site-badge">{badge > 99 ? '99+' : badge}</span> : null}
    </Link>
  );
  return (
    <header className="site-head">
      <div className="site-head-in">
        <Logo size={26} />
        <nav className="site-tabs">
          {item('/', 'store', t.navStores, path === '/' || (!!first && !SITE.includes(first)))}
          {item('/orders', 'receipt', t.navOrders, first === 'orders' || first === 'order')}
          {item('/notifications', 'bell', t.navNotifications, first === 'notifications', first === 'notifications' ? 0 : unread)}
          {item('/profile', 'user', t.navProfile, first === 'profile')}
        </nav>
        <LangSwitcher />
        <Link href="/partner" className="btn btn-ghost" style={{ height: 40, padding: '0 14px', fontSize: 14, whiteSpace: 'nowrap' }}>{t.sellerShort}</Link>
      </div>
    </header>
  );
}
