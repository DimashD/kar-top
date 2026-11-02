import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { IdentityModule } from './modules/identity.module';
import { CatalogModule } from './modules/catalog.module';
import { ShopsModule } from './modules/shops.module';
import { OrderingModule } from './modules/ordering.module';
import { BillingModule } from './modules/billing.module';
import { AnalyticsModule } from './modules/analytics.module';
import { MerchantModule } from './modules/merchant.module';
import { ReviewsModule } from './modules/reviews.module';
import { NotificationsModule } from './modules/notifications.module';
import { SchedulerModule } from './modules/scheduler.module';
import { PartnersModule } from './modules/partners.module';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';

// Модульный монолит: каждый контекст — отдельный модуль (см. docs/03-architecture.md §3).
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({ global: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    IdentityModule,
    CatalogModule,
    ShopsModule,
    OrderingModule,
    BillingModule,
    AnalyticsModule,
    MerchantModule,
    ReviewsModule,
    NotificationsModule,
    SchedulerModule,
    PartnersModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
