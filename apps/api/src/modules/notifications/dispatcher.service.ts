import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TEMPLATES, Audience } from './templates';
import { PushRegistry, Platform } from './push-provider';

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
    const userIds = await this.recipients(tpl.audience, ev.aggregateType, ev.aggregateId);
    const msg = { title: tpl.title, body: tpl.body(ev.payload ?? {}), data: { type: ev.type, id: ev.aggregateId } };

    let sent = 0;
    for (const userId of userIds) {
      const tokens = await this.prisma.pushToken.findMany({ where: { userId }, select: { platform: true, token: true } });
      if (tokens.length === 0 && tpl.critical) {
        this.log.log(`[fallback-sms] нет push у ${userId} — критичное «${tpl.title}» ушло бы по SMS`);
      }
      for (const t of tokens) {
        const provider = this.push.get(t.platform as Platform);
        if (provider && (await provider.send(t.token, msg))) sent++;
      }
    }
    return sent;
  }

  private async recipients(audience: Audience, aggregateType: string, aggregateId: string): Promise<string[]> {
    const ids = new Set<string>();
    if (aggregateType === 'order') {
      const order = await this.prisma.order.findUnique({
        where: { id: aggregateId },
        select: { customerId: true, store: { select: { members: { select: { userId: true } } } } },
      });
      if (!order) return [];
      if (audience === 'customer' || audience === 'both') {
        if (order.customerId) ids.add(order.customerId);
      }
      if (audience === 'merchant' || audience === 'both') {
        order.store.members.forEach((m) => ids.add(m.userId));
      }
    } else if (aggregateType === 'subscription') {
      const sub = await this.prisma.subscription.findUnique({
        where: { id: aggregateId },
        select: { store: { select: { members: { select: { userId: true } } } } },
      });
      sub?.store.members.forEach((m) => ids.add(m.userId));
    }
    return [...ids];
  }
}
