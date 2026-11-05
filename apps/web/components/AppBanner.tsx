'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ANDROID_URL, APP_SCHEME, detectPlatform, Platform } from '../lib/app-links';
import { useT } from './LangProvider';

// Иконка Google Play — простой inline-SVG (без официальных ассетов).
function Play() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3.6 2.2c-.3.2-.5.6-.5 1.1v17.4c0 .5.2.9.5 1.1l.1.1L13 12.5v-.2L3.7 2.1l-.1.1zM16.3 15.8l-3.1-3.1v-.2l3.1-3.1.07.04 3.68 2.09c1.05.6 1.05 1.57 0 2.17l-3.68 2.09-.07.02zM15.6 15.1L12.4 12 15.6 8.9l2.9 1.65c.9.5.9 1.3 0 1.8L15.6 15.1zM3.7 21.9c.35.37.92.42 1.56.06l11-6.25-3.2-3.2L3.7 21.9z"/></svg>;
}

function AndroidButton() {
  const t = useT();
  return (
    <a href={ANDROID_URL} className="btn" style={{
      background: 'var(--ink)', color: '#fff', gap: 10, padding: '10px 16px', borderRadius: 12,
      textDecoration: 'none', minWidth: 170, justifyContent: 'center',
    }}>
      <Play />
      <span style={{ textAlign: 'left', lineHeight: 1.1 }}>
        <span style={{ display: 'block', fontSize: 10, fontWeight: 500, opacity: 0.8 }}>{t.availableOn}</span>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>Google Play</span>
      </span>
    </a>
  );
}

function StoreActions({ platform, orderId }: { platform: Platform; orderId?: string }) {
  const t = useT();
  function openApp() {
    if (!orderId) return;
    const started = Date.now();
    // Пытаемся открыть приложение; если не установлено — уводим в Google Play.
    window.location.href = `${APP_SCHEME}://order/${orderId}`;
    setTimeout(() => {
      if (Date.now() - started < 1600) window.location.href = ANDROID_URL;
    }, 1200);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
      {orderId && platform === 'android' ? (
        <button className="btn btn-primary btn-block" onClick={openApp} style={{ height: 48 }}>{t.openInApp}</button>
      ) : null}
      <AndroidButton />
    </div>
  );
}

/**
 * Баннер «следите за заказом». Основной способ — браузер (эта же страница);
 * приложение — только Android (Google Play), опционально.
 */
export default function AppBanner({ orderId, variant = 'banner' }: { orderId?: string; variant?: 'banner' | 'full' }) {
  const t = useT();
  const [platform, setPlatform] = useState<Platform>('other');
  useEffect(() => { setPlatform(detectPlatform(navigator.userAgent)); }, []);

  if (variant === 'full') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56 }}>🧺</div>
        <h1 style={{ fontSize: 32, margin: '12px 0 8px' }}>{t.appTitle}</h1>
        <p className="muted" style={{ fontSize: 18, maxWidth: 440, margin: '0 auto 24px' }}>{t.appText}</p>
        <div style={{ maxWidth: 360, margin: '0 auto 16px' }}><StoreActions platform={platform} orderId={orderId} /></div>
        <Link href="/" className="btn btn-ghost">{t.continueInBrowser}</Link>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 20, background: 'var(--carrot-50)', borderColor: 'var(--carrot)' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ fontSize: 30 }}>🧺</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{t.trackTitle}</div>
          <div className="muted" style={{ fontSize: 14 }}>{t.trackText}</div>
        </div>
      </div>
      <StoreActions platform={platform} orderId={orderId} />
    </div>
  );
}
