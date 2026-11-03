import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { OtpService } from './otp.service';
import { TokenService, TokenPair } from './token.service';

/** Телефон РК → +77XXXXXXXXX. */
function toE164(raw: string): string {
  const d = (raw || '').replace(/\D/g, '');
  const n = d.startsWith('8') && d.length === 11 ? '7' + d.slice(1) : d;
  return '+' + n;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
  ) {}

  /** Подтверждение кода: создаём/находим пользователя, регистрируем доверенное устройство, выдаём токены. */
  async confirm(phone: string, code: string, deviceLabel?: string): Promise<TokenPair & { userId: string }> {
    const normalized = await this.otp.verify(phone, code);
    if (!normalized) throw new UnauthorizedException('Неверный или просроченный код.');

    const e164 = '+' + normalized;
    const user = await this.prisma.user.upsert({
      where: { phone: e164 },
      update: {},
      create: { phone: e164 },
    });

    // Доверенное устройство на 90 дней (чтобы код спрашивать только при первом заказе).
    const trustedUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    await this.prisma.device.create({
      data: { userId: user.id, label: deviceLabel ?? null, trustedUntil },
    });

    const pair = await this.tokens.issue(user.id);
    return { ...pair, userId: user.id };
  }

  /** Вход сотрудника платформы по телефону ИЛИ email + пароль (без OTP — для админки, дешевле). */
  async loginStaff(login: string, password: string): Promise<{ accessToken: string; userId: string; name: string | null; role: string }> {
    const raw = (login || '').trim();
    const isEmail = raw.includes('@');
    const where = isEmail ? { email: raw.toLowerCase() } : { phone: toE164(raw) };
    const user = await this.prisma.user.findUnique({
      where: where as any,
      select: { id: true, name: true, platformRole: true, passwordHash: true },
    });
    const fail = () => { throw new UnauthorizedException('Неверный логин или пароль'); };
    if (!user || !user.platformRole || !user.passwordHash) return fail();
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return fail();
    const accessToken = await this.tokens.issueStaff(user.id); // длинная сессия (7 дней)
    return { accessToken, userId: user.id, name: user.name, role: user.platformRole };
  }
}
