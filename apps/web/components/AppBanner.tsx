'use client';

import { useEffect, useState } from 'react';
import { IOS_URL, ANDROID_URL, APP_SCHEME, detectPlatform, Platform } from '../lib/app-links';

// Иконки магазинов — простые inline-SVG (без официальных ассетов).
function Apple() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16.37 12.78c.02 2.53 2.22 3.37 2.25 3.38-.02.06-.35 1.2-1.16 2.38-.7 1.02-1.43 2.03-2.58 2.05-1.13.02-1.49-.67-2.78-.67s-1.69.65-2.76.69c-1.11.04-1.95-1.1-2.66-2.12-1.45-2.1-2.56-5.93-1.07-8.52.74-1.28 2.06-2.1 3.49-2.12 1.09-.02 2.12.73 2.78.73.67 0 1.92-.9 3.24-.77.55.02 2.1.22 3.1 1.68-.08.05-1.85 1.08-1.83 3.22zM14.4 5.33c.59-.72 1-1.71.89-2.71-.86.03-1.9.57-2.51 1.28-.55.63-1.03 1.64-.9 2.6.96.08 1.93-.49 2.52-1.17z"/></svg>;
}
function Play() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3.6 2.2c-.3.2-.5.6-.5 1.1v17.4c0 .5.2.9.5 1.1l.1.1L13 12.5v-.2L3.7 2.1l-.1.1zM16.3 15.8l-3.1-3.1v-.2l3.1-3.1.07.04 3.68 2.09c1.05.6 1.05 1.57 0 2.17l-3.68 2.09-.07.02zM15.6 15.1L12.4 12 15.6 8.9l2.9 1.65c.9.5.9 1.3 0 1.8L15.6 15.1zM3.7 21.9c.35.37.92.42 1.56.06l11-6.25-3.2-3.2L3.7 21.9z"/></svg>;
}

function StoreButtons({ platform, orderId }: { platform: Platform; orderId?: string }) {
  const btn = (href: string, icon: React.ReactNode, top: string, big: string) => (
    <a href={href} className="btn" style={{
      background: 'var(--ink)', color: '#fff', gap: 10, padding: '10px 16px', borderRadius: 12,
      textDecoration: 'none', flex: 1, minWidth: 150, justifyContent: 'center',
    }}>
      {icon}
      <span style={{ textAlign: 'left', lineHeight: 1.1 }}>
        <span style={{ display: 'block', fontSize: 10, fontWeight: 500, opacity: 0.8 }}>{top}</span>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{big}</span>
      </span>
    </a>
  );
  const ios = btn(IOS_URL, <Apple />, 'Загрузите в', 'App Store');
  const android = btn(ANDROID_URL, <Play />, 'Доступно в', 'Google Play');

  function openApp() {
    if (!orderId) return;
    const started = Date.now();
    // Пытаемся открыть приложение; если не установлено — уводим в стор.
    window.location.href = `${APP_SCHEME}://order/${orderId}`;
    setTimeout(() => {
      if (Date.now() - started < 1600) window.location.href = platform === 'ios' ? IOS_URL : ANDROID_URL;
    }, 1200);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {orderId && platform !== 'other' ? (
        <button className="btn btn-primary btn-block" onClick={openApp} style={{ height: 48 }}>Открыть в приложении</button>
      ) : null}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {platform === 'ios' ? ios : platform === 'android' ? android : (<>{ios}{android}</>)}
      </div>
    </div>
  );
}

/**
 * Баннер «скачай приложение, чтобы следить за заказом».
 * variant='banner' — компактно на странице трекинга; 'full' — геро на /app.
 */
export default function AppBanner({ orderId, variant = 'banner' }: { orderId?: string; variant?: 'banner' | 'full' }) {
  const [platform, setPlatform] = useState<Platform>('other');
  useEffect(() => { setPlatform(detectPlatform(navigator.userAgent)); }, []);

  if (variant === 'full') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56 }}>📱</div>
        <h1 style={{ fontSize: 32, margin: '12px 0 8px' }}>Приложение Kartop</h1>
        <p className="muted" style={{ fontSize: 18, maxWidth: 420, margin: '0 auto 24px' }}>
          Живой статус заказа, пуш-уведомления на каждом шаге и код получения — всегда под рукой.
        </p>
        <div style={{ maxWidth: 360, margin: '0 auto' }}><StoreButtons platform={platform} orderId={orderId} /></div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 20, background: 'var(--carrot-50)', borderColor: 'var(--carrot)' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ fontSize: 30 }}>📱</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Следите за заказом в приложении</div>
          <div className="muted" style={{ fontSize: 14 }}>Живой статус, пуш-уведомления и код получения — под рукой.</div>
        </div>
      </div>
      <StoreButtons platform={platform} orderId={orderId} />
    </div>
  );
}
