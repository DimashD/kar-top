import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationDispatcher } from './notifications/dispatcher.service';
import { PushRegistry } from './notifications/push-provider';
import { AdminGuard } from '../common/auth/admin.guard';
import { SmsChannel } from './identity/channels/sms.channel';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationDispatcher, PushRegistry, AdminGuard, SmsChannel],
  exports: [NotificationDispatcher],
})
export class NotificationsModule {}
