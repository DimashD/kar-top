import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { OtpChannel } from './otp-channel';

/**
 * Telegram Gateway — официальный сервис Telegram для кодов подтверждения.
 * Самый дешёвый канал; код приходит в системный чат «Verification Codes».
 * Без токена канал считается недоступным (отдаём false → fallback на SMS).
 */
@Injectable()
export class TelegramChannel implements OtpChannel {
  readonly name = 'telegram' as const;
  private readonly log = new Logger(TelegramChannel.name);

  constructor(private readonly config: ConfigService) {}

  async send(phone: string, code: string): Promise<boolean> {
    const token = this.config.get<string>('TELEGRAM_GATEWAY_TOKEN');
    if (!token) {
      this.log.warn('TELEGRAM_GATEWAY_TOKEN не задан — пропускаю Telegram-канал');
      return false;
    }
    try {
      const res = await axios.post(
        'https://gatewayapi.telegram.org/sendVerificationMessage',
        // ttl — сколько секунд код показывается действительным в Telegram (совпадает со сроком кода у нас).
        { phone_number: phone.replace(/[^\d+]/g, ''), code, ttl: 300 },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 },
      );
      if (res.data?.ok === true) return true;
      // Например PHONE_NUMBER_NOT_FOUND — у номера нет Telegram: дальше пойдёт SMS.
      this.log.warn(`Telegram Gateway: ${res.data?.error ?? 'не доставлено'}`);
      return false;
    } catch (e) {
      this.log.warn(`Telegram Gateway недоступен: ${(e as Error).message}`);
      return false;
    }
  }
}
