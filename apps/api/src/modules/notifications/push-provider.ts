import { Injectable, Logger } from '@nestjs/common';
import { FcmSender } from './fcm-sender';

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

// Все платформы (Android/iOS/Web) обслуживает FCM: токены от firebase_messaging — FCM-токены.
// Пока FIREBASE_SERVICE_ACCOUNT не задан, FcmSender работает как dev-заглушка (лог).
@Injectable()
class FcmPlatformProvider implements PushProvider {
  constructor(readonly platform: Platform, private readonly sender: FcmSender) {}
  send(token: string, msg: PushMessage): Promise<boolean> {
    return this.sender.send(token, msg);
  }
}

@Injectable()
export class PushRegistry {
  private readonly log = new Logger(PushRegistry.name);
  private readonly sender = new FcmSender();
  private readonly map: Record<Platform, PushProvider>;
  constructor() {
    this.map = {
      android: new FcmPlatformProvider('android', this.sender),
      ios: new FcmPlatformProvider('ios', this.sender),
      web: new FcmPlatformProvider('web', this.sender),
    };
    this.log.log(`Push: FCM ${this.sender.enabled ? 'включён (service account)' : 'в режиме заглушки (нет FIREBASE_SERVICE_ACCOUNT)'}`);
  }
  get(platform: Platform): PushProvider | undefined {
    return this.map[platform];
  }
}
