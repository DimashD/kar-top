import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { IdentityModule } from './modules/identity.module';
import { CatalogModule } from './modules/catalog.module';

// Модульный монолит: каждый контекст — отдельный модуль (см. docs/03-architecture.md §3).
@Module({
  imports: [IdentityModule, CatalogModule],
  controllers: [HealthController],
})
export class AppModule {}
