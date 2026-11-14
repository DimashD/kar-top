import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationDispatcher } from './notifications/dispatcher.service';
import { PushRegistry } from './notifications/push-provider';
import { AdminGuard } from '../common/auth/admin.guard';
import { OpeningReminders } from './notifications/opening-reminders.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationDispatcher, PushRegistry, AdminGuard, OpeningReminders],
  exports: [NotificationDispatcher, OpeningReminders],
})
export class NotificationsModule {}
