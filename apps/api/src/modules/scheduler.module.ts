import { Module } from '@nestjs/common';
import { NotificationsModule } from './notifications.module';
import { BillingModule } from './billing.module';
import { ShopsModule } from './shops.module';
import { SchedulerService } from './scheduler/scheduler.service';

// Фоновые задачи: диспетч outbox-пушей и ежемесячные счёта.
@Module({
  imports: [NotificationsModule, BillingModule, ShopsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
