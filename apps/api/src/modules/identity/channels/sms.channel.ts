import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { OtpChannel } from './otp-channel';

/**
 * SMS через SMSC.kz (https://smsc.kz/api/http/send/) с зарегистрированным именем отправителя.
 * Запасной канал для кодов (работает на любом телефоне) и для критичных уведомлений покупателю без пуша.
 * Доступ: SMSC_LOGIN + SMSC_PASSWORD (пароль API из личного кабинета), имя отправителя — SMS_SENDER_NAME.
 * Без доступа: в dev логирует текст и считает «доставлено», в проде — недоставлено (false).
 */
@Injectable()
export class SmsChannel implements OtpChannel {
  readonly name = 'sms' as const;
  private readonly log = new Logger(SmsChannel.name);

  constructor(private readonly config: ConfigService) {}

  async send(phone: string, code: string): Promise<boolean> {
    return this.sendText(phone, `Kartop: код ${code}. Никому его не сообщайте.`);
  }

  /** Отправить произвольный текст (уведомление). true — SMSC принял сообщение. */
  async sendText(phone: string, text: string): Promise<boolean> {
    const login = this.config.get<string>('SMSC_LOGIN');
    const psw = this.config.get<string>('SMSC_PASSWORD');
    if (!login || !psw) {
      this.log.log(`[sms:dev] ${phone} → ${text}`);
      return this.config.get('NODE_ENV') !== 'production';
    }
    const params = new URLSearchParams({
      login,
      psw,
      phones: phone.replace(/\D/g, ''),
      mes: text,
      charset: 'utf-8',
      fmt: '3', // ответ в JSON
    });
    const sender = this.config.get<string>('SMS_SENDER_NAME');
    if (sender) params.set('sender', sender);
    try {
      const r = await axios.post('https://smsc.kz/sys/send.php', params.toString(), {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      });
      if (r.data?.error) {
        // Коды ошибок SMSC: 2 — логин/пароль/IP, 3 — нет денег, 7 — имя отправителя не одобрено, 8 — номер запрещён.
        this.log.warn(`SMSC отказ: ${r.data.error} (код ${r.data.error_code})`);
        return false;
      }
      return true;
    } catch (e) {
      this.log.warn(`SMSC недоступен: ${(e as Error).message}`);
      return false;
    }
  }
}
