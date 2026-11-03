import { Module } from '@nestjs/common';
import { CatalogController } from './catalog/catalog.controller';
import { AdminCatalogController } from './catalog/admin-catalog.controller';
import { AdminCatalogService } from './catalog/admin-catalog.service';
import { AdminGuard } from '../common/auth/admin.guard';

@Module({
  controllers: [CatalogController, AdminCatalogController],
  providers: [AdminCatalogService, AdminGuard],
})
export class CatalogModule {}
