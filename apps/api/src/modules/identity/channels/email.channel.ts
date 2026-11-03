import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { OtpChannel } from './otp-channel';

/**
 * Email-канал доставки кода. Себестоимость ~0 — главный способ снизить косты на OTP.
 * Отправка через SMTP (nodemailer), если заданы SMTP_HOST/SMTP_USER/SMTP_PASS.
 * Без SMTP: в dev логирует код, в проде считается недоставленным (false).
 */
@Injectable()
export class EmailChannel implements OtpChannel {
  readonly name = 'email' as const;
  private readonly log = new Logger(EmailChannel.name);
  private transport: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  private getTransport(): nodemailer.Transporter | null {
    if (this.transport) return this.transport;
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    if (!host || !user || !pass) return null;
    const port = Number(this.config.get('SMTP_PORT') ?? 465);
    this.transport = nodemailer.createTransport({
      host, port, secure: port === 465, auth: { user, pass },
    });
    return this.transport;
  }

  /** Отправить письмо (код или произвольный текст). Возвращает true при успехе. */
  async sendMail(to: string, subject: string, text: string): Promise<boolean> {
    const t = this.getTransport();
    if (!t) {
      this.log.log(`[email:dev] ${to} | ${subject} | ${text}`);
      return this.config.get('NODE_ENV') !== 'production';
    }
    const from = this.config.get<string>('EMAIL_FROM') || this.config.get<string>('SMTP_USER')!;
    await t.sendMail({ from, to, subject, text });
    return true;
  }

  async send(to: string, code: string): Promise<boolean> {
    return this.sendMail(to, 'Код входа Kartop', `Ваш код для входа в Kartop: ${code}\nНикому его не сообщайте.`);
  }
}
