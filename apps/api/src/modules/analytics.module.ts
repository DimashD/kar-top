import { Module } from '@nestjs/common';
import { AdminAnalyticsController } from './analytics/admin-analytics.controller';
import { AdminAnalyticsService } from './analytics/admin-analytics.service';
import { AdminStoresController } from './analytics/admin-stores.controller';
import { AdminStoresService } from './analytics/admin-stores.service';
import { AdminGuard } from '../common/auth/admin.guard';

@Module({
  controllers: [AdminAnalyticsController, AdminStoresController],
  providers: [AdminAnalyticsService, AdminStoresService, AdminGuard],
})
export class AnalyticsModule {}
