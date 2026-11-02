import { Logger } from '@nestjs/common';
import { createSign } from 'node:crypto';
import { PushMessage } from './push-provider';

/**
 * Отправка пушей через FCM HTTP v1. Один эндпоинт обслуживает Android/iOS/Web
 * (токены от firebase_messaging — FCM-токены для всех платформ).
 * Включается переменной окружения FIREBASE_SERVICE_ACCOUNT (JSON сервис-аккаунта)
 * или FIREBASE_SERVICE_ACCOUNT_PATH (путь к файлу). Без неё провайдер работает как заглушка.
 */
interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export class FcmSender {
  private readonly log = new Logger(FcmSender.name);
  private readonly sa: ServiceAccount | null;
  private token: { value: string; exp: number } | null = null;

  constructor() {
    this.sa = this.loadServiceAccount();
  }

  get enabled(): boolean {
    return this.sa !== null;
  }

  private loadServiceAccount(): ServiceAccount | null {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    try {
      let json: string | undefined = raw;
      if (!json && path) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        json = require('node:fs').readFileSync(path, 'utf8');
      }
      if (!json) return null;
      const sa = JSON.parse(json) as ServiceAccount;
      if (!sa.project_id || !sa.client_email || !sa.private_key) return null;
      return sa;
    } catch {
      return null;
    }
  }

  /** OAuth2 access token по JWT сервис-аккаунта (с кэшем до истечения). */
  private async accessToken(): Promise<string> {
    if (this.token && this.token.exp > Date.now() + 60_000) return this.token.value;
    const sa = this.sa!;
    const now = Math.floor(Date.now() / 1000);
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const header = b64({ alg: 'RS256', typ: 'JWT' });
    const claim = b64({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    });
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${claim}`);
    const sig = signer.sign(sa.private_key).toString('base64url');
    const jwt = `${header}.${claim}.${sig}`;

    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    if (!r.ok) throw new Error(`oauth ${r.status}: ${await r.text()}`);
    const data = (await r.json()) as { access_token: string; expires_in: number };
    this.token = { value: data.access_token, exp: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  }

  /** Отправить одно сообщение на registration token. true — принято FCM. */
  async send(token: string, msg: PushMessage): Promise<boolean> {
    if (!this.sa) {
      this.log.log(`[fcm:stub] ${token.slice(0, 10)}… «${msg.title}: ${msg.body}»`);
      return process.env.NODE_ENV !== 'production';
    }
    const access = await this.accessToken();
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${this.sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: msg.title, body: msg.body },
          data: msg.data ?? {},
          android: { priority: 'high' },
          apns: { headers: { 'apns-priority': '10' } },
        },
      }),
    });
    if (r.ok) return true;
    // 404/400 UNREGISTERED — токен протух; вернём false, диспетчер не зациклится.
    this.log.warn(`FCM ${r.status}: ${await r.text()}`);
    return false;
  }
}
