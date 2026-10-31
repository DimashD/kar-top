import { Inject, Injectable, Logger, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import type Redis from 'ioredis';
import { REDIS } from '../../redis/redis.module';
import { OtpChannel, OtpChannelName } from './channels/otp-channel';
import { TelegramChannel } from './channels/telegram.channel';
import { SmsChannel } from './channels/sms.channel';
import { WhatsappChannel } from './channels/whatsapp.channel';

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
    tg: TelegramChannel,
    sms: SmsChannel,
    wa: WhatsappChannel,
  ) {
    this.channels = { telegram: tg, sms, whatsapp: wa };
  }

  /** Только казахстанские номера; нормализуем к цифрам. */
  private normalize(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (!/^77\d{9}$/.test(digits)) {
      throw new BadRequestException('Поддерживаются только номера Казахстана (+7 7xx).');
    }
    return digits;
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

  /** Ответ контроллера одинаков для любого номера — нельзя узнать, зарегистрирован ли он. */
  async request(rawPhone: string, preferred: OtpChannelName = 'telegram'): Promise<void> {
    const phone = this.normalize(rawPhone);
    await this.rateLimit(phone);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 10);
    await this.redis.set(
      `otp:code:${phone}`,
      JSON.stringify({ codeHash, attempts: 0 }),
      'EX',
      CODE_TTL_SEC,
    );

    const order: OtpChannelName[] = [...new Set([preferred, 'sms', 'whatsapp'] as OtpChannelName[])];
    for (const name of order) {
      try {
        if (await this.channels[name].send(rawPhone, code)) {
          this.log.log(`OTP отправлен каналом ${name}`);
          return;
        }
      } catch (e) {
        this.log.warn(`Канал ${name} упал: ${(e as Error).message}`);
      }
    }
    this.log.error('Ни один канал не доставил код');
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
