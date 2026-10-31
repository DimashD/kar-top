export type OtpChannelName = 'telegram' | 'sms' | 'whatsapp';

/**
 * Абстракция канала доставки кода подтверждения.
 * Реализуется только официальными провайдерами (см. docs/08-otp-and-launch.md):
 * Telegram Gateway → WhatsApp Cloud API → SMS (Mobizon/SMSC.kz).
 */
export interface OtpChannel {
  readonly name: OtpChannelName;
  /** true — код принят к доставке; false — провайдер не смог, пробуем следующий канал. */
  send(phone: string, code: string): Promise<boolean>;
}
