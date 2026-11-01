import Link from 'next/link';
import { fetchTrack, OrderStatus } from '../../../lib/api';
import { tenge } from '../../../lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Заказ — Kartop', robots: { index: false } };

// Этапы для покупателя (CANCELLED показываем отдельно).
const STEPS: { key: OrderStatus[]; label: string; icon: string }[] = [
  { key: ['PLACED'], label: 'Оформлен', icon: '📝' },
  { key: ['ACCEPTED'], label: 'Магазин принял', icon: '✅' },
  { key: ['PICKING', 'AWAITING_CUSTOMER'], label: 'Собираем', icon: '🧺' },
  { key: ['READY', 'COURIER_ASSIGNED'], label: 'Готов', icon: '📦' },
  { key: ['DELIVERING'], label: 'В пути', icon: '🚗' },
  { key: ['DELIVERED', 'COMPLETED'], label: 'Доставлен', icon: '🎉' },
];
const ORDER: OrderStatus[] = ['PLACED', 'ACCEPTED', 'PICKING', 'AWAITING_CUSTOMER', 'READY', 'COURIER_ASSIGNED', 'DELIVERING', 'DELIVERED', 'COMPLETED'];

function stepState(stepKeys: OrderStatus[], current: OrderStatus): 'done' | 'active' | 'todo' {
  const curIdx = ORDER.indexOf(current);
  const stepIdx = Math.max(...stepKeys.map((k) => ORDER.indexOf(k)));
  if (stepKeys.includes(current)) return 'active';
  return curIdx > stepIdx ? 'done' : 'todo';
}

export default async function OrderTrackPage({ params }: { params: { id: string } }) {
  const o = await fetchTrack(params.id);

  if (!o) {
    return (
      <main className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 26, marginBottom: 8 }}>Заказ не найден</h1>
        <p className="muted">Проверьте ссылку из подтверждения заказа.</p>
        <p style={{ marginTop: 20 }}><Link className="btn btn-ghost" href="/">На главную</Link></p>
      </main>
    );
  }

  const cancelled = o.status === 'CANCELLED';
  const delivered = o.status === 'DELIVERED' || o.status === 'COMPLETED';

  return (
    <main style={{ paddingBottom: 32 }}>
      <header style={{ background: 'var(--card)', borderBottom: '1px solid var(--line)' }}>
        <div className="container" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link href="/" style={{ fontWeight: 900, fontSize: 20, color: 'var(--carrot)' }}>Kartop</Link>
          <div style={{ height: 24, width: 1, background: 'var(--line)' }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>Заказ №{o.number}</div>
            <div className="muted" style={{ fontSize: 13 }}>{o.store.name}</div>
          </div>
        </div>
      </header>

      <div className="container" style={{ maxWidth: 640, paddingTop: 24 }}>
        {/* Код получения */}
        {o.deliveryCode && !cancelled ? (
          <div className="card" style={{ padding: 20, marginBottom: 20, textAlign: 'center', borderColor: 'var(--carrot)', background: 'var(--carrot-50)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--carrot-600)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Код получения</div>
            <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: '0.2em', color: 'var(--ink)', margin: '6px 0' }}>{o.deliveryCode}</div>
            <div className="muted" style={{ fontSize: 14 }}>Назовите этот код курьеру при получении заказа — так подтверждается, что заказ у вас на руках.</div>
          </div>
        ) : null}

        {cancelled ? (
          <div className="card" style={{ padding: 20, marginBottom: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}>✖️</div>
            <h2 style={{ fontSize: 20, margin: '8px 0' }}>Заказ отменён</h2>
          </div>
        ) : (
          <div className="card" style={{ padding: '8px 20px', marginBottom: 20 }}>
            {STEPS.map((s, i) => {
              const st = stepState(s.key, o.status);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: i < STEPS.length - 1 ? '1px solid var(--line)' : 'none', opacity: st === 'todo' ? 0.45 : 1 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, background: st === 'done' ? 'var(--leaf-50)' : st === 'active' ? 'var(--carrot-50)' : '#F1EAE4' }}>
                    {st === 'done' ? '✓' : s.icon}
                  </div>
                  <div style={{ fontWeight: st === 'active' ? 800 : 600 }}>{s.label}</div>
                  {st === 'active' ? <span className="badge badge-leaf" style={{ marginLeft: 'auto' }}>сейчас</span> : null}
                </div>
              );
            })}
          </div>
        )}

        {/* Сумма */}
        <div className="card" style={{ padding: 20 }}>
          <Row label="Позиций" value={String(o.itemCount)} />
          {o.missingCount > 0 ? <Row label="Нет в наличии" value={String(o.missingCount)} /> : null}
          <Row label={o.finalTiyn != null ? 'Итог (по весу)' : 'Оценочно, без веса'} value={tenge(o.finalTiyn ?? o.estimatedTiyn)} strong />
          <Row label="Оплата при получении" value={payLabel(o.payMethod)} />
          {!delivered ? <p className="muted" style={{ fontSize: 13, margin: '12px 0 0' }}>Точная сумма фиксируется после взвешивания при сборке.</p> : null}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20 }}>
          <Link className="btn btn-ghost" href={`/${o.store.slug}`}>Вернуться в магазин</Link>
        </p>
      </div>
    </main>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0' }}>
      <span className="muted">{label}</span>
      <span style={{ fontWeight: strong ? 800 : 600, fontSize: strong ? 18 : 15 }}>{value}</span>
    </div>
  );
}
function payLabel(p: string): string {
  return p === 'CASH' ? 'Наличными' : p === 'CARD_COURIER' ? 'Картой курьеру' : 'Перевод Kaspi';
}
