export type OtpChannelName = 'telegram' | 'sms' | 'whatsapp';

/**
 * Абстракция канала доставки кода подтверждения.
 * Реализуется только официальными провайдерами (см. docs/08-otp-and-launch.md):
 * Telegram Gateway → SMS (Mobizon/SMSC.kz) → WhatsApp Cloud API.
 */
export interface OtpChannel {
  readonly name: OtpChannelName;
  /** true — код принят к доставке; false — провайдер не смог, пробуем следующий канал. */
  send(phone: string, code: string): Promise<boolean>;
}
