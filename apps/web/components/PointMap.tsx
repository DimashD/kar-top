'use client';

import { useEffect, useRef } from 'react';
import type { DeliveryZone } from '../lib/api';
import { drawZones, loadLeaflet, type Point } from './MapPicker';

/**
 * Мини-карта под полем адреса: булавка там, куда привезут заказ (по введённому адресу или выбранной точке),
 * и зона доставки магазина. Нажатие — открыть большую карту и уточнить точку.
 */
export default function PointMap({ point, zones, onOpen, label }: {
  point: Point; zones?: DeliveryZone[]; onOpen: () => void; label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const pin = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !box.current) return;
      const m = L.map(box.current, {
        zoomControl: false, attributionControl: false, dragging: false, touchZoom: false,
        scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, tap: false,
      }).setView([point.lat, point.lng], 16);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(m);
      drawZones(L, m, zones);
      pin.current = L.marker([point.lat, point.lng], {
        interactive: false,
        icon: L.divIcon({
          className: '', iconSize: [30, 40], iconAnchor: [15, 40],
          html: '<svg width="30" height="40" viewBox="0 0 40 52"><path d="M20 51C20 51 38 31 38 19A18 18 0 1 0 2 19C2 31 20 51 20 51Z" fill="#D9531E"/><circle cx="20" cy="19" r="7" fill="#fff"/></svg>',
        }),
      }).addTo(m);
      map.current = m;
    }).catch(() => {});
    return () => { cancelled = true; map.current?.remove(); map.current = null; };
    // Карта создаётся один раз; точку двигаем во втором эффекте.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map.current || !pin.current) return;
    pin.current.setLatLng([point.lat, point.lng]);
    map.current.setView([point.lat, point.lng], 16, { animate: false });
  }, [point.lat, point.lng]);

  return (
    <button type="button" onClick={onOpen} aria-label={label}
      style={{ display: 'block', width: '100%', marginTop: 8, padding: 0, border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', position: 'relative', background: 'var(--line)' }}>
      <div ref={box} style={{ height: 150, pointerEvents: 'none', position: 'relative', zIndex: 0 }} />
      <span style={{ position: 'absolute', right: 8, bottom: 8, zIndex: 1, background: 'var(--card)', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700, color: 'var(--ink)', boxShadow: 'var(--shadow)' }}>{label}</span>
    </button>
  );
}
