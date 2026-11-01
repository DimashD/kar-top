import { Module } from '@nestjs/common';
import { NotificationsModule } from './notifications.module';
import { BillingModule } from './billing.module';
import { SchedulerService } from './scheduler/scheduler.service';

// Фоновые задачи: диспетч outbox-пушей и ежемесячные счёта.
@Module({
  imports: [NotificationsModule, BillingModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
