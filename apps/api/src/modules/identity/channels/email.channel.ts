import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpChannel } from './otp-channel';

/**
 * Email-канал доставки кода. Себестоимость ~0 — главный способ снизить косты на OTP
 * (см. docs/20 §5). `to` здесь — email, а не телефон.
 * Заглушка: в dev логирует код; в проде — SMTP/провайдер (SendGrid/SES/SMTP).
 */
@Injectable()
export class EmailChannel implements OtpChannel {
  readonly name = 'email' as const;
  private readonly log = new Logger(EmailChannel.name);

  constructor(private readonly config: ConfigService) {}

  async send(to: string, code: string): Promise<boolean> {
    const apiKey = this.config.get<string>('EMAIL_API_KEY');
    if (!apiKey) {
      this.log.log(`[email:dev] ${to} → ${code}`);
      return this.config.get('NODE_ENV') !== 'production';
    }
    // TODO: реальная отправка письма с кодом через провайдера (SES/SendGrid/SMTP).
    this.log.log(`[email] отправка кода на ${to}`);
    return true;
  }
}
