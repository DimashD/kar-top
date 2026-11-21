import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role, StoreDocKind, StoreStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreAccess } from '../../common/auth/store-access.service';
import { LegalService, Origin } from '../legal/legal.service';
import { checkBin } from './bin-check';

export const MAX_DOC_BYTES = 2 * 1024 * 1024;
/** Сколько фото каждого вида можно загрузить (договор — несколько страниц). */
const DOC_LIMITS: Record<StoreDocKind, number> = { SIGN_PHOTO: 3, INSIDE_PHOTO: 5, CONTRACT: 10, ID_CARD: 2 };
/** Сколько незавершённых заявок может держать один человек (защита от спама). */
const MAX_OPEN_APPLICATIONS = 3;

export type ApplicationInput = {
  name: string;
  bin: string;
  legalName: string;
  address: string;
  lat?: number;
  lng?: number;
};

/** slug из названия (транслит кириллицы) + случайный суффикс. */
function slugify(name: string): string {
  const map: Record<string, string> = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',' ':'-' };
  const base = [...name.toLowerCase()].map((c) => map[c] ?? (/[a-z0-9-]/.test(c) ? c : '')).join('')
    .replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'store';
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Самостоятельная регистрация магазина: заявка → фото магазина → договор на бумаге (фото + удостоверение)
 * → отправка на проверку → платформа одобряет или отклоняет с причиной.
 * Пока заявка не одобрена, магазин в статусе PENDING: покупатели его не видят, но владелец уже может добавлять товары.
 */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StoreAccess,
    private readonly legal: LegalService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private validate(input: ApplicationInput) {
    const name = input.name?.trim();
    if (!name || name.length < 2) throw new BadRequestException('Укажите название магазина');
    const legalName = input.legalName?.trim();
    if (!legalName || legalName.length < 3) throw new BadRequestException('Укажите ИП или ТОО полностью');
    const address = input.address?.trim();
    if (!address || address.length < 5) throw new BadRequestException('Укажите адрес магазина');
    const bin = (input.bin ?? '').replace(/\s/g, '');
    const check = checkBin(bin);
    if (!check.valid) throw new BadRequestException(check.reason);
    const geom = input.lat != null && input.lng != null ? { lat: input.lat, lng: input.lng } : undefined;
    return { name, legalName, address, bin, check, geom };
  }

  /** Подать заявку: создаётся магазин PENDING, заявитель — владелец. */
  async create(userId: string, input: ApplicationInput) {
    const v = this.validate(input);
    const open = await this.prisma.store.count({
      where: { selfRegistered: true, status: StoreStatus.PENDING, members: { some: { userId, role: Role.OWNER } } },
    });
    if (open >= MAX_OPEN_APPLICATIONS) throw new ConflictException('У вас уже есть незавершённые заявки — закончите их');
    const store = await this.prisma.store.create({
      data: {
        name: v.name, slug: slugify(v.name), status: StoreStatus.PENDING, selfRegistered: true,
        address: v.address, geom: v.geom, legalName: v.legalName, legalBin: v.bin,
        binCheck: v.check,
        members: { create: { userId, role: Role.OWNER } },
      },
      select: { id: true, slug: true, name: true, status: true },
    });
    return { ...store, myRole: Role.OWNER, selfRegistered: true };
  }

  private async ownApplication(storeId: string, userId: string) {
    await this.access.assertMember(storeId, userId, [Role.OWNER]);
    const s = await this.prisma.store.findUnique({ where: { id: storeId }, select: { selfRegistered: true, status: true } });
    if (!s) throw new NotFoundException('Магазин не найден');
    if (!s.selfRegistered) throw new ForbiddenException('Этот магазин подключён без заявки');
    return s;
  }

  private assertEditable(s: { status: StoreStatus }) {
    if (s.status !== StoreStatus.PENDING) throw new ConflictException('Заявка уже рассмотрена');
  }

  /** Изменить данные заявки (пока она на проверке или отклонена). */
  async update(storeId: string, userId: string, input: ApplicationInput) {
    const s = await this.ownApplication(storeId, userId);
    this.assertEditable(s);
    const v = this.validate(input);
    await this.prisma.store.update({
      where: { id: storeId },
      data: { name: v.name, address: v.address, geom: v.geom, legalName: v.legalName, legalBin: v.bin, binCheck: v.check },
    });
    return this.status(storeId, userId);
  }

  /** Состояние заявки для экрана «Заявка на проверке». */
  async status(storeId: string, userId: string) {
    await this.ownApplication(storeId, userId);
    return this.details(storeId);
  }

  /** Полные данные заявки (для владельца и для админки). */
  async details(storeId: string) {
    const s = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true, name: true, slug: true, status: true, address: true, geom: true, legalName: true, legalBin: true, binCheck: true,
        selfRegistered: true, applicationSubmittedAt: true, applicationRejectReason: true, createdAt: true,
        members: { where: { role: Role.OWNER }, select: { user: { select: { phone: true, name: true } } } },
        documents: { select: { id: true, kind: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
        _count: { select: { products: true } },
      },
    });
    if (!s) throw new NotFoundException('Магазин не найден');
    const has = (k: StoreDocKind) => s.documents.some((d) => d.kind === k);
    const checks = {
      data: !!(s.name && s.address && s.legalName && s.legalBin),
      bin: !!(s.binCheck as any)?.valid,
      photos: has('SIGN_PHOTO') && has('INSIDE_PHOTO'),
      contract: has('CONTRACT') && has('ID_CARD'),
    };
    const { members, _count, binCheck, ...rest } = s;
    return {
      ...rest,
      binKind: (binCheck as any)?.kind ?? null,
      owner: members[0]?.user ?? null,
      productCount: _count.products,
      checks,
      ready: Object.values(checks).every(Boolean),
      state: applicationState(s.status, s.applicationSubmittedAt, s.applicationRejectReason),
    };
  }

  /** Загрузить фото (JPEG/PNG/WebP в base64, до 2 МБ). */
  async addDocument(storeId: string, userId: string, kind: StoreDocKind, data: string, type: string) {
    const s = await this.ownApplication(storeId, userId);
    this.assertEditable(s);
    const buf = Buffer.from(data, 'base64');
    if (!buf.length) throw new BadRequestException('Пустой файл');
    if (buf.length > MAX_DOC_BYTES) throw new BadRequestException('Фото больше 2 МБ');
    const count = await this.prisma.storeDocument.count({ where: { storeId, kind } });
    if (count >= DOC_LIMITS[kind]) throw new BadRequestException('Слишком много фото этого вида — удалите лишние');
    const doc = await this.prisma.storeDocument.create({ data: { storeId, kind, data: buf, type }, select: { id: true, kind: true, createdAt: true } });
    return doc;
  }

  async removeDocument(storeId: string, userId: string, docId: string) {
    const s = await this.ownApplication(storeId, userId);
    this.assertEditable(s);
    const { count } = await this.prisma.storeDocument.deleteMany({ where: { id: docId, storeId } });
    if (!count) throw new NotFoundException('Фото не найдено');
    return { ok: true };
  }

  /** Фото документа: владелец своего магазина или админ (проверка роли — в контроллере). */
  async document(storeId: string, docId: string) {
    const d = await this.prisma.storeDocument.findFirst({ where: { id: docId, storeId }, select: { data: true, type: true } });
    if (!d) throw new NotFoundException('Фото не найдено');
    return d;
  }

  async ownDocument(storeId: string, userId: string, docId: string) {
    await this.ownApplication(storeId, userId);
    return this.document(storeId, docId);
  }

  /** Отправить на проверку: нужны данные, верный ИИН/БИН, фото магазина, фото договора и удостоверения. */
  async submit(storeId: string, userId: string) {
    const s = await this.ownApplication(storeId, userId);
    this.assertEditable(s);
    const d = await this.details(storeId);
    if (!d.ready) throw new BadRequestException('Заполните все шаги заявки');
    await this.prisma.store.update({ where: { id: storeId }, data: { applicationSubmittedAt: new Date(), applicationRejectReason: null } });
    return this.details(storeId);
  }

  /** Ссылка на договор для печати с уже вписанными данными (действует 2 дня). */
  async contractLink(storeId: string, userId: string) {
    await this.ownApplication(storeId, userId);
    const token = await this.jwt.signAsync({ sid: storeId, purpose: 'contract' }, { secret: this.secret(), expiresIn: '2d' });
    const web = (process.env.WEB_BASE_URL || 'https://kar-top.kz').replace(/\/$/, '');
    return { url: `${web}/merchant-offer/print?t=${encodeURIComponent(token)}` };
  }

  /** Данные для печатной формы договора (публично, по токену из contractLink). */
  async contractData(token: string) {
    let sid: string;
    try {
      const p = await this.jwt.verifyAsync<{ sid: string; purpose: string }>(token, { secret: this.secret() });
      if (p.purpose !== 'contract') throw new Error('purpose');
      sid = p.sid;
    } catch {
      throw new ForbiddenException('Ссылка устарела — откройте договор из приложения ещё раз');
    }
    const s = await this.prisma.store.findUnique({
      where: { id: sid },
      select: { name: true, address: true, legalName: true, legalBin: true, members: { where: { role: Role.OWNER }, select: { user: { select: { phone: true } } } } },
    });
    if (!s) throw new NotFoundException('Магазин не найден');
    return { storeName: s.name, address: s.address, legalName: s.legalName, bin: s.legalBin, phone: s.members[0]?.user.phone ?? null, date: new Date().toISOString() };
  }

  private secret() {
    return this.config.get<string>('JWT_ACCESS_SECRET');
  }

  // --- Админка ---

  /** Очередь заявок: сначала готовые к проверке, потом ждущие магазин. */
  async adminList() {
    const rows = await this.prisma.store.findMany({
      where: { selfRegistered: true, status: StoreStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true },
    });
    const items = await Promise.all(rows.map((r) => this.details(r.id)));
    const rank = (x: { state: string }) => (x.state === 'SUBMITTED' ? 0 : x.state === 'DRAFT' ? 1 : 2);
    return items
      .map(({ documents, ...x }) => ({ ...x, documentCount: documents.length }))
      .sort((a, b) => rank(a) - rank(b));
  }

  /** Одобрить: договор отмечается как подписанный на бумаге, магазин становится активным (виден по ссылке). */
  async approve(storeId: string, adminId: string, origin: Origin) {
    const d = await this.details(storeId);
    if (!d.selfRegistered) throw new BadRequestException('Это не заявка');
    if (d.status !== StoreStatus.PENDING) throw new ConflictException('Заявка уже рассмотрена');
    if (!d.ready) throw new BadRequestException('Заявка заполнена не полностью');
    await this.legal.markOffer(storeId, adminId, 'PAPER', d.legalName ?? undefined, d.legalBin ?? undefined, 'Фото подписанного договора и удостоверения проверены в заявке', origin);
    await this.prisma.$transaction([
      this.prisma.store.update({ where: { id: storeId }, data: { status: StoreStatus.ACTIVE, applicationRejectReason: null } }),
      this.prisma.outboxEvent.create({ data: { type: 'store.application_approved', aggregateType: 'store', aggregateId: storeId, payload: { name: d.name } } }),
    ]);
    return this.details(storeId);
  }

  /** Отклонить с причиной: магазин исправляет и отправляет заново. */
  async reject(storeId: string, reason: string) {
    const d = await this.details(storeId);
    if (!d.selfRegistered) throw new BadRequestException('Это не заявка');
    if (d.status !== StoreStatus.PENDING) throw new ConflictException('Заявка уже рассмотрена');
    const r = reason?.trim();
    if (!r || r.length < 3) throw new BadRequestException('Напишите причину');
    await this.prisma.$transaction([
      this.prisma.store.update({ where: { id: storeId }, data: { applicationSubmittedAt: null, applicationRejectReason: r } }),
      this.prisma.outboxEvent.create({ data: { type: 'store.application_rejected', aggregateType: 'store', aggregateId: storeId, payload: { reason: r } } }),
    ]);
    return this.details(storeId);
  }
}

/** DRAFT — заполняется; SUBMITTED — ждёт проверки; REJECTED — отклонена, нужно исправить; APPROVED — магазин работает. */
export function applicationState(status: StoreStatus, submittedAt: Date | null, rejectReason: string | null) {
  if (status !== StoreStatus.PENDING) return 'APPROVED';
  if (submittedAt) return 'SUBMITTED';
  if (rejectReason) return 'REJECTED';
  return 'DRAFT';
}
