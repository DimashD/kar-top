import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Role, StoreStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Приведение казахстанского телефона к формату +77XXXXXXXXX. */
function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (!/^77\d{9}$/.test(d)) throw new BadRequestException('Телефон владельца — формат +7 7xx xxx xx xx');
  return '+' + d;
}

/** slug из названия (транслит кириллицы) + случайный суффикс для уникальности. */
function slugify(name: string): string {
  const map: Record<string, string> = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',' ':'-' };
  const base = [...name.toLowerCase()].map((c) => map[c] ?? (/[a-z0-9-]/.test(c) ? c : '')).join('')
    .replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'store';
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Модерация и заведение магазинов платформой (invite-only: свободной регистрации нет). */
@Injectable()
export class AdminStoresService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Завести магазин (только платформа). Создаёт Store(PENDING), владельца по телефону
   * и членство OWNER. Свободной регистрации мерчантов нет — вход в приложение по OTP,
   * но магазин появляется, только если платформа добавила этот телефон владельцем.
   */
  async provision(input: { name: string; ownerPhone: string; city?: string; address?: string; kaspiPhone?: string }) {
    const name = input.name?.trim();
    if (!name || name.length < 2) throw new BadRequestException('Название магазина обязательно');
    const phone = normalizePhone(input.ownerPhone);

    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.user.upsert({ where: { phone }, update: {}, create: { phone } });
      // slug уникальный — пара попыток на случай коллизии.
      let slug = slugify(name);
      for (let i = 0; i < 3; i++) {
        if (!(await tx.store.findUnique({ where: { slug }, select: { id: true } }))) break;
        slug = slugify(name);
      }
      const store = await tx.store.create({
        data: {
          name, slug, status: 'PENDING',
          address: input.address?.trim() || null,
          phone: input.city ? `${input.city}` : null, // город/заметка пока в phone-заметке; позже отдельное поле
          kaspiPhone: input.kaspiPhone ? normalizePhone(input.kaspiPhone) : null,
          members: { create: { userId: owner.id, role: Role.OWNER } },
        },
        select: { id: true, slug: true, name: true, status: true },
      });
      return { ...store, owner: { phone } };
    }).catch((e) => {
      if ((e as { code?: string }).code === 'P2002') throw new ConflictException('Такой slug уже существует, повторите');
      throw e;
    });
  }

  /** Список магазинов для модерации (по статусу, по умолчанию — ожидающие). */
  async list(status?: StoreStatus, limit = 100) {
    const stores = await this.prisma.store.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, slug: true, name: true, status: true, phone: true,
        address: true, deliveryMode: true, createdAt: true,
        _count: { select: { products: true, orders: true } },
        members: { where: { role: 'OWNER' }, select: { user: { select: { phone: true, name: true } } } },
      },
    });
    return stores.map((s) => ({
      id: s.id, slug: s.slug, name: s.name, status: s.status, phone: s.phone,
      address: s.address, deliveryMode: s.deliveryMode, createdAt: s.createdAt,
      productCount: s._count.products, orderCount: s._count.orders,
      owner: s.members[0]?.user ?? null,
    }));
  }

  private async setStatus(id: string, status: StoreStatus) {
    const store = await this.prisma.store.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!store) throw new NotFoundException('Магазин не найден');
    if (store.status === status) return { id, status, changed: false };
    await this.prisma.store.update({ where: { id }, data: { status } });
    return { id, status, changed: true };
  }

  approve(id: string) { return this.setStatus(id, StoreStatus.ACTIVE); }      // PENDING → ACTIVE
  suspend(id: string) { return this.setStatus(id, StoreStatus.SUSPENDED); }   // временно (напр. неоплата подписки)
  block(id: string)   { return this.setStatus(id, StoreStatus.BLOCKED); }     // нарушение правил
}
