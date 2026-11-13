import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { LegalDoc, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreAccess } from '../../common/auth/store-access.service';
import { OtpService } from '../identity/otp.service';
import { LEGAL_VERSIONS } from './legal-versions';

/** Откуда пришёл запрос — сохраняется в журнале как доказательство согласия. */
export type Origin = { ip?: string | null; userAgent?: string | null };

@Injectable()
export class LegalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StoreAccess,
    private readonly otp: OtpService,
  ) {}

  /** Что пользователь уже принял в действующей редакции. */
  async myStatus(userId: string) {
    const rows = await this.prisma.legalAcceptance.findMany({
      where: { userId, storeId: null, doc: { in: [LegalDoc.TERMS, LegalDoc.PD_CONSENT] } },
      select: { doc: true, version: true },
    });
    const has = (d: 'TERMS' | 'PD_CONSENT') => rows.some((r) => r.doc === d && r.version === LEGAL_VERSIONS[d]);
    return { versions: { TERMS: LEGAL_VERSIONS.TERMS, PD_CONSENT: LEGAL_VERSIONS.PD_CONSENT }, terms: has('TERMS'), pdConsent: has('PD_CONSENT') };
  }

  /** Покупатель или сотрудник принял соглашение и/или согласие на ПДн (нажатием после входа по коду). */
  async acceptMine(userId: string, docs: ('TERMS' | 'PD_CONSENT')[], origin: Origin) {
    const status = await this.myStatus(userId);
    const todo = [...new Set(docs)].filter((d) => (d === 'TERMS' ? !status.terms : !status.pdConsent));
    if (todo.length) {
      await this.prisma.legalAcceptance.createMany({
        data: todo.map((d) => ({ userId, doc: d, version: LEGAL_VERSIONS[d], method: 'CLICK' as const, ip: origin.ip ?? null, userAgent: clip(origin.userAgent) })),
      });
    }
    return this.myStatus(userId);
  }

  /** Статус оферты магазина: принята ли действующая редакция, кем и как. */
  async offerStatus(storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { legalName: true, legalBin: true } });
    if (!store) throw new NotFoundException('Магазин не найден');
    const last = await this.prisma.legalAcceptance.findFirst({
      where: { storeId, doc: LegalDoc.MERCHANT_OFFER },
      orderBy: { acceptedAt: 'desc' },
      select: { version: true, method: true, acceptedAt: true, meta: true, user: { select: { phone: true, name: true } } },
    });
    return {
      version: LEGAL_VERSIONS.MERCHANT_OFFER,
      accepted: !!last && last.version === LEGAL_VERSIONS.MERCHANT_OFFER,
      legalName: store.legalName,
      legalBin: store.legalBin,
      last: last && { version: last.version, method: last.method, acceptedAt: last.acceptedAt, by: last.user, note: (last.meta as any)?.note ?? null },
    };
  }

  async offerStatusForMember(storeId: string, userId: string) {
    await this.access.assertMember(storeId, userId);
    return this.offerStatus(storeId);
  }

  /** Код подтверждения уходит на телефон владельца (тем же каналом, что и вход). */
  async requestOfferCode(storeId: string, userId: string) {
    await this.access.assertMember(storeId, userId, [Role.OWNER]);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    const channel = await this.otp.request(user!.phone);
    return { sent: true, channel };
  }

  /** Владелец принимает оферту: реквизиты ИП/ТОО + код из SMS. */
  async acceptOffer(storeId: string, userId: string, legalName: string, bin: string, code: string, origin: Origin) {
    await this.access.assertMember(storeId, userId, [Role.OWNER]);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    if (!(await this.otp.verify(user!.phone, code))) throw new UnauthorizedException('Неверный или просроченный код.');
    return this.recordOffer(storeId, userId, 'SMS', legalName, bin, { phone: user!.phone }, origin);
  }

  /** Админ отмечает, что оферта подписана ЭЦП или на бумаге. */
  async markOffer(storeId: string, adminId: string, method: 'ECP' | 'PAPER', legalName: string | undefined, bin: string | undefined, note: string | undefined, origin: Origin) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { legalName: true, legalBin: true } });
    if (!store) throw new NotFoundException('Магазин не найден');
    const name = legalName?.trim() || store.legalName;
    const b = bin || store.legalBin;
    if (!name || !b) throw new BadRequestException('Укажите ИП/ТОО и ИИН/БИН магазина');
    return this.recordOffer(storeId, adminId, method, name, b, { note: note?.trim() || null, markedByAdmin: true }, origin);
  }

  private async recordOffer(storeId: string, userId: string, method: 'SMS' | 'ECP' | 'PAPER', legalName: string, bin: string, meta: Record<string, unknown>, origin: Origin) {
    const name = legalName.trim();
    await this.prisma.$transaction([
      this.prisma.store.update({ where: { id: storeId }, data: { legalName: name, legalBin: bin } }),
      this.prisma.legalAcceptance.create({
        data: {
          storeId, userId, doc: LegalDoc.MERCHANT_OFFER, version: LEGAL_VERSIONS.MERCHANT_OFFER, method,
          ip: origin.ip ?? null, userAgent: clip(origin.userAgent), meta: { ...meta, legalName: name, bin } as any,
        },
      }),
    ]);
    return this.offerStatus(storeId);
  }
}

const clip = (s?: string | null) => (s ? s.slice(0, 300) : null);
