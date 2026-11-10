'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from './LangProvider';

/** Высота нижнего меню — страницы оставляют под него место. */
export const BOTTOM_NAV_H = 64;

/** Нижнее меню покупателя (сайт и приложение): Магазины · Заказы · Ещё (открывает меню ☰). */
export default function BottomNav() {
  const t = useT();
  const path = usePathname() ?? '/';
  const tab = (href: string, icon: string, label: string, active: boolean) => (
    <Link href={href} style={{ ...item, color: active ? 'var(--carrot)' : 'var(--ink-60)' }}>
      <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: active ? 800 : 600 }}>{label}</span>
    </Link>
  );
  return (
    <>
      <div style={{ height: BOTTOM_NAV_H }} />
      <nav style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20, background: 'var(--card)', borderTop: '1px solid var(--line)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div style={{ display: 'flex', maxWidth: 560, margin: '0 auto', height: BOTTOM_NAV_H }}>
          {tab('/', '🏪', t.navStores, path === '/' || (!path.startsWith('/orders') && !path.startsWith('/order/')))}
          {tab('/orders', '🧾', t.navOrders, path.startsWith('/orders') || path.startsWith('/order/'))}
          <button type="button" onClick={() => window.dispatchEvent(new Event('kartop-menu'))} style={{ ...item, color: 'var(--ink-60)', border: 'none', background: 'transparent', font: 'inherit', cursor: 'pointer' }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>☰</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{t.navMore}</span>
          </button>
        </div>
      </nav>
    </>
  );
}

const item: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, textDecoration: 'none' };
