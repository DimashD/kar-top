import { Module } from '@nestjs/common';
import { AdminAnalyticsController } from './analytics/admin-analytics.controller';
import { AdminAnalyticsService } from './analytics/admin-analytics.service';
import { AdminGuard } from '../common/auth/admin.guard';

@Module({ controllers: [AdminAnalyticsController], providers: [AdminAnalyticsService, AdminGuard] })
export class AnalyticsModule {}
