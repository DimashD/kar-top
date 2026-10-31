import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminGuard } from '../../common/auth/admin.guard';

// JwtAuthGuard применяется глобально; здесь дополнительно требуется роль платформы.
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminAnalyticsController {
  constructor(private readonly analytics: AdminAnalyticsService) {}

  /** Покупатели: топ по деньгам / заказам / давности последнего заказа. */
  @Get('customers')
  customers(@Query('sort') sort?: 'spend' | 'orders' | 'recent', @Query('limit') limit?: string) {
    return this.analytics.customers(sort ?? 'spend', limit ? Number(limit) : 50);
  }

  /** Аналитика по магазинам: GMV, заказы, средний чек. */
  @Get('analytics/stores')
  stores(@Query('limit') limit?: string) {
    return this.analytics.stores(limit ? Number(limit) : 100);
  }
}
