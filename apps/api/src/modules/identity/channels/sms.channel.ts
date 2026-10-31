import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpChannel } from './otp-channel';

/**
 * SMS через казахстанского агрегатора (Mobizon / SMSC.kz) с зарегистрированным
 * именем отправителя. Запасной канал — работает на любом телефоне.
 * Заглушка: в dev логирует код; в проде заменить на HTTP-вызов провайдера.
 */
@Injectable()
export class SmsChannel implements OtpChannel {
  readonly name = 'sms' as const;
  private readonly log = new Logger(SmsChannel.name);

  constructor(private readonly config: ConfigService) {}

  async send(phone: string, code: string): Promise<boolean> {
    const apiKey = this.config.get<string>('SMS_API_KEY');
    if (!apiKey) {
      // В dev без ключа считаем «доставлено», чтобы поток работал локально.
      this.log.log(`[sms:dev] ${phone} → ${code}`);
      return this.config.get('NODE_ENV') !== 'production';
    }
    // TODO: реальный вызов Mobizon/SMSC.kz с SMS_SENDER_NAME.
    this.log.log(`[sms] отправка через агрегатора: ${phone}`);
    return true;
  }
}
