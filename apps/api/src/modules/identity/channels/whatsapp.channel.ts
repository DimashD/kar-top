import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { OtpChannel } from './otp-channel';

/**
 * WhatsApp Business Platform (Cloud API от Meta), шаблон категории Authentication с кнопкой «Скопировать код».
 * Только официальный канал. Нужны: WHATSAPP_TOKEN (постоянный токен системного пользователя),
 * WHATSAPP_PHONE_NUMBER_ID, одобренный шаблон WHATSAPP_OTP_TEMPLATE (по умолчанию kartop_otp, язык ru).
 * Без токена канал пропускается (false → следующий канал).
 */
@Injectable()
export class WhatsappChannel implements OtpChannel {
  readonly name = 'whatsapp' as const;
  private readonly log = new Logger(WhatsappChannel.name);

  constructor(private readonly config: ConfigService) {}

  async send(phone: string, code: string): Promise<boolean> {
    const token = this.config.get<string>('WHATSAPP_TOKEN');
    const phoneId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    if (!token || !phoneId) {
      this.log.warn('WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID не заданы — пропускаю WhatsApp-канал');
      return false;
    }
    const template = this.config.get<string>('WHATSAPP_OTP_TEMPLATE') || 'kartop_otp';
    const lang = this.config.get<string>('WHATSAPP_OTP_LANG') || 'ru';
    try {
      const r = await axios.post(
        `https://graph.facebook.com/v21.0/${phoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: phone.replace(/\D/g, ''),
          type: 'template',
          template: {
            name: template,
            language: { code: lang },
            // Шаблон Authentication: код в тексте и в кнопке «Скопировать код».
            components: [
              { type: 'body', parameters: [{ type: 'text', text: code }] },
              { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
            ],
          },
        },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 },
      );
      return Array.isArray(r.data?.messages) && r.data.messages.length > 0;
    } catch (e: any) {
      this.log.warn(`WhatsApp Cloud API отказ: ${e?.response?.data?.error?.message ?? e.message}`);
      return false;
    }
  }
}
