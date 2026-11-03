import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Приведение казахстанского телефона к формату +77XXXXXXXXX. */
function normalizePhone(raw: string): string {
  const d = (raw || '').replace(/\D/g, '');
  const n = d.startsWith('8') && d.length === 11 ? '7' + d.slice(1) : d;
  if (!/^77\d{9}$/.test(n)) throw new BadRequestException('Телефон — формат +7 7xx xxx xx xx');
  return '+' + n;
}

const STAFF_ROLES: Role[] = ['PLATFORM_ADMIN', 'SUPPORT'];
const SELECT = { id: true, name: true, phone: true, platformRole: true, createdAt: true } as const;

/** Управление сотрудниками платформы (доступ только у PLATFORM_ADMIN). */
@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  /** Список сотрудников (у кого есть platformRole). */
  list() {
    return this.prisma.user.findMany({
      where: { platformRole: { not: null } },
      orderBy: { createdAt: 'asc' },
      select: SELECT,
    });
  }

  /** Создать/назначить сотрудника по телефону + паролю. Если пользователь уже есть — выдаём ему роль. */
  async create(input: { name: string; phone: string; role: Role; password: string }) {
    const name = (input.name || '').trim();
    if (name.length < 2) throw new BadRequestException('Укажите имя');
    if (!STAFF_ROLES.includes(input.role)) throw new BadRequestException('Недопустимая роль');
    if (!input.password || input.password.length < 6) throw new BadRequestException('Пароль — минимум 6 символов');
    const phone = normalizePhone(input.phone);
    const passwordHash = await bcrypt.hash(input.password, 10);

    const existing = await this.prisma.user.findUnique({ where: { phone }, select: { id: true, platformRole: true } });
    if (existing?.platformRole) throw new ConflictException('У этого номера уже есть доступ в админку');

    const user = await this.prisma.user.upsert({
      where: { phone },
      update: { platformRole: input.role, passwordHash, ...(name ? { name } : {}) },
      create: { phone, name, platformRole: input.role, passwordHash },
      select: SELECT,
    });
    return user;
  }

  /** Сбросить пароль сотрудника (только администратор). */
  async setPassword(id: string, password: string) {
    if (!password || password.length < 6) throw new BadRequestException('Пароль — минимум 6 символов');
    const target = await this.prisma.user.findUnique({ where: { id }, select: { platformRole: true } });
    if (!target?.platformRole) throw new NotFoundException('Сотрудник не найден');
    await this.prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
    return { ok: true };
  }

  /** Сменить роль или отозвать доступ (role = null). Нельзя снять последнего админа и себя. */
  async setRole(actingUserId: string, id: string, role: Role | null) {
    if (role !== null && !STAFF_ROLES.includes(role)) throw new BadRequestException('Недопустимая роль');
    const target = await this.prisma.user.findUnique({ where: { id }, select: { id: true, platformRole: true } });
    if (!target) throw new NotFoundException('Сотрудник не найден');

    const losingAdmin = target.platformRole === 'PLATFORM_ADMIN' && role !== 'PLATFORM_ADMIN';
    if (losingAdmin) {
      if (id === actingUserId) throw new BadRequestException('Нельзя снять роль администратора с самого себя');
      const admins = await this.prisma.user.count({ where: { platformRole: 'PLATFORM_ADMIN' } });
      if (admins <= 1) throw new BadRequestException('Нельзя снять последнего администратора платформы');
    }

    return this.prisma.user.update({ where: { id }, data: { platformRole: role }, select: SELECT });
  }
}
