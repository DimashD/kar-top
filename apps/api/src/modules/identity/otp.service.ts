import { Injectable, Logger } from '@nestjs/common';

type Channel = 'telegram' | 'sms' | 'whatsapp';

// Абстракция каналов отправки кода. Только официальные провайдеры:
// Telegram Gateway → SMS (Mobizon/SMSC.kz) → WhatsApp Cloud API (см. docs/08).
interface OtpChannel { send(phone: string, code: string): Promise<boolean>; }

@Injectable()
export class OtpService {
  private readonly log = new Logger(OtpService.name);
  // TODO: заменить заглушки на реальные провайдеры и хранить хэш кода в БД/Redis с TTL 5 мин.
  private channels: Record<Channel, OtpChannel> = {
    telegram: { send: async (p, c) => (this.log.log(`[telegram] ${p} ${c}`), true) },
    sms:      { send: async (p, c) => (this.log.log(`[sms] ${p} ${c}`), true) },
    whatsapp: { send: async (p, c) => (this.log.log(`[whatsapp] ${p} ${c}`), true) },
  };

  async request(phone: string, channel: Channel = 'telegram') {
    // TODO: rate-limit (3/15мин, 10/сутки на номер+IP+устройство), капча на вебе.
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const order: Channel[] = [channel, 'sms', 'whatsapp'];
    for (const ch of order) {
      if (await this.channels[ch].send(phone, code)) break; // автопереход на SMS, если не доставлено
    }
    // TODO: сохранить bcrypt-хэш(code) + expiresAt.
  }

  async verify(phone: string, code: string) {
    // TODO: сверка хэша в постоянное время, лимит попыток, выпуск JWT access(15м)+refresh.
    return { verified: false, note: 'stub — реализуется в спринте S1 (E0-3)' };
  }
}
