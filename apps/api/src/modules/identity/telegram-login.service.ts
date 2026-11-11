import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import axios from 'axios';
import type Redis from 'ioredis';
import { REDIS } from '../../redis/redis.module';
import { AuthService } from './auth.service';

const LOGIN_TTL_SEC = 10 * 60;

/**
 * Вход покупателя через наш Telegram-бот (бесплатно, без Telegram Gateway):
 * сайт получает одноразовый токен → покупатель открывает t.me/<бот>?start=<токен> → жмёт «Поделиться номером» →
 * Telegram присылает контакт (номер, подтверждённый Telegram) → сайт, опрашивая /poll, получает токены входа.
 * Номер принимаем только свой: contact.user_id должен совпадать с отправителем.
 */
@Injectable()
export class TelegramLoginService implements OnModuleInit {
  private readonly log = new Logger(TelegramLoginService.name);

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
  ) {}

  private get token() { return this.config.get<string>('TELEGRAM_BOT_TOKEN') || ''; }
  private get botName() { return this.config.get<string>('TELEGRAM_BOT_NAME') || 'kartop_kz_bot'; }
  /** Секрет вебхука (заголовок от Telegram) — производный от токена бота. */
  webhookSecret() { return createHash('sha256').update(`kartop:${this.token}`).digest('hex').slice(0, 48); }

  /** У бота один вебхук: его ставит только среда с TELEGRAM_BOT_WEBHOOK=1 (сначала тест, потом прод). */
  async onModuleInit() {
    if (!this.token || this.config.get('TELEGRAM_BOT_WEBHOOK') !== '1') return;
    const base = (this.config.get<string>('WEB_BASE_URL') || '').replace(/\/$/, '');
    if (!base) return;
    try {
      await this.api('setWebhook', { url: `${base}/api/telegram/webhook`, secret_token: this.webhookSecret(), allowed_updates: ['message'] });
      this.log.log(`Telegram-бот: вебхук ${base}/api/telegram/webhook`);
    } catch (e) {
      this.log.warn(`Telegram-бот: не удалось поставить вебхук: ${(e as Error).message}`);
    }
  }

  private api(method: string, body: unknown) {
    return axios.post(`https://api.telegram.org/bot${this.token}/${method}`, body, { timeout: 10000 });
  }

  /** Начать вход: одноразовый токен и ссылка на бота. */
  async start() {
    const id = randomBytes(18).toString('base64url');
    await this.redis.set(`tglogin:${id}`, JSON.stringify({ status: 'pending' }), 'EX', LOGIN_TTL_SEC);
    return { token: id, botUrl: `https://t.me/${this.botName}?start=${id}`, enabled: !!this.token };
  }

  /** Опрос с сайта: номер подтверждён — выдаём токены входа (один раз). */
  async poll(id: string) {
    const raw = await this.redis.get(`tglogin:${id}`);
    if (!raw) return { status: 'expired' as const };
    const s = JSON.parse(raw) as { status: string; phone?: string };
    if (s.status !== 'confirmed' || !s.phone) return { status: 'pending' as const };
    await this.redis.del(`tglogin:${id}`);
    const tokens = await this.auth.loginVerifiedPhone(s.phone, 'telegram');
    return { status: 'ok' as const, phone: s.phone, ...tokens };
  }

  /** Обновление от Telegram. */
  async handle(update: any) {
    const m = update?.message;
    if (!m?.chat?.id) return;
    const chat = m.chat.id;
    const text: string = m.text ?? '';
    if (text.startsWith('/start')) {
      const id = text.split(' ')[1];
      if (id && (await this.redis.exists(`tglogin:${id}`))) {
        await this.redis.set(`tglogin:chat:${chat}`, id, 'EX', LOGIN_TTL_SEC);
        await this.send(chat, 'Чтобы войти в Kartop, нажмите кнопку ниже 👇\nKartop-қа кіру үшін төмендегі түймені басыңыз 👇', {
          keyboard: [[{ text: '📱 Поделиться номером / Нөмірмен бөлісу', request_contact: true }]],
          resize_keyboard: true, one_time_keyboard: true,
        });
      } else {
        await this.send(chat, 'Здравствуйте! Это бот Kartop — магазины у дома онлайн. Чтобы войти, нажмите «Войти через Telegram» на сайте или в приложении Kartop.');
      }
      return;
    }
    if (m.contact) {
      const id = await this.redis.get(`tglogin:chat:${chat}`);
      if (!id) {
        await this.send(chat, 'Ссылка для входа устарела. Нажмите «Войти через Telegram» на сайте ещё раз.', { remove_keyboard: true });
        return;
      }
      // Только свой номер: контакт должен принадлежать отправителю.
      if (m.contact.user_id !== m.from?.id) {
        await this.send(chat, 'Отправьте, пожалуйста, свой номер — кнопкой «Поделиться номером».');
        return;
      }
      const digits = String(m.contact.phone_number || '').replace(/\D/g, '');
      if (!/^77\d{9}$/.test(digits)) {
        await this.send(chat, 'Пока поддерживаются только номера Казахстана (+7 7xx). Войдите по SMS на сайте.', { remove_keyboard: true });
        return;
      }
      await this.redis.set(`tglogin:${id}`, JSON.stringify({ status: 'confirmed', phone: `+${digits}` }), 'EX', LOGIN_TTL_SEC);
      await this.redis.del(`tglogin:chat:${chat}`);
      await this.send(chat, '✅ Готово! Номер подтверждён — вернитесь в Kartop, вход выполнен.\n✅ Дайын! Kartop-қа оралыңыз.', { remove_keyboard: true });
    }
  }

  private async send(chat: number, text: string, reply_markup?: unknown) {
    try {
      await this.api('sendMessage', { chat_id: chat, text, ...(reply_markup ? { reply_markup } : {}) });
    } catch (e) {
      this.log.warn(`Telegram-бот: sendMessage: ${(e as Error).message}`);
    }
  }
}
