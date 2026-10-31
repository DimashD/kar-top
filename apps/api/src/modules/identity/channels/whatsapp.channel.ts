import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpChannel } from './otp-channel';

/**
 * WhatsApp Business Platform (Cloud API от Meta), шаблон категории Authentication.
 * Только официальный канал (не серые шлюзы). Заглушка до верификации бизнеса в Meta.
 */
@Injectable()
export class WhatsappChannel implements OtpChannel {
  readonly name = 'whatsapp' as const;
  private readonly log = new Logger(WhatsappChannel.name);

  constructor(private readonly config: ConfigService) {}

  async send(phone: string, code: string): Promise<boolean> {
    const token = this.config.get<string>('WHATSAPP_TOKEN');
    if (!token) {
      this.log.warn('WHATSAPP_TOKEN не задан — пропускаю WhatsApp-канал');
      return false;
    }
    // TODO: POST в Graph API с authentication-шаблоном.
    this.log.log(`[whatsapp] отправка шаблона: ${phone}`);
    return true;
  }
}
