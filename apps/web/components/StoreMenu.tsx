'use client';

import Logo from './Logo';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ANDROID_URL, inKartopApp } from '../lib/app-links';
import { LangSwitcher, useT } from './LangProvider';
import Icon from './Icon';

/** Меню сервиса Kartop (☰) — общее для всех страниц: главная, связь с Kartop, приложение, для магазинов, документы. */
export default function StoreMenu() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [inApp, setInApp] = useState(false);
  useEffect(() => setInApp(inKartopApp()), []);
  // «Ещё» в нижнем меню открывает это же меню.
  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener('kartop-menu', h);
    return () => window.removeEventListener('kartop-menu', h);
  }, []);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  const item: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 20px', fontSize: 16, fontWeight: 700, color: 'var(--ink)', textDecoration: 'none', textAlign: 'left', border: 'none', background: 'transparent', font: 'inherit', cursor: 'pointer' };
  const small: React.CSSProperties = { ...item, fontSize: 14, fontWeight: 500, padding: '10px 20px', color: 'var(--ink-60)' };
  return (
    <>
      <button type="button" aria-label={t.menu} onClick={() => setOpen(true)}
        style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--card)', cursor: 'pointer', flex: 'none', color: 'var(--ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="menu" size={22} /></button>
      {open ? (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,21,18,0.45)', zIndex: 40 }}>
          <nav aria-label={t.menu} onClick={(e) => e.stopPropagation()}
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 'min(300px, 85vw)', background: 'var(--card)', padding: '16px 0', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px 12px' }}>
              <span style={{ flex: 1 }}><Logo size={24} /></span>
              <button type="button" aria-label={t.close} onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-60)', display: 'inline-flex', padding: 4 }}><Icon name="close" size={22} /></button>
            </div>
            <Link href="/" style={item}><Icon name="store" size={20} style={{ color: 'var(--carrot)' }} />{t.navStores}</Link>
            <Link href="/orders" style={item}><Icon name="receipt" size={20} style={{ color: 'var(--carrot)' }} />{t.myOrders}</Link>
            <button type="button" style={item} onClick={() => { setOpen(false); window.dispatchEvent(new Event('kartop-feedback')); }}><Icon name="chat" size={20} style={{ color: 'var(--carrot)' }} />{t.feedbackTitle}</button>
            {!inApp ? <a href={ANDROID_URL} target="_blank" rel="noreferrer" style={item}><Icon name="download" size={20} style={{ color: 'var(--carrot)' }} />{t.downloadApp}</a> : null}
            <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="globe" size={20} style={{ color: 'var(--carrot)' }} />
              <LangSwitcher />
            </div>
            <div style={{ borderTop: '1px solid var(--line)', margin: '8px 0' }} />
            <Link href="/partner" style={small}>{t.connectShop}</Link>
            <Link href="/terms" style={small}>{t.termsOfUse}</Link>
            <Link href="/privacy" style={small}>{t.privacyPolicy}</Link>
          </nav>
        </div>
      ) : null}
    </>
  );
}
