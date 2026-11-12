import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
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

    return this.loginVerifiedPhone('+' + normalized, deviceLabel);
  }

  /** Номер уже подтверждён (кодом или Telegram): находим/создаём пользователя, доверенное устройство, токены. */
  async loginVerifiedPhone(e164: string, deviceLabel?: string): Promise<TokenPair & { userId: string }> {
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

  /**
   * Вход сотрудника магазина по номеру и паролю (пароль он задаёт сам после первого входа по коду).
   * 5 неверных попыток — пауза 15 минут.
   */
  async loginMerchant(rawPhone: string, password: string): Promise<TokenPair & { userId: string }> {
    const phone = toE164(rawPhone);
    if (!(await this.otp.attempt(`pwd:${phone}`, 5, 15 * 60))) {
      throw new HttpException('Слишком много попыток. Подождите 15 минут или войдите по коду.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const user = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true, passwordHash: true, _count: { select: { members: true } } },
    });
    const ok = !!user?.passwordHash && user._count.members > 0 && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) throw new UnauthorizedException('Неверный номер или пароль');
    await this.otp.resetAttempts(`pwd:${phone}`);
    const pair = await this.tokens.issue(user!.id);
    return { ...pair, userId: user!.id };
  }

  /** Пароль задаёт сам пользователь (уже вошедший по коду) — дальше вход без SMS. */
  async setPassword(userId: string, password: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
    return { ok: true };
  }

  async profile(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { phone: true, name: true, passwordHash: true } });
    return { phone: u?.phone, name: u?.name ?? null, hasPassword: !!u?.passwordHash };
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
