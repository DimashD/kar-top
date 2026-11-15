import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * «Показывать всем покупателям» — платная опция с бесплатным периодом для новых магазинов.
 * Магазин виден всем, пока listed И идёт бесплатный (listedFreeUntil) или оплаченный (listedPaidUntil) период.
 * Период закончился — магазин сам возвращается в «только по ссылке» (проверяется при каждом запросе списка).
 */
export type ListingDates = { listed: boolean; listedFreeUntil: Date | null; listedPaidUntil: Date | null };

/** Дней бесплатного показа по умолчанию (LISTING_TRIAL_DAYS). */
export const trialDays = () => {
  const n = Number(process.env.LISTING_TRIAL_DAYS);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 3650) : 60;
};

/** До какого момента магазин показан всем (null — не показан). */
export function listedUntil(s: ListingDates): Date | null {
  if (!s.listed) return null;
  const t = Math.max(s.listedFreeUntil?.getTime() ?? 0, s.listedPaidUntil?.getTime() ?? 0);
  return t ? new Date(t) : null;
}

export function visibleNow(s: ListingDates, now = new Date()): boolean {
  const u = listedUntil(s);
  return !!u && u > now;
}

/** Условие Prisma «показан всем сейчас». */
export const visibleWhere = (now = new Date()) => ({
  listed: true,
  OR: [{ listedFreeUntil: { gt: now } }, { listedPaidUntil: { gt: now } }],
});

const DAY = 24 * 3600 * 1000;
const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };

/** Состояние показа для приложения магазина и админки. */
export function listingState(s: ListingDates & { listingRequestedAt: Date | null; listingPriceTiyn: number | null }, now = new Date()) {
  const until = listedUntil(s);
  const visible = !!until && until > now;
  const free = visible && !!s.listedFreeUntil && s.listedFreeUntil > now && (!s.listedPaidUntil || s.listedPaidUntil <= now || s.listedPaidUntil < s.listedFreeUntil);
  return {
    listed: visible,
    listingRequested: !!s.listingRequestedAt,
    listedUntil: visible ? until!.toISOString() : null,
    listingFree: free,
    // Был показ и закончился (не оплатили) — магазин снова только по ссылке.
    listingExpired: s.listed && !visible,
    listingPriceTiyn: s.listingPriceTiyn,
  };
}

/** Действия платформы с показом магазина: одобрить с бесплатным периодом, отметить оплату, цена, снять. */
@Injectable()
export class ListingService {
  private readonly log = new Logger(ListingService.name);
  constructor(private readonly prisma: PrismaService) {}

  private async get(id: string) {
    const s = await this.prisma.store.findUnique({
      where: { id },
      select: { id: true, listed: true, listedFreeUntil: true, listedPaidUntil: true, listingRequestedAt: true, listingPriceTiyn: true },
    });
    if (!s) throw new NotFoundException('Магазин не найден');
    return s;
  }

  /** Показывать всем с бесплатным периодом (дней; по умолчанию LISTING_TRIAL_DAYS = 60). Уже идущий период не сокращается. */
  async approve(id: string, freeDays = trialDays(), now = new Date()) {
    const s = await this.get(id);
    const free = new Date(now.getTime() + Math.max(1, Math.min(freeDays, 3650)) * DAY);
    const listedFreeUntil = s.listedFreeUntil && s.listedFreeUntil > free ? s.listedFreeUntil : free;
    await this.prisma.store.update({ where: { id }, data: { listed: true, listingRequestedAt: null, listedFreeUntil, listingReminder: null } });
    return this.state(id, now);
  }

  /** Оплата получена: +N месяцев показа (от конца текущего периода, если он ещё идёт). */
  async markPaid(id: string, months = 1, now = new Date()) {
    const s = await this.get(id);
    const from = new Date(Math.max(now.getTime(), s.listedFreeUntil?.getTime() ?? 0, s.listedPaidUntil?.getTime() ?? 0));
    await this.prisma.store.update({
      where: { id },
      data: { listed: true, listingRequestedAt: null, listedPaidUntil: addMonths(from, Math.max(1, Math.min(months, 24))), listingReminder: null },
    });
    return this.state(id, now);
  }

  async setPrice(id: string, priceTiyn: number | null) {
    await this.get(id);
    await this.prisma.store.update({ where: { id }, data: { listingPriceTiyn: priceTiyn } });
    return this.state(id);
  }

  /** Снять с показа всем (и отклонить заявку). Даты сохраняются — оплаченное можно вернуть повторным одобрением. */
  async remove(id: string) {
    await this.get(id);
    await this.prisma.store.update({ where: { id }, data: { listed: false, listingRequestedAt: null } });
    return this.state(id);
  }

  async state(id: string, now = new Date()) {
    return { id, ...listingState(await this.get(id), now) };
  }

  /**
   * Напоминания магазину: за 7 дней и за 1 день до конца показа и в день окончания.
   * listingReminder хранит «вид:конец периода», чтобы одно напоминание не приходило дважды.
   * Вызывается планировщиком раз в час.
   */
  async remind(now = new Date()) {
    const stores = await this.prisma.store.findMany({
      where: { listed: true, OR: [{ listedFreeUntil: { gt: new Date(now.getTime() - DAY) } }, { listedPaidUntil: { gt: new Date(now.getTime() - DAY) } }] },
      select: { id: true, listed: true, listedFreeUntil: true, listedPaidUntil: true, listingRequestedAt: true, listingPriceTiyn: true, listingReminder: true },
    });
    let sent = 0;
    for (const s of stores) {
      const until = listedUntil(s);
      if (!until) continue;
      const left = until.getTime() - now.getTime();
      const kind = left <= 0 ? 'ended' : left <= DAY ? '1d' : left <= 7 * DAY ? '7d' : null;
      if (!kind) continue;
      const mark = `${kind}:${until.toISOString()}`;
      if (s.listingReminder === mark) continue;
      const st = listingState(s, now);
      await this.prisma.outboxEvent.create({
        data: {
          type: kind === 'ended' ? 'store.listing_ended' : 'store.listing_ending',
          aggregateType: 'store', aggregateId: s.id,
          payload: { until: until.toISOString(), daysLeft: Math.max(0, Math.ceil(left / DAY)), free: st.listingFree, priceTiyn: s.listingPriceTiyn },
        },
      });
      await this.prisma.store.update({ where: { id: s.id }, data: { listingReminder: mark } });
      sent++;
    }
    if (sent) this.log.log(`напоминаний о показе всем: ${sent}`);
    return sent;
  }
}
