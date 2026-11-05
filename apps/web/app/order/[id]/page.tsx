import Link from 'next/link';
import { fetchTrack, OrderStatus } from '../../../lib/api';
import { tenge } from '../../../lib/format';
import { Dict, LOCALES } from '../../../lib/i18n';
import { getDict, getLang } from '../../../lib/i18n-server';
import { LangSwitcher } from '../../../components/LangProvider';
import ReviewForm from '../../../components/ReviewForm';
import AppBanner from '../../../components/AppBanner';

export const dynamic = 'force-dynamic';
export function generateMetadata() {
  return { title: getDict().orderMetaTitle, robots: { index: false } };
}

// Этапы для покупателя (CANCELLED показываем отдельно).
// pickup — подпись для самовывоза, если отличается.
const STEPS: { key: OrderStatus[]; label: keyof Dict; pickup?: keyof Dict; icon: string }[] = [
  { key: ['PLACED'], label: 'stepPlaced', icon: '📝' },
  { key: ['ACCEPTED'], label: 'stepAccepted', icon: '✅' },
  { key: ['PICKING', 'AWAITING_CUSTOMER'], label: 'stepPicking', icon: '🧺' },
  { key: ['READY', 'COURIER_ASSIGNED'], label: 'stepReady', icon: '📦' },
  { key: ['DELIVERING'], label: 'stepDelivering', pickup: 'stepReadyForPickup', icon: '🚗' },
  { key: ['DELIVERED', 'COMPLETED'], label: 'stepDelivered', pickup: 'stepPickedUp', icon: '🎉' },
];
const ORDER: OrderStatus[] = ['PLACED', 'ACCEPTED', 'PICKING', 'AWAITING_CUSTOMER', 'READY', 'COURIER_ASSIGNED', 'DELIVERING', 'DELIVERED', 'COMPLETED'];

function stepState(stepKeys: OrderStatus[], current: OrderStatus): 'done' | 'active' | 'todo' {
  const curIdx = ORDER.indexOf(current);
  const stepIdx = Math.max(...stepKeys.map((k) => ORDER.indexOf(k)));
  if (stepKeys.includes(current)) return 'active';
  return curIdx > stepIdx ? 'done' : 'todo';
}

export default async function OrderTrackPage({ params }: { params: { id: string } }) {
  const t = getDict();
  const lang = getLang();
  const o = await fetchTrack(params.id);

  if (!o) {
    return (
      <main className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 26, marginBottom: 8 }}>{t.orderNotFound}</h1>
        <p className="muted">{t.orderNotFoundText}</p>
        <p style={{ marginTop: 20 }}><Link className="btn btn-ghost" href="/">{t.toHome}</Link></p>
      </main>
    );
  }

  const cancelled = o.status === 'CANCELLED';
  const delivered = o.status === 'DELIVERED' || o.status === 'COMPLETED';

  return (
    <main style={{ paddingBottom: 32 }}>
      <header style={{ background: 'var(--card)', borderBottom: '1px solid var(--line)' }}>
        <div className="container" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link href={`/${o.store.slug}`} style={{ fontWeight: 900, fontSize: 20, color: 'var(--carrot)' }}>Kartop</Link>
          <div style={{ height: 24, width: 1, background: 'var(--line)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{t.orderNo(o.number)}</div>
            <div className="muted" style={{ fontSize: 13 }}>{o.store.name}</div>
          </div>
          <LangSwitcher />
        </div>
      </header>

      <div className="container" style={{ maxWidth: 640, paddingTop: 24 }}>
        {/* Код получения */}
        {o.deliveryCode && !cancelled ? (
          <div className="card" style={{ padding: 20, marginBottom: 20, textAlign: 'center', borderColor: 'var(--carrot)', background: 'var(--carrot-50)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--carrot-600)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t.pickupCode}</div>
            <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: '0.2em', color: 'var(--ink)', margin: '6px 0' }}>{o.deliveryCode}</div>
            <div className="muted" style={{ fontSize: 14 }}>{t.sayCodeTo(o.fulfillment === 'PICKUP')}</div>
          </div>
        ) : null}

        {/* Стимул скачать приложение: живой статус и пуши — в приложении. */}
        {!cancelled && !delivered ? <AppBanner orderId={o.id} /> : null}

        {cancelled ? (
          <div className="card" style={{ padding: 20, marginBottom: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}>✖️</div>
            <h2 style={{ fontSize: 20, margin: '8px 0' }}>{t.orderCancelled}</h2>
          </div>
        ) : (
          <div className="card" style={{ padding: '8px 20px', marginBottom: 20 }}>
            {STEPS.map((s, i) => {
              const st = stepState(s.key, o.status);
              const label = t[o.fulfillment === 'PICKUP' && s.pickup ? s.pickup : s.label] as string;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: i < STEPS.length - 1 ? '1px solid var(--line)' : 'none', opacity: st === 'todo' ? 0.45 : 1 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, background: st === 'done' ? 'var(--leaf-50)' : st === 'active' ? 'var(--carrot-50)' : '#F1EAE4' }}>
                    {st === 'done' ? '✓' : s.icon}
                  </div>
                  <div style={{ fontWeight: st === 'active' ? 800 : 600 }}>{label}</div>
                  {st === 'active' ? <span className="badge badge-leaf" style={{ marginLeft: 'auto' }}>{t.now}</span> : null}
                </div>
              );
            })}
          </div>
        )}

        {/* Оценка заказа */}
        {o.canReview ? <ReviewForm orderId={o.id} /> : null}
        {o.review ? (
          <div className="card" style={{ padding: 20, marginBottom: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 22, letterSpacing: 2 }}>
              {'★'.repeat(o.review.rating)}<span style={{ color: 'var(--line)' }}>{'★'.repeat(5 - o.review.rating)}</span>
            </div>
            <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>
              {o.review.comment ? `«${o.review.comment}»` : t.thanksForRating}
            </div>
          </div>
        ) : null}

        {/* Способ получения */}
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <Row label={t.fulfillment} value={o.fulfillment === 'PICKUP' ? t.pickup : t.delivery} />
          {o.fulfillment === 'PICKUP' ? (
            <>
              {o.pickupAt ? <Row label={t.pickupTimeLabel} value={new Date(o.pickupAt).toLocaleString(LOCALES[lang], { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} /> : null}
              {o.store.address ? <Row label={t.storeAddress} value={o.store.address} /> : null}
            </>
          ) : null}
        </div>

        {/* Сумма */}
        <div className="card" style={{ padding: 20 }}>
          <Row label={t.itemsCount} value={String(o.itemCount)} />
          {o.missingCount > 0 ? <Row label={t.missing} value={String(o.missingCount)} /> : null}
          <Row label={o.finalTiyn != null ? t.totalByWeight : t.estimate} value={tenge(o.finalTiyn ?? o.estimatedTiyn)} strong />
          <Row label={t.payOnReceipt} value={payLabel(o.payMethod, t)} />
          {!delivered ? <p className="muted" style={{ fontSize: 13, margin: '12px 0 0' }}>{t.exactSumNote}</p> : null}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20 }}>
          <Link className="btn btn-ghost" href={`/${o.store.slug}`}>{t.backToStore}</Link>
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
function payLabel(p: string, t: Dict): string {
  return p === 'CASH' ? t.payCash : p === 'CARD_COURIER' ? t.payCard : t.payKaspi;
}
