import { Inject, Injectable, Logger, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import type Redis from 'ioredis';
import { REDIS } from '../../redis/redis.module';
import { OtpChannel, OtpChannelName } from './channels/otp-channel';
import { TelegramChannel } from './channels/telegram.channel';
import { SmsChannel } from './channels/sms.channel';
import { WhatsappChannel } from './channels/whatsapp.channel';
import { EmailChannel } from './channels/email.channel';
import { PrismaService } from '../../prisma/prisma.service';

const CODE_TTL_SEC = 5 * 60;
const MAX_ATTEMPTS = 5;
const RATE_PER_15MIN = 3;
const RATE_PER_DAY = 10;

/** Защита денег (SMS-pumping) и от фейковых заказов — см. docs/07-security-audit.md §2.3. */
@Injectable()
export class OtpService {
  private readonly log = new Logger(OtpService.name);
  private readonly channels: Record<OtpChannelName, OtpChannel>;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    tg: TelegramChannel,
    sms: SmsChannel,
    wa: WhatsappChannel,
    email: EmailChannel,
  ) {
    this.channels = { email, telegram: tg, whatsapp: wa, sms };
  }

  /** Только казахстанские номера; нормализуем к цифрам. */
  private normalize(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (!/^77\d{9}$/.test(digits)) {
      throw new BadRequestException('Поддерживаются только номера Казахстана (+7 7xx).');
    }
    return digits;
  }

  /** Счётчик попыток (вход по паролю): false — лимит исчерпан. */
  async attempt(key: string, max: number, ttlSec: number): Promise<boolean> {
    const k = `rl:${key}`;
    const n = await this.redis.incr(k);
    if (n === 1) await this.redis.expire(k, ttlSec);
    return n <= max;
  }

  async resetAttempts(key: string) {
    await this.redis.del(`rl:${key}`);
  }

  private async rateLimit(phone: string) {
    const k15 = `otp:rl:15m:${phone}`;
    const kDay = `otp:rl:day:${phone}`;
    const c15 = await this.redis.incr(k15);
    if (c15 === 1) await this.redis.expire(k15, 15 * 60);
    const cDay = await this.redis.incr(kDay);
    if (cDay === 1) await this.redis.expire(kDay, 24 * 60 * 60);
    if (c15 > RATE_PER_15MIN || cDay > RATE_PER_DAY) {
      throw new HttpException('Слишком много запросов кода. Попробуйте позже.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  /**
   * Запрос кода. Ответ контроллера одинаков для любого номера — нельзя узнать, зарегистрирован ли он.
   * `email` можно передать для привязки email↔телефон; тогда код пойдёт на почту (дёшево).
   * Приоритет каналов (docs/20 §3): email → Telegram → WhatsApp → SMS.
   */
  async request(rawPhone: string, preferred: OtpChannelName = 'telegram'): Promise<OtpChannelName | 'test' | null> {
    const phone = this.normalize(rawPhone);
    const fixed = this.testOtpCode(phone);
    // Лимит защищает от SMS-pumping; в тестовой среде с фиксированным кодом SMS не отправляются — лимит не нужен.
    if (!fixed) await this.rateLimit(phone);

    const code = fixed ?? String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 10);
    await this.redis.set(
      `otp:code:${phone}`,
      JSON.stringify({ codeHash, attempts: 0 }),
      'EX',
      CODE_TTL_SEC,
    );
    if (fixed) {
      // Тестовая среда: никуда не отправляем (не тратим SMS), код фиксированный.
      this.log.log('OTP (staging): используется фиксированный тестовый код');
      return 'test';
    }

    // Только УЖЕ ПОДТВЕРЖДЁННЫЙ (спаренный) email — код пойдёт на почту. Непроверенный email не используется.
    const emailTarget = await this.pairedEmail(phone);

    // Порядок каналов: email (если есть) → предпочитаемый (telegram) → whatsapp → sms.
    const order: OtpChannelName[] = [...new Set(
      [emailTarget ? 'email' : null, preferred, 'sms', 'whatsapp'].filter(Boolean) as OtpChannelName[],
    )];
    for (const name of order) {
      const to = name === 'email' ? emailTarget! : rawPhone;
      try {
        if (await this.channels[name].send(to, code)) {
          this.log.log(`OTP отправлен каналом ${name}`);
          return name;
        }
      } catch (e) {
        this.log.warn(`Канал ${name} упал: ${(e as Error).message}`);
      }
    }
    this.log.error('Ни один канал не доставил код');
    return null;
  }

  /**
   * Фиксированный OTP-код — ТОЛЬКО в тестовой среде (APP_ENV=staging + TEST_OTP_CODE из 6 цифр).
   * На проде (APP_ENV=production или не задан) всегда null, даже если TEST_OTP_CODE задан по ошибке.
   */
  private testOtpCode(phone?: string): string | null {
    if (this.config.get<string>('APP_ENV') !== 'staging') return null;
    // OTP_REAL_PHONES — номера, которым и на тесте шлём настоящий код (проверка Telegram/SMS/WhatsApp).
    const real = (this.config.get<string>('OTP_REAL_PHONES') || '').split(',').map((p) => p.replace(/\D/g, '')).filter(Boolean);
    if (phone && real.includes(phone.replace(/\D/g, ''))) return null;
    const code = this.config.get<string>('TEST_OTP_CODE');
    return code && /^\d{6}$/.test(code) ? code : null;
  }

  /** Подтверждённый (спаренный) email пользователя по телефону. Непроверенный email в User.email не попадает. */
  private async pairedEmail(phone: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({ where: { phone: `+${phone}` }, select: { email: true } });
    return user?.email ?? null;
  }

  /**
   * Шаг 1 привязки email: отправить код на указанную почту (телефон уже подтверждён — userId из сессии).
   * Привязка произойдёт только после verifyEmail. Email, занятый другим аккаунтом, не принимаем.
   */
  async requestEmailCode(userId: string, rawEmail: string): Promise<void> {
    const email = rawEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Некорректный email');
    const taken = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (taken && taken.id !== userId) throw new BadRequestException('Этот email уже привязан к другому аккаунту');

    const rlKey = `email:rl:${userId}`;
    const c = await this.redis.incr(rlKey);
    if (c === 1) await this.redis.expire(rlKey, 15 * 60);
    if (c > RATE_PER_15MIN) throw new HttpException('Слишком много запросов. Попробуйте позже.', HttpStatus.TOO_MANY_REQUESTS);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 10);
    await this.redis.set(`email:code:${userId}`, JSON.stringify({ codeHash, email, attempts: 0 }), 'EX', CODE_TTL_SEC);
    await this.channels.email.send(email, code);
  }

  /** Шаг 2: подтвердить код из письма → СПАРИТЬ email с телефоном (оба подтверждены). */
  async verifyEmailCode(userId: string, code: string): Promise<string> {
    const key = `email:code:${userId}`;
    const raw = await this.redis.get(key);
    if (!raw) throw new BadRequestException('Код не запрашивался или истёк');
    const data = JSON.parse(raw) as { codeHash: string; email: string; attempts: number };
    if (data.attempts >= MAX_ATTEMPTS) { await this.redis.del(key); throw new BadRequestException('Слишком много попыток'); }
    if (!(await bcrypt.compare(code, data.codeHash))) {
      data.attempts += 1;
      const ttl = await this.redis.ttl(key);
      await this.redis.set(key, JSON.stringify(data), 'EX', ttl > 0 ? ttl : CODE_TTL_SEC);
      throw new BadRequestException('Неверный код');
    }
    await this.redis.del(key);
    try {
      await this.prisma.user.update({ where: { id: userId }, data: { email: data.email } });
    } catch {
      throw new BadRequestException('Этот email уже привязан к другому аккаунту');
    }
    return data.email;
  }

  /** Возвращает нормализованный телефон при успехе, иначе null. */
  async verify(rawPhone: string, code: string): Promise<string | null> {
    const phone = this.normalize(rawPhone);
    const key = `otp:code:${phone}`;
    const raw = await this.redis.get(key);
    if (!raw) return null;

    const data = JSON.parse(raw) as { codeHash: string; attempts: number };
    if (data.attempts >= MAX_ATTEMPTS) {
      await this.redis.del(key);
      return null;
    }
    const ok = await bcrypt.compare(code, data.codeHash);
    if (!ok) {
      data.attempts += 1;
      const ttl = await this.redis.ttl(key);
      await this.redis.set(key, JSON.stringify(data), 'EX', ttl > 0 ? ttl : CODE_TTL_SEC);
      return null;
    }
    await this.redis.del(key);
    return phone;
  }
}
