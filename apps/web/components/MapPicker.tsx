'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLang, useT } from './LangProvider';
import Icon from './Icon';

// Карта — Leaflet с CDN и тайлы OpenStreetMap: без новых зависимостей в сборке.
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const ALMATY = { lat: 43.238, lng: 76.889 };

let leafletLoading: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (!leafletLoading) {
    leafletLoading = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = LEAFLET_CSS;
      document.head.appendChild(css);
      const s = document.createElement('script');
      s.src = LEAFLET_JS;
      s.onload = () => resolve((window as any).L);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  return leafletLoading;
}

export type Point = { lat: number; lng: number };

/**
 * Выбор точки доставки: карта на весь экран, булавка в центре — покупатель двигает карту под неё.
 * «Моё местоположение» переносит карту к нему; «Доставить сюда» возвращает точку и (если найдём) адрес.
 */
export default function MapPicker({ initial, fallback, onPick, onClose }: {
  initial: Point | null; fallback: Point | null; onPick: (p: Point, address: string | null) => void; onClose: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !box.current) return;
      const start = initial ?? fallback ?? ALMATY;
      const m = L.map(box.current, { zoomControl: false, attributionControl: true }).setView([start.lat, start.lng], initial ? 17 : 15);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
      map.current = m;
      setReady(true);
      if (!initial) locate();
    }).catch(() => setErr(t.mapFailed));
    return () => { cancelled = true; map.current?.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function locate() {
    if (!navigator.geolocation) { setErr(t.geoDenied); return; }
    setBusy(true); setErr(null);
    navigator.geolocation.getCurrentPosition(
      (p) => { map.current?.setView([p.coords.latitude, p.coords.longitude], 17); setBusy(false); },
      () => { setErr(t.geoDenied); setBusy(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function pick() {
    if (!map.current) return;
    const c = map.current.getCenter();
    const point = { lat: Number(c.lat.toFixed(6)), lng: Number(c.lng.toFixed(6)) };
    setBusy(true);
    let address: string | null = null;
    try {
      // Адрес по точке — чтобы не вводить вручную (если не найдём — покупатель допишет сам).
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${point.lat}&lon=${point.lng}&zoom=18&accept-language=${lang === 'en' ? 'en' : 'ru'}`);
      const d = await r.json();
      const a = d.address ?? {};
      const street = a.road ?? a.pedestrian ?? a.residential ?? a.neighbourhood ?? null;
      address = street ? [street, a.house_number].filter(Boolean).join(', ') : null;
    } catch { /* без адреса — не страшно */ }
    setBusy(false);
    onPick(point, address);
  }

  // Окно карты — прямо в <body>: внутри корзины его перекрывали нижнее меню и тестовая полоса.
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'var(--bg)', display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ flex: 1, fontWeight: 800 }}>{t.mapHint}</div>
        <button className="btn btn-ghost" onClick={onClose} style={{ padding: '8px 12px' }}>{t.close}</button>
      </div>
      <div style={{ position: 'relative', flex: 1 }}>
        <div ref={box} style={{ position: 'absolute', inset: 0 }} />
        {/* Булавка — в центре карты; кончик указывает на точку. */}
        <svg width="40" height="52" viewBox="0 0 40 52" aria-hidden="true"
          style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -100%)', zIndex: 500, pointerEvents: 'none', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}>
          <path d="M20 51C20 51 38 31 38 19A18 18 0 1 0 2 19C2 31 20 51 20 51Z" fill="#D9531E" />
          <circle cx="20" cy="19" r="7" fill="#fff" />
        </svg>
        {!ready && !err ? <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="muted">…</div> : null}
      </div>
      <div style={{ padding: '12px 16px calc(18px + env(safe-area-inset-bottom))', background: 'var(--card)', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {err ? <div style={{ color: 'var(--sale)', fontSize: 13 }}>{err}</div> : null}
        <button className="btn btn-ghost btn-block" onClick={locate} disabled={busy || !ready} style={{ height: 46, justifyContent: 'center' }}><Icon name="pin" size={18} />{t.myLocation}</button>
        <button className="btn btn-primary btn-block" onClick={pick} disabled={busy || !ready} style={{ height: 52, fontSize: 16 }}>{busy ? t.locating : t.deliverHere}</button>
      </div>
    </div>,
    document.body,
  );
}
