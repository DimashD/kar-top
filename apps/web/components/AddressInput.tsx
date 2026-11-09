'use client';

import { useEffect, useRef, useState } from 'react';
import type { Point } from './MapPicker';

type Suggestion = { label: string; sub: string; point: Point };

// Подсказки адресов — Photon (OpenStreetMap), с приоритетом мест рядом с магазином.
async function suggest(q: string, near: Point | null, signal: AbortSignal): Promise<Suggestion[]> {
  const params = new URLSearchParams({ q, limit: '6' });
  if (near) { params.set('lat', String(near.lat)); params.set('lon', String(near.lng)); }
  const r = await fetch(`https://photon.komoot.io/api/?${params}`, { signal });
  const d = await r.json();
  return (d.features ?? [])
    .filter((f: any) => !f.properties?.countrycode || f.properties.countrycode === 'KZ')
    .map((f: any) => {
      const p = f.properties ?? {};
      const street = p.street ?? (p.type === 'street' ? p.name : null);
      const label = street ? [street, p.housenumber].filter(Boolean).join(', ') : p.name ?? '';
      const sub = [street && p.name && p.name !== street ? p.name : null, p.district, p.city].filter(Boolean).join(', ');
      const [lng, lat] = f.geometry?.coordinates ?? [];
      return { label, sub, point: { lat, lng } };
    })
    .filter((s: Suggestion) => s.label && Number.isFinite(s.point.lat));
}

/**
 * Поле адреса с подсказками: начинаете вводить — ниже список улиц и домов рядом с магазином.
 * Выбор подсказки заполняет адрес и сразу ставит точку на карте (onPick).
 */
export default function AddressInput({ value, onChange, onPick, near, placeholder, style }: {
  value: string; onChange: (v: string) => void; onPick: (address: string, point: Point) => void;
  near: Point | null; placeholder: string; style: React.CSSProperties;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current || value.trim().length < 3) { setItems([]); return; }
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      suggest(value.trim(), near, ctrl.signal).then((s) => { setItems(s); setOpen(true); }).catch(() => {});
    }, 350);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [value, near]);

  return (
    <div style={{ position: 'relative' }}>
      <input value={value} placeholder={placeholder} style={style} autoComplete="street-address"
        onChange={(e) => { typed.current = true; onChange(e.target.value); }}
        onFocus={() => items.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && items.length ? (
        <div role="listbox" style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', zIndex: 5, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          {items.map((s, i) => (
            <button key={i} type="button" role="option" aria-selected={false}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { typed.current = false; setOpen(false); setItems([]); onPick(s.label, s.point); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderTop: i ? '1px solid var(--line)' : 'none', background: 'transparent', font: 'inherit', cursor: 'pointer', color: 'var(--ink)' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>📍 {s.label}</div>
              {s.sub ? <div className="muted" style={{ fontSize: 12 }}>{s.sub}</div> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
