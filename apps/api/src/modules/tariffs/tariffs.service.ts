import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { StoreStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Минимальный срок предупреждения о новом тарифе (оферта, п. 7.4). */
export const TARIFF_NOTICE_DAYS = 30;
const DAY = 24 * 3600 * 1000;

export type TariffInput = { title: string; body: string; monthlyFeeTiyn?: number | null; commissionBp?: number | null; effectiveFrom: string };

const pub = { id: true, title: true, body: true, monthlyFeeTiyn: true, commissionBp: true, effectiveFrom: true, createdAt: true } as const;

/**
 * Тарифы для магазинов живут отдельно от оферты: оферта ссылается на страницу kar-top.kz/tariffs.
 * Действующий тариф — последний с effectiveFrom ≤ сейчас; будущие показываются заранее с датой вступления.
 */
@Injectable()
export class TariffsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Публично: действующий, будущие (с датой) и архив. */
  async overview(now = new Date()) {
    const all = await this.prisma.tariff.findMany({ orderBy: { effectiveFrom: 'desc' }, select: pub });
    const past = all.filter((t) => t.effectiveFrom <= now);
    const upcoming = all.filter((t) => t.effectiveFrom > now).reverse();
    return { current: past[0] ?? null, upcoming, archive: past.slice(1) };
  }

  /**
   * Опубликовать новый тариф. Вступает в силу не раньше чем через 30 дней (кроме самого первого тарифа).
   * Всем магазинам уходит уведомление в приложение.
   */
  async publish(adminId: string, input: TariffInput, now = new Date()) {
    const title = input.title?.trim();
    const body = input.body?.trim();
    if (!title || !body) throw new BadRequestException('Заполните название и условия тарифа');
    const from = new Date(input.effectiveFrom);
    if (Number.isNaN(from.getTime())) throw new BadRequestException('Неверная дата начала');
    const fee = input.monthlyFeeTiyn ?? null;
    const bp = input.commissionBp ?? null;
    if (fee == null && bp == null) throw new BadRequestException('Укажите абонплату, процент с заказа или и то и другое');
    const first = (await this.prisma.tariff.count()) === 0;
    if (!first && from.getTime() < now.getTime() + TARIFF_NOTICE_DAYS * DAY - DAY) {
      throw new BadRequestException(`Новый тариф может начать действовать не раньше чем через ${TARIFF_NOTICE_DAYS} дней`);
    }
    const tariff = await this.prisma.tariff.create({
      data: { title, body, monthlyFeeTiyn: fee, commissionBp: bp, effectiveFrom: from, createdById: adminId },
      select: pub,
    });
    if (!first) {
      const stores = await this.prisma.store.findMany({ where: { status: { in: [StoreStatus.ACTIVE, StoreStatus.PENDING] } }, select: { id: true } });
      if (stores.length) {
        await this.prisma.outboxEvent.createMany({
          data: stores.map((s) => ({ type: 'tariff.published', aggregateType: 'store', aggregateId: s.id, payload: { title, effectiveFrom: from.toISOString() } })),
        });
      }
    }
    return tariff;
  }

  /** Отменить ещё не вступивший тариф (например, ошиблись в цифрах). */
  async cancel(id: string, now = new Date()) {
    const t = await this.prisma.tariff.findUnique({ where: { id }, select: { effectiveFrom: true } });
    if (!t) throw new NotFoundException('Тариф не найден');
    if (t.effectiveFrom <= now) throw new ConflictException('Тариф уже действует — опубликуйте новый');
    await this.prisma.tariff.delete({ where: { id } });
    return { ok: true };
  }
}
