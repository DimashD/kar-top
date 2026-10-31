import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { IdentityModule } from './modules/identity.module';
import { CatalogModule } from './modules/catalog.module';

// Модульный монолит: каждый контекст — отдельный модуль (см. docs/03-architecture.md §3).
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    IdentityModule,
    CatalogModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
