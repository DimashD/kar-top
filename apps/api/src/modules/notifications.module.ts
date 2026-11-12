import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationDispatcher } from './notifications/dispatcher.service';
import { PushRegistry } from './notifications/push-provider';
import { AdminGuard } from '../common/auth/admin.guard';
import { OpeningReminders } from './notifications/opening-reminders.service';
import { SmsChannel } from './identity/channels/sms.channel';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationDispatcher, PushRegistry, AdminGuard, SmsChannel, OpeningReminders],
  exports: [NotificationDispatcher, OpeningReminders],
})
export class NotificationsModule {}
