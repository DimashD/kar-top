'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatKzPhone } from '../lib/phone';
import { LangSwitcher, useT } from './LangProvider';
import { AuthSheet, logout, readSession } from './StoreView';
import StoreMenu from './StoreMenu';
import AccountNav from './AccountNav';
import BottomNav from './BottomNav';
import FeedbackButton from './FeedbackButton';
import Icon from './Icon';

/** Профиль покупателя: под каким номером вошёл, выход, заказы, уведомления, язык, поддержка, удаление аккаунта. */
export default function Profile() {
  const t = useT();
  const [phone, setPhone] = useState<string | null | undefined>(undefined);
  const [auth, setAuth] = useState(false);
  useEffect(() => setPhone(readSession()?.phone ?? null), []);

  async function signOut() {
    if (!confirm(t.logoutConfirm)) return;
    await logout();
    setPhone(null);
  }

  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', color: 'var(--ink)', textDecoration: 'none', borderTop: '1px solid var(--line)', fontWeight: 600, background: 'transparent', border: 'none', width: '100%', font: 'inherit', textAlign: 'left', cursor: 'pointer' };
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <div className="acct">
      <AccountNav />
      <div className="acct-main">
      <header className="page-head" style={{ background: 'var(--card)', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, zIndex: 5 }}>
        <div className="container" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, maxWidth: 760 }}>
          <span className="m-only"><StoreMenu /></span>
          <h1 style={{ fontSize: 20, margin: 0, flex: 1 }}>{t.navProfile}</h1>
        </div>
      </header>
      <div className="container" style={{ padding: '16px 20px', maxWidth: 760, display: 'grid', gap: 14 }}>
        <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 999, background: 'var(--carrot-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--carrot)' }}><Icon name="user" size={26} /></div>
          {phone === undefined ? <span className="muted">…</span> : phone ? (
            <div style={{ flex: 1 }}>
              <div className="muted" style={{ fontSize: 13 }}>{t.signedInAs}</div>
              <div style={{ fontWeight: 800, fontSize: 19 }}>{formatKzPhone(phone)}</div>
            </div>
          ) : (
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, marginBottom: 10 }}>{t.notSignedIn}</div>
              <button className="btn btn-primary" onClick={() => setAuth(true)} style={{ height: 44, padding: '0 22px' }}>{t.loginBtn}</button>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <Link href="/orders" style={{ ...row, borderTop: 'none' }}><Icon name="receipt" size={20} style={{ color: 'var(--ink-60)' }} /> <span style={{ flex: 1 }}>{t.myOrders}</span><Icon name="chevron" size={18} style={{ color: 'var(--ink-40)' }} /></Link>
          <Link href="/notifications" style={row}><Icon name="bell" size={20} style={{ color: 'var(--ink-60)' }} /> <span style={{ flex: 1 }}>{t.navNotifications}</span><Icon name="chevron" size={18} style={{ color: 'var(--ink-40)' }} /></Link>
          <div style={{ ...row, cursor: 'default' }}><Icon name="globe" size={20} style={{ color: 'var(--ink-60)' }} /> <span style={{ flex: 1 }}><LangSwitcher /></span></div>
          <button type="button" style={row} onClick={() => window.dispatchEvent(new Event('kartop-feedback'))}><Icon name="chat" size={20} style={{ color: 'var(--ink-60)' }} /> <span style={{ flex: 1 }}>{t.support}</span><Icon name="chevron" size={18} style={{ color: 'var(--ink-40)' }} /></button>
        </div>

        {phone ? (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <button type="button" style={{ ...row, borderTop: 'none', color: 'var(--sale)' }} onClick={signOut}><Icon name="logout" size={20} /> <span style={{ flex: 1 }}>{t.logout}</span></button>
            <Link href="/delete-account" style={{ ...row, color: 'var(--ink-40)', fontWeight: 500, fontSize: 14 }}>{t.deleteAccount}</Link>
          </div>
        ) : null}
      </div>
      {auth ? (
        <AuthSheet initialPhone="+7" hint={t.loginToSeeOrders} confirmLabel={t.loginBtn}
          onClose={() => setAuth(false)} onDone={(s) => { setAuth(false); setPhone(s.phone); }} />
      ) : null}
      {/* Та же форма «Написать в Kartop»: строка «Написать в поддержку» открывает её событием. */}
      <FeedbackButton hideLink />
      </div>
      </div>
      <BottomNav />
    </main>
  );
}
