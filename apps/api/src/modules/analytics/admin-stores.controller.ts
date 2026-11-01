import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { StoreStatus } from '@prisma/client';
import { AdminStoresService } from './admin-stores.service';
import { AdminGuard } from '../../common/auth/admin.guard';

// Модерация магазинов. JwtAuthGuard глобально + роль платформы.
@UseGuards(AdminGuard)
@Controller('admin/stores')
export class AdminStoresController {
  constructor(private readonly stores: AdminStoresService) {}

  /** Список магазинов (?status=PENDING|ACTIVE|SUSPENDED|BLOCKED). */
  @Get()
  list(@Query('status') status?: StoreStatus, @Query('limit') limit?: string) {
    return this.stores.list(status, limit ? Number(limit) : 100);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string) { return this.stores.approve(id); }

  @Post(':id/suspend')
  suspend(@Param('id') id: string) { return this.stores.suspend(id); }

  @Post(':id/block')
  block(@Param('id') id: string) { return this.stores.block(id); }
}
