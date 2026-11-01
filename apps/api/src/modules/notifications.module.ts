import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationDispatcher } from './notifications/dispatcher.service';
import { FcmProvider, ApnsProvider, WebPushProvider, PushRegistry } from './notifications/push-provider';
import { AdminGuard } from '../common/auth/admin.guard';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationDispatcher, PushRegistry, FcmProvider, ApnsProvider, WebPushProvider, AdminGuard],
})
export class NotificationsModule {}
