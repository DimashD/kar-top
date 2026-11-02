import { Injectable, BadRequestException } from '@nestjs/common';
import { PartnerLeadStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Приведение казахстанского телефона к формату +77XXXXXXXXX. */
function normalizePhone(raw: string): string {
  const d = (raw || '').replace(/\D/g, '');
  const n = d.startsWith('8') && d.length === 11 ? '7' + d.slice(1) : d;
  if (!/^77\d{9}$/.test(n)) throw new BadRequestException('Телефон — формат +7 7xx xxx xx xx');
  return '+' + n;
}

export interface ApplyPartnerInput {
  name: string;
  phone: string;
  company?: string;
  twogisUrl?: string;
  source?: string;
}

/** Заявки «Стать партнёром». Свободной регистрации мерчантов нет —
 *  заявка лишь уведомляет платформу, магазин заводится вручную (invite-only). */
@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

  async apply(input: ApplyPartnerInput) {
    const name = (input.name || '').trim();
    if (name.length < 2) throw new BadRequestException('Укажите имя');
    const phone = normalizePhone(input.phone);
    const source = input.source === 'merchant_app' ? 'merchant_app' : 'web';

    const lead = await this.prisma.partnerLead.create({
      data: {
        name,
        phone,
        company: input.company?.trim() || null,
        twogisUrl: input.twogisUrl?.trim() || null,
        source,
      },
      select: { id: true, createdAt: true },
    });
    // Лид платформа разбирает в админке; отдельное уведомление подключим при live-операторе.
    return { ok: true, id: lead.id };
  }

  /** Список заявок для платформы (админка). */
  async list(status?: string, limit = 50) {
    const where: Prisma.PartnerLeadWhereInput = {};
    if (status && (Object.values(PartnerLeadStatus) as string[]).includes(status)) {
      where.status = status as PartnerLeadStatus;
    }
    return this.prisma.partnerLead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  /** Сменить статус заявки (связались / завели / отказ). */
  async setStatus(id: string, status: PartnerLeadStatus, note?: string) {
    return this.prisma.partnerLead.update({
      where: { id },
      data: { status, ...(note !== undefined ? { note: note.trim() || null } : {}) },
      select: { id: true, status: true, note: true },
    });
  }
}
