'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { CLIENT_API } from '../lib/api';

type QrLib = (type: number, ecl: 'L' | 'M' | 'Q' | 'H') => { addData(s: string): void; make(): void; getModuleCount(): number; isDark(r: number, c: number): boolean };
type Info = { name: string; address: string | null; delivery: boolean; pickup: boolean };

const CARROT = '#D9531E';
const INK = '#1A1512';

/** QR из квадратиков одним path — чёткий при любой печати. Уровень H: в центре помещается значок Kartop. */
function Qr({ text, ready }: { text: string; ready: boolean }) {
  const lib = typeof window !== 'undefined' ? ((window as any).qrcode as QrLib | undefined) : undefined;
  if (!ready || !lib || !text) return <div style={{ width: '100%', aspectRatio: '1', background: '#F4F2F0', borderRadius: '3mm' }} />;
  const qr = lib(0, 'H');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  const badge = Math.round(n * 0.22);
  const at = (n - badge) / 2;
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} style={{ width: '100%', display: 'block' }} shapeRendering="crispEdges">
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#fff" />
      <path d={d} fill={INK} />
      <rect x={at - 0.6} y={at - 0.6} width={badge + 1.2} height={badge + 1.2} rx={1.6} fill="#fff" />
      <rect x={at} y={at} width={badge} height={badge} rx={1.3} fill={CARROT} />
      <text x={n / 2} y={n / 2 + badge * 0.28} textAnchor="middle" fontSize={badge * 0.78} fontWeight={900} fill="#fff" fontFamily="Golos Text, system-ui, sans-serif">K</text>
    </svg>
  );
}

