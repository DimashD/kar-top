import { Controller, Get, Header, Param, Query, UseGuards } from '@nestjs/common';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminGuard } from '../../common/auth/admin.guard';

// JwtAuthGuard применяется глобально; здесь дополнительно требуется роль платформы.
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminAnalyticsController {
  constructor(private readonly analytics: AdminAnalyticsService) {}

  /** Покупатели: топ по деньгам / заказам / давности последнего заказа. */
  @Get('customers')
  customers(@Query('sort') sort?: 'spend' | 'orders' | 'recent', @Query('limit') limit?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.customers(sort ?? 'spend', limit ? Number(limit) : 50, { from, to });
  }

  /** Аналитика по магазинам: GMV, заказы, средний чек. */
  @Get('analytics/stores')
  stores(@Query('limit') limit?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.stores(limit ? Number(limit) : 100, { from, to });
  }

  /** Сводка за период: вся платформа, или storeId / customerId. С графиком по дням. */
  @Get('analytics/summary')
  summary(@Query('from') from?: string, @Query('to') to?: string, @Query('storeId') storeId?: string, @Query('customerId') customerId?: string) {
    return this.analytics.summary({ from, to }, storeId || undefined, customerId || undefined);
  }

  /** Экспорт покупателей в CSV. */
  @Get('customers.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="customers.csv"')
  customersCsv(@Query('sort') sort?: 'spend' | 'orders' | 'recent', @Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.customersCsv(sort ?? 'spend', { from, to });
  }

  /** Экспорт магазинов в CSV. */
  @Get('analytics/stores.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="stores.csv"')
  storesCsv(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.storesCsv({ from, to });
  }

  /** Провал в заказы покупателя из аналитики клиента. */
  @Get('customers/:id/orders')
  customerOrders(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.analytics.customerOrders(id, limit ? Number(limit) : 100);
  }

  /** Провал в заказы магазина из аналитики магазина. */
  @Get('stores/:id/orders')
  storeOrders(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.analytics.storeOrders(id, limit ? Number(limit) : 100);
  }

  /** Все заказы платформы (последние), фильтр по статусу. */
  @Get('orders')
  recentOrders(
    @Query('limit') limit?: string, @Query('status') status?: string,
    @Query('from') from?: string, @Query('to') to?: string,
    @Query('storeId') storeId?: string, @Query('customerId') customerId?: string,
  ) {
    return this.analytics.recentOrders(limit ? Number(limit) : 100, status, { from, to }, storeId || undefined, customerId || undefined);
  }

  /** Карточка заказа (позиции, события). */
  @Get('orders/:id')
  orderDetail(@Param('id') id: string) {
    return this.analytics.orderDetail(id);
  }
}
