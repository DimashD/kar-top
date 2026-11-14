'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLang, useT } from './LangProvider';
import Icon from './Icon';
import type { DeliveryZone } from '../lib/api';
import { tenge } from '../lib/format';

// Карта — Leaflet с CDN и тайлы OpenStreetMap: без новых зависимостей в сборке.
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const ALMATY = { lat: 43.238, lng: 76.889 };

let leafletLoading: Promise<any> | null = null;
export function loadLeaflet(): Promise<any> {
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

/** Точка внутри кольца [lat, lng] (лучом). */
function inRing(p: Point, ring: [number, number][]) {
  let ok = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if ((yi > p.lat) !== (yj > p.lat) && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) ok = !ok;
  }
  return ok;
}

/** Зона под точкой (самая дешёвая из подходящих) или null. */
export function zoneAt(zones: DeliveryZone[], p: Point) {
  return zones.filter((z) => inRing(p, z.ring)).sort((a, b) => a.feeTiyn - b.feeTiyn)[0] ?? null;
}

/** Зоны доставки на карте: закрашенные области цвета Kartop (не мешают двигать карту). */
export function drawZones(L: any, m: any, zones: DeliveryZone[] | undefined) {
  if (!zones?.length) return null;
  const layer = L.featureGroup(zones.map((z) => L.polygon(z.ring, { color: '#D9531E', weight: 2, fillColor: '#D9531E', fillOpacity: 0.12, interactive: false }))).addTo(m);
  return layer;
}

/**
 * Выбор точки доставки: карта на весь экран, булавка в центре — покупатель двигает карту под неё.
 * «Моё местоположение» переносит карту к нему; «Доставить сюда» возвращает точку и (если найдём) адрес.
 */
export default function MapPicker({ initial, fallback, zones, onPick, onClose }: {
  initial: Point | null; fallback: Point | null; zones?: DeliveryZone[]; onPick: (p: Point, address: string | null) => void; onClose: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const zoneLayer = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Попадает ли точка под булавкой в зону доставки — пересчитываем, пока карту двигают.
  const [here, setHere] = useState<{ in: boolean; fee: number; free: number | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !box.current) return;
      const start = initial ?? fallback ?? ALMATY;
      const m = L.map(box.current, { zoomControl: false, attributionControl: true }).setView([start.lat, start.lng], initial ? 17 : 15);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
      zoneLayer.current = drawZones(L, m, zones);
      // Точки ещё нет — сначала показываем всю зону доставки целиком.
      if (!initial && zoneLayer.current) m.fitBounds(zoneLayer.current.getBounds(), { padding: [24, 24] });
      if (zones?.length) {
        const check = () => { const c = m.getCenter(); const z = zoneAt(zones, { lat: c.lat, lng: c.lng }); setHere(z ? { in: true, fee: z.feeTiyn, free: z.freeFromTiyn } : { in: false, fee: 0, free: null }); };
        m.on('move', check);
        check();
      }
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
      (p) => {
        const me = [p.coords.latitude, p.coords.longitude];
        const m = map.current;
        setBusy(false);
        if (!m) return;
        // С зоной — видно и себя, и зону: сразу понятно, внутри или снаружи. Булавка — на покупателе.
        if (zoneLayer.current) { m.fitBounds(zoneLayer.current.getBounds().extend(me), { padding: [24, 24], maxZoom: 17 }); m.panTo(me); }
        else m.setView(me, 17);
      },
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800 }}>{t.mapHint}</div>
          {zones?.length ? <div className="muted" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(217,83,30,.18)', border: '2px solid #D9531E', flex: 'none' }} />{t.zoneLegend}
          </div> : null}
        </div>
        <button className="btn btn-ghost" onClick={onClose} style={{ padding: '8px 12px' }}>{t.close}</button>
      </div>
      <div style={{ position: 'relative', flex: 1 }}>
        <div ref={box} style={{ position: 'absolute', inset: 0 }} />
        {/* Булавка — в центре карты; кончик указывает на точку. */}
        <svg width="40" height="52" viewBox="0 0 40 52" aria-hidden="true"
          style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -100%)', zIndex: 500, pointerEvents: 'none', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}>
          <path d="M20 51C20 51 38 31 38 19A18 18 0 1 0 2 19C2 31 20 51 20 51Z" fill={here && !here.in ? '#8A817C' : here?.in ? '#2E7D32' : '#D9531E'} />
          <circle cx="20" cy="19" r="7" fill="#fff" />
        </svg>
        {!ready && !err ? <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="muted">…</div> : null}
      </div>
      <div style={{ padding: '12px 16px calc(18px + env(safe-area-inset-bottom))', background: 'var(--card)', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {err ? <div style={{ color: 'var(--sale)', fontSize: 13 }}>{err}</div> : null}
        {here ? (
          <div style={{ padding: '10px 12px', borderRadius: 10, fontWeight: 700, fontSize: 14,
            background: here.in ? 'var(--leaf-50)' : '#FBEAEA', color: here.in ? 'var(--leaf)' : 'var(--sale)' }}>
            {here.in ? `✓ ${t.zoneInside} · ${here.fee ? t.deliveryCost(tenge(here.fee)) : t.freeDelivery}${here.free != null && here.fee ? ` · ${t.freeFrom(tenge(here.free))}` : ''}` : `✕ ${t.zoneOutside}`}
          </div>
        ) : null}
        <button className="btn btn-ghost btn-block" onClick={locate} disabled={busy || !ready} style={{ height: 46, justifyContent: 'center' }}><Icon name="pin" size={18} />{t.myLocation}</button>
        <button className="btn btn-primary btn-block" onClick={pick} disabled={busy || !ready} style={{ height: 52, fontSize: 16 }}>{busy ? t.locating : t.deliverHere}</button>
      </div>
    </div>,
    document.body,
  );
}
