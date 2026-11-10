import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TEMPLATES, Audience } from './templates';
import { PushRegistry, Platform } from './push-provider';
import { SmsChannel } from '../identity/channels/sms.channel';

type Recipient = { userId: string; role: 'customer' | 'merchant' };

/** Событие старше этого не отправляем (мс). */
const STALE_MS = 60 * 60_000;

@Injectable()
export class NotificationDispatcher {
  private readonly log = new Logger(NotificationDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushRegistry,
    private readonly sms: SmsChannel,
  ) {}

  /** Обрабатывает пачку необработанных outbox-событий. Вызывается планировщиком/воркером. */
  async process(batch = 50) {
    const events = await this.prisma.outboxEvent.findMany({
      where: { processedAt: null },
      orderBy: { createdAt: 'asc' },
      take: batch,
    });
    let sent = 0;
    for (const ev of events) {
      // Устаревшее событие (старше часа — например, после простоя) закрываем без отправки: пуш о давнем заказе только запутает.
      if (Date.now() - ev.createdAt.getTime() > STALE_MS) {
        await this.prisma.outboxEvent.update({ where: { id: ev.id }, data: { processedAt: new Date() } });
        continue;
      }
      try {
        sent += await this.handle(ev);
        await this.prisma.outboxEvent.update({ where: { id: ev.id }, data: { processedAt: new Date(), attempts: { increment: 1 } } });
      } catch (e) {
        await this.prisma.outboxEvent.update({ where: { id: ev.id }, data: { attempts: { increment: 1 } } });
        this.log.warn(`Событие ${ev.type} не доставлено: ${(e as Error).message}`);
      }
    }
    return { processed: events.length, pushesSent: sent };
  }

  private async handle(ev: { type: string; aggregateType: string; aggregateId: string; payload: any }): Promise<number> {
    const tpl = TEMPLATES[ev.type];
    if (!tpl) return 0;
    const recipients = await this.recipients(tpl.audience, ev.aggregateType, ev.aggregateId);
    const body = tpl.body(ev.payload ?? {});
    // Нажатие на пуш: покупатель — страница заказа (в приложении покупателя), магазин — карточка заказа.
    const web = (process.env.WEB_BASE_URL || 'https://kar-top.kz').replace(/\/$/, '');
    const url = ev.aggregateType === 'order' ? `${web}/order/${ev.aggregateId}` : '';

    let sent = 0;
    for (const r of recipients) {
      const msg = { title: tpl.title, body, data: { type: ev.type, id: ev.aggregateId, ...(r.role === 'customer' && url ? { url } : {}) } };
      const tokens = await this.prisma.pushToken.findMany({ where: { userId: r.userId }, select: { platform: true, token: true } });
      let delivered = 0;
      for (const t of tokens) {
        const provider = this.push.get(t.platform as Platform);
        if (provider && (await provider.send(t.token, msg))) delivered++;
      }
      sent += delivered;
      // Покупатель без приложения (заказал на сайте): критичное — коротким SMS, если включено.
      if (!delivered && tpl.critical && r.role === 'customer' && process.env.NOTIFY_SMS_FALLBACK === '1') {
        const user = await this.prisma.user.findUnique({ where: { id: r.userId }, select: { phone: true } });
        if (user?.phone) await this.sms.sendText(user.phone, `Kartop: ${body}`);
      }
    }
    return sent;
  }

  private async recipients(audience: Audience, aggregateType: string, aggregateId: string): Promise<Recipient[]> {
    const out = new Map<string, Recipient>();
    const ids = { add: (userId: string, role: Recipient['role']) => { if (!out.has(userId)) out.set(userId, { userId, role }); } };
    if (aggregateType === 'order') {
      const order = await this.prisma.order.findUnique({
        where: { id: aggregateId },
        select: { customerId: true, store: { select: { members: { select: { userId: true } } } } },
      });
      if (!order) return [];
      if (audience === 'customer' || audience === 'both') {
        if (order.customerId) ids.add(order.customerId, 'customer');
      }
      if (audience === 'merchant' || audience === 'both') {
        order.store.members.forEach((m) => ids.add(m.userId, 'merchant'));
      }
    } else if (aggregateType === 'subscription') {
      const sub = await this.prisma.subscription.findUnique({
        where: { id: aggregateId },
        select: { store: { select: { members: { select: { userId: true } } } } },
      });
      sub?.store.members.forEach((m) => ids.add(m.userId, 'merchant'));
    }
    return [...out.values()];
  }
}
