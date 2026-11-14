import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TEMPLATES, Audience } from './templates';
import { PushRegistry, Platform } from './push-provider';

type Recipient = { userId: string; role: 'customer' | 'merchant' };

/** Событие старше этого не отправляем (мс). */
const STALE_MS = 60 * 60_000;

@Injectable()
export class NotificationDispatcher {
  private readonly log = new Logger(NotificationDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushRegistry,
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
    const title = tpl.title(ev.payload ?? {});
    // Нажатие на пуш: покупатель — страница заказа (в приложении покупателя), магазин — карточка заказа.
    const web = (process.env.WEB_BASE_URL || 'https://kar-top.kz').replace(/\/$/, '');
    const url = ev.aggregateType === 'order' ? `${web}/order/${ev.aggregateId}` : '';

    let sent = 0;
    for (const r of recipients) {
      // Сначала — в центр уведомлений (виден в приложении даже без пуша), счётчик непрочитанных — на иконку.
      const app = r.role === 'customer' ? 'customer' : 'merchant';
      await this.prisma.notification.create({
        data: { userId: r.userId, app, type: ev.type, refId: ev.aggregateId, title, body, url: r.role === 'customer' && url ? url : null },
      });
      const badge = await this.prisma.notification.count({ where: { userId: r.userId, app, readAt: null } });
      const msg = { title, body, badge, data: { type: ev.type, id: ev.aggregateId, ...(r.role === 'customer' && url ? { url } : {}) } };
      // Только в нужное приложение: уведомления покупателя — в приложение покупателя, магазина — в приложение магазина.
      const tokens = await this.prisma.pushToken.findMany({ where: { userId: r.userId, app }, select: { platform: true, token: true } });
      let delivered = 0;
      for (const t of tokens) {
        const provider = this.push.get(t.platform as Platform);
        if (provider && (await provider.send(t.token, msg))) delivered++;
      }
      // Уведомления о заказах — ТОЛЬКО пуш и центр уведомлений. SMS не шлём никогда (платно и уязвимо для атак).
      sent += delivered;
    }
    return sent;
  }

  private async recipients(audience: Audience, aggregateType: string, aggregateId: string): Promise<Recipient[]> {
    const out = new Map<string, Recipient>();
    // Один номер может быть и покупателем, и сотрудником магазина — это два разных получателя (разные приложения).
    const ids = { add: (userId: string, role: Recipient['role']) => { out.set(`${userId}:${role}`, { userId, role }); } };
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
    } else if (aggregateType === 'store') {
      const store = await this.prisma.store.findUnique({ where: { id: aggregateId }, select: { members: { select: { userId: true } } } });
      store?.members.forEach((m) => ids.add(m.userId, 'merchant'));
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
