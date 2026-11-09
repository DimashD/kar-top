import Link from 'next/link';
import { fetchTrack, OrderStatus } from '../../../lib/api';
import { grams, tenge } from '../../../lib/format';
import { Dict, LOCALES, localized } from '../../../lib/i18n';
import { getDict, getLang } from '../../../lib/i18n-server';
import { LangSwitcher } from '../../../components/LangProvider';
import ReviewForm from '../../../components/ReviewForm';
import AppBanner from '../../../components/AppBanner';
import FeedbackButton from '../../../components/FeedbackButton';
import StoreMenu from '../../../components/StoreMenu';

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
          <StoreMenu />
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
          {/* Выбранное окно получения (слоты по 2 часа). Страница рендерится на сервере — время по Алматы. */}
          {o.pickupAt ? <Row label={o.fulfillment === 'PICKUP' ? t.pickupTimeLabel : t.deliverWhen} value={slotLabel(o.pickupAt, LOCALES[lang])} /> : null}
          {o.fulfillment === 'PICKUP' ? (
            <>
              {o.store.address ? <Row label={t.storeAddress} value={o.store.address} /> : null}
            </>
          ) : null}
        </div>

        {/* Состав: что заказали, что взвесили, что убрали */}
        {o.items && o.items.length ? (
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, margin: '0 0 6px' }}>{t.itemsTitle}</h2>
            {o.finalTiyn != null && o.finalTiyn !== o.estimatedTiyn ? (
              <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px', padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--carrot-50)' }}>
                {t.sumChanged(tenge(o.estimatedTiyn), tenge(o.finalTiyn))}
              </p>
            ) : null}
            {o.items.map((it) => {
              const missing = it.status === 'missing';
              const weighted = it.qtyRequestedG != null;
              const changed = !missing && weighted && it.qtyActualG != null && it.qtyActualG !== it.qtyRequestedG;
              const diff = it.actualTiyn - it.orderedTiyn;
              const qtyLine = missing ? t.removedNotPaid
                : !weighted ? `${it.qtyRequested ?? 1}\u00a0${t.pcs}`
                : it.qtyActualG == null ? `${grams(it.qtyRequestedG ?? 0, t)} · ${t.notWeighedYet}`
                : changed ? t.orderedToWeighed(grams(it.qtyRequestedG ?? 0, t), grams(it.qtyActualG, t))
                : grams(it.qtyActualG, t);
              return (
                <div key={it.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderTop: '1px solid var(--line)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, textDecoration: missing ? 'line-through' : 'none', color: missing ? 'var(--ink-40)' : 'var(--ink)' }}>{localized(it.names, lang)}</div>
                    <div style={{ fontSize: 13, color: missing ? 'var(--sale)' : 'var(--ink-60)' }}>{qtyLine}</div>
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 800, color: missing ? 'var(--ink-40)' : 'var(--ink)' }}>{missing ? '—' : tenge(it.actualTiyn)}</div>
                    {changed && diff !== 0 ? (
                      <div style={{ fontSize: 12, fontWeight: 700, color: diff > 0 ? 'var(--carrot-600)' : 'var(--leaf)' }}>{diff > 0 ? '+' : '−'}{tenge(Math.abs(diff))}</div>
                    ) : null}
                    {missing ? <div style={{ fontSize: 12, color: 'var(--ink-40)', textDecoration: 'line-through' }}>{tenge(it.orderedTiyn)}</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Сумма */}
        <div className="card" style={{ padding: 20 }}>
          <Row label={t.itemsCount} value={String(o.itemCount)} />
          {o.missingCount > 0 ? <Row label={t.missing} value={String(o.missingCount)} /> : null}
          {/* Товары отдельно от доставки, затем итог с доставкой. */}
          <Row label={t.goodsSum} value={`${o.finalTiyn != null ? '' : '≈ '}${tenge((o.finalTiyn ?? o.estimatedTiyn) - (o.deliveryFeeTiyn ?? 0))}`} />
          {o.fulfillment !== 'PICKUP' ? <Row label={t.deliveryLine} value={o.deliveryFeeTiyn ? tenge(o.deliveryFeeTiyn) : t.deliveryFree} /> : null}
          <Row label={o.finalTiyn != null ? t.totalByWeight : `${t.totalSum} (${t.estimate.toLowerCase()})`} value={tenge(o.finalTiyn ?? o.estimatedTiyn)} strong />
          <Row label={t.payment} value={payLabel(o.payMethod, t)} />
          {o.store.kaspiPhone ? (
            <p style={{ fontSize: 15, fontWeight: 700, margin: '12px 0 0', padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--carrot-50)' }}>
              {t.kaspiPayTo(tenge(o.finalTiyn ?? o.estimatedTiyn), o.store.kaspiPhone)}
            </p>
          ) : null}
          {!delivered ? <p className="muted" style={{ fontSize: 13, margin: '12px 0 0' }}>{t.exactSumNote}</p> : null}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20 }}>
          <Link className="btn btn-ghost" href={`/${o.store.slug}`}>{t.backToStore}</Link>
        </p>
        <FeedbackButton storeSlug={o.store.slug} />
      </div>
    </main>
  );
}

function slotLabel(iso: string, locale: string): string {
  const tz = { timeZone: 'Asia/Almaty' } as const;
  const from = new Date(iso);
  const to = new Date(from.getTime() + 120 * 60000);
  return `${from.toLocaleString(locale, { ...tz, day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}–${to.toLocaleTimeString(locale, { ...tz, hour: '2-digit', minute: '2-digit' })}`;
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
