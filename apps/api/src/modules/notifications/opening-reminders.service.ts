import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { hoursOf, minutesUntilOpen } from '../../common/hours';

/** За сколько минут до открытия напоминаем магазину проверить цены и наличие. */
export const REMIND_BEFORE_MIN = [60, 30];

/**
 * Напоминания магазинам перед открытием: за час и за 30 минут — «проверьте цены и что есть в наличии».
 * Вызывается планировщиком раз в минуту; кладёт событие в outbox, пуш отправляет диспетчер.
 */
@Injectable()
export class OpeningReminders {
  constructor(private readonly prisma: PrismaService) {}

  async run(now = new Date()): Promise<number> {
    const stores = await this.prisma.store.findMany({ where: { status: 'ACTIVE' }, select: { id: true, hours: true } });
    const due = stores
      .map((s) => ({ id: s.id, minutes: minutesUntilOpen(hoursOf(s.hours), now) }))
      .filter((s): s is { id: string; minutes: number } => s.minutes != null && REMIND_BEFORE_MIN.includes(s.minutes));
    if (!due.length) return 0;
    // Повторный запуск в ту же минуту (перезапуск сервера) не должен прислать второй пуш.
    const recent = await this.prisma.outboxEvent.findMany({
      where: { type: 'store.update_reminder', aggregateId: { in: due.map((s) => s.id) }, createdAt: { gte: new Date(now.getTime() - 20 * 60_000) } },
      select: { aggregateId: true, payload: true },
    });
    const fresh = due.filter((s) => !recent.some((r) => r.aggregateId === s.id && (r.payload as any)?.minutes === s.minutes));
    for (const s of fresh) {
      await this.prisma.outboxEvent.create({
        data: { type: 'store.update_reminder', aggregateType: 'store', aggregateId: s.id, payload: { minutes: s.minutes } },
      });
    }
    return fresh.length;
  }
}
