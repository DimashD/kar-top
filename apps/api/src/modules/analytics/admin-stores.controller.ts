import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { StorePhotoDto } from '../merchant/dto';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { StoreStatus } from '@prisma/client';
import { AdminStoresService } from './admin-stores.service';
import { AdminGuard } from '../../common/auth/admin.guard';

class ProvisionStoreDto {
  @IsString() @MinLength(2) name!: string;
  @IsString() ownerPhone!: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() kaspiPhone?: string;
}

// Модерация и заведение магазинов. JwtAuthGuard глобально + роль платформы.
@UseGuards(AdminGuard)
@Controller('admin/stores')
export class AdminStoresController {
  constructor(private readonly stores: AdminStoresService) {}

  /** Список магазинов (?status=PENDING|ACTIVE|SUSPENDED|BLOCKED). */
  @Get()
  list(@Query('status') status?: StoreStatus, @Query('limit') limit?: string) {
    return this.stores.list(status, limit ? Number(limit) : 100);
  }

  /** Завести магазин (invite-only): создаёт магазин PENDING + владельца по телефону. */
  @Post()
  provision(@Body() dto: ProvisionStoreDto) {
    return this.stores.provision(dto);
  }

  /** Фото магазина — показывается вверху витрины. */
  @Put(':id/photo')
  setPhoto(@Param('id') id: string, @Body() dto: StorePhotoDto) { return this.stores.setPhoto(id, dto.data, dto.type); }

  @Post(':id/approve')
  approve(@Param('id') id: string) { return this.stores.approve(id); }

  @Post(':id/suspend')
  suspend(@Param('id') id: string) { return this.stores.suspend(id); }

  @Post(':id/block')
  block(@Param('id') id: string) { return this.stores.block(id); }
}