/** Печатный постер магазина (A4): Kartop, название магазина, призыв заказывать онлайн, QR на витрину и 3 шага. */
export default function StorePoster({ slug }: { slug: string }) {
  const [ready, setReady] = useState(false);
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');

  useEffect(() => {
    setUrl(`${window.location.origin}/${slug}`);
    if ((window as any).qrcode) setReady(true);
    fetch(`${CLIENT_API}/shops/${encodeURIComponent(slug)}/catalog`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error('Магазин не найден или ещё не активирован — постер доступен для активных магазинов.');
        const { store } = await r.json();
        setInfo({ name: store.name, address: store.address, delivery: store.deliveryEnabled !== false, pickup: !!store.pickupEnabled });
      })
      .catch((e) => setError(e.message));
  }, [slug]);

  const host = url.replace(/^https?:\/\//, '');
  const accent = info?.delivery ? 'мы соберём и привезём' : 'соберём к вашему приходу';
  const accentKk = info?.delivery ? 'біз жинап, жеткіземіз' : 'келуіңізге жинап қоямыз';
  const third = info?.delivery && info.pickup ? 'Доставка или самовывоз' : info?.delivery ? 'Привезём к двери' : 'Заберите готовый заказ';

  return (
    <main style={{ minHeight: '100dvh', background: '#E9E5E1', padding: '20px 12px 40px' }}>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js" strategy="afterInteractive" onLoad={() => setReady(true)} />
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          html, body, main { background: #fff !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .poster { box-shadow: none !important; margin: 0 !important; transform: none !important; }
        }
        .poster, .poster * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
        .poster-wrap { width: 100%; max-width: 210mm; margin: 0 auto; }
        @media screen and (max-width: 820px) { .poster { zoom: calc((100vw - 24px) / 210mm); } }
      `}</style>

      <div className="no-print" style={{ maxWidth: '210mm', margin: '0 auto 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <a href="/admin/stores" className="btn btn-ghost" style={{ padding: '10px 14px' }}>← Магазины</a>
        <div style={{ flex: 1, minWidth: 180, fontSize: 14, color: 'var(--ink-60)' }}>
          Печать на A4 → повесить у кассы или на входе. «Сохранить как PDF» — чтобы отправить владельцу.
        </div>
        <button className="btn btn-primary" disabled={!info || !ready} onClick={() => window.print()} style={{ padding: '10px 18px' }}>🖨️ Печать / PDF</button>
      </div>
      {error ? <p className="no-print" style={{ maxWidth: '210mm', margin: '0 auto 16px', color: 'var(--sale)', fontWeight: 700 }}>{error}</p> : null}

      <div className="poster-wrap">
        <div className="poster" style={{
          width: '210mm', height: '297mm', background: '#fff', color: INK, position: 'relative', overflow: 'hidden',
          boxShadow: '0 6px 30px rgba(26,21,18,0.18)', display: 'flex', flexDirection: 'column',
          fontFamily: "'Golos Text', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}>
          {/* Шапка: бренд */}
          <div style={{ background: CARROT, color: '#fff', padding: '11mm 16mm 9mm', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '17mm', fontWeight: 900, letterSpacing: '-0.5mm', lineHeight: 1 }}>Kartop</div>
            <div style={{ textAlign: 'right', fontSize: '4.2mm', fontWeight: 700, lineHeight: 1.35, opacity: 0.95 }}>магазины у дома<br />онлайн · kar-top.kz</div>
          </div>

          {/* Магазин */}
          <div style={{ padding: '9mm 16mm 0', textAlign: 'center' }}>
            <div style={{ fontSize: '4.2mm', fontWeight: 800, letterSpacing: '0.6mm', textTransform: 'uppercase', color: CARROT }}>Магазин</div>
            <div style={{ fontSize: (info?.name.length ?? 0) > 22 ? '11mm' : '14mm', fontWeight: 900, lineHeight: 1.05, marginTop: '2mm' }}>{info?.name ?? '…'}</div>
            {info?.address ? <div style={{ fontSize: '4.6mm', color: '#6B625C', marginTop: '2.5mm' }}>{info.address}</div> : null}
          </div>

          {/* Призыв */}
          <div style={{ padding: '7mm 16mm 0', textAlign: 'center' }}>
            <div style={{ fontSize: '9.5mm', fontWeight: 900, lineHeight: 1.12 }}>
              Заказывайте онлайн —<br /><span style={{ color: CARROT }}>{accent}</span>
            </div>
            <div style={{ fontSize: '4.6mm', color: '#6B625C', marginTop: '2.5mm', fontWeight: 600 }}>Онлайн тапсырыс беріңіз — {accentKk}</div>
          </div>

          {/* QR */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '7mm 0 0' }}>
            <div style={{ width: '98mm', padding: '5mm', border: `1.6mm solid ${CARROT}`, borderRadius: '8mm', background: '#fff', position: 'relative' }}>
              <Qr text={url} ready={ready} />
              <div style={{
                position: 'absolute', left: '50%', bottom: '-5.5mm', transform: 'translateX(-50%)', background: CARROT, color: '#fff',
                fontWeight: 800, fontSize: '4.4mm', padding: '2mm 6mm', borderRadius: '99mm', whiteSpace: 'nowrap',
              }}>📱 Наведите камеру телефона</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: '9mm', fontSize: '4.8mm', fontWeight: 700, color: '#6B625C' }}>{host}</div>

          {/* Три шага */}
          <div style={{ marginTop: 'auto', background: '#FBF1EA', padding: '7mm 12mm 9mm', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5mm' }}>
            {[['1', 'Отсканируйте', 'QR-код камерой'], ['2', 'Выберите продукты', 'в пару касаний'], ['3', third, 'наличными, картой или Kaspi']].map(([n, a, b]) => (
              <div key={n} style={{ textAlign: 'center' }}>
                <div style={{ width: '11mm', height: '11mm', borderRadius: '99mm', background: CARROT, color: '#fff', fontWeight: 900, fontSize: '6mm', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2.5mm' }}>{n}</div>
                <div style={{ fontWeight: 800, fontSize: '4.6mm', lineHeight: 1.2 }}>{a}</div>
                <div style={{ fontSize: '3.8mm', color: '#6B625C', marginTop: '1mm' }}>{b}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
