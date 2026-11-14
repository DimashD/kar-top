'use client';

import { useEffect, useRef } from 'react';
import type { DeliveryZone } from '../lib/api';
import { drawZones, loadLeaflet, Point } from './MapPicker';

/** Небольшая карта для «О магазине»: магазин и закрашенные зоны его доставки. Только просмотр. */
export default function ZoneMap({ zones, store }: { zones: DeliveryZone[]; store: Point | null }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let m: any = null;
    loadLeaflet().then((L) => {
      if (!box.current) return;
      m = L.map(box.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false, dragging: !L.Browser.mobile, tap: false });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
      const layer = drawZones(L, m, zones);
      if (store) L.circleMarker([store.lat, store.lng], { radius: 7, color: '#fff', weight: 3, fillColor: '#D9531E', fillOpacity: 1 }).addTo(m);
      if (layer) m.fitBounds(layer.getBounds(), { padding: [16, 16] });
      else if (store) m.setView([store.lat, store.lng], 14);
    }).catch(() => {});
    return () => { m?.remove(); };
  }, [zones, store]);
  return <div ref={box} style={{ height: 240, borderRadius: 12, overflow: 'hidden', background: 'var(--line)', position: 'relative', zIndex: 0 }} />;
}
