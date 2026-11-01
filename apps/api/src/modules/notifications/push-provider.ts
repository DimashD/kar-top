import { Injectable, Logger } from '@nestjs/common';

export type Platform = 'android' | 'ios' | 'web';

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** Абстракция провайдера пуша: FCM (Android), APNs (iOS), Web Push (VAPID). */
export interface PushProvider {
  readonly platform: Platform;
  send(token: string, msg: PushMessage): Promise<boolean>;
}

@Injectable()
export class FcmProvider implements PushProvider {
  readonly platform = 'android' as const;
  private readonly log = new Logger(FcmProvider.name);
  async send(token: string, msg: PushMessage): Promise<boolean> {
    // TODO: реальная отправка через FCM (service account). Пока лог в dev.
    this.log.log(`[fcm] ${token.slice(0, 10)}… «${msg.title}: ${msg.body}»`);
    return true;
  }
}

@Injectable()
export class ApnsProvider implements PushProvider {
  readonly platform = 'ios' as const;
  private readonly log = new Logger(ApnsProvider.name);
  async send(token: string, msg: PushMessage): Promise<boolean> {
    this.log.log(`[apns] ${token.slice(0, 10)}… «${msg.title}: ${msg.body}»`);
    return true;
  }
}

@Injectable()
export class WebPushProvider implements PushProvider {
  readonly platform = 'web' as const;
  private readonly log = new Logger(WebPushProvider.name);
  async send(token: string, msg: PushMessage): Promise<boolean> {
    // TODO: web-push (VAPID). На iOS web push ограничен.
    this.log.log(`[webpush] ${token.slice(0, 10)}… «${msg.title}: ${msg.body}»`);
    return true;
  }
}

@Injectable()
export class PushRegistry {
  private map: Record<Platform, PushProvider>;
  constructor(fcm: FcmProvider, apns: ApnsProvider, web: WebPushProvider) {
    this.map = { android: fcm, ios: apns, web };
  }
  get(platform: Platform): PushProvider | undefined {
    return this.map[platform];
  }
}
