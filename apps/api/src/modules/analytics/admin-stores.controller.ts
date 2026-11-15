import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { StorePhotoDto } from '../merchant/dto';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { ListingService } from '../shops/listing';
import { StoreStatus } from '@prisma/client';
import { AdminStoresService } from './admin-stores.service';
import { AdminGuard } from '../../common/auth/admin.guard';

class ListingDto {
  @IsBoolean() listed!: boolean;
  /** Бесплатный период при одобрении, дней (по умолчанию LISTING_TRIAL_DAYS = 60). */
  @IsOptional() @IsInt() @Min(1) @Max(3650) freeDays?: number;
}
class ListingPaidDto {
  @IsOptional() @IsInt() @Min(1) @Max(24) months?: number;
}
class ListingPriceDto {
  /** Цена подписки, тиыны в месяц; null — «по договорённости». */
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) priceTiyn?: number | null;
}

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
  constructor(private readonly stores: AdminStoresService, private readonly listing: ListingService) {}

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

  // «Показывать всем покупателям»: одобрить с бесплатным периодом (дней), снять, отметить оплату (+месяцы), цена подписки.
  @Post(':id/listing')
  setListed(@Param('id') id: string, @Body() dto: ListingDto) {
    return dto.listed ? this.listing.approve(id, dto.freeDays) : this.listing.remove(id);
  }

  @Post(':id/listing/paid')
  listingPaid(@Param('id') id: string, @Body() dto: ListingPaidDto) { return this.listing.markPaid(id, dto.months ?? 1); }

  @Post(':id/listing/price')
  listingPrice(@Param('id') id: string, @Body() dto: ListingPriceDto) { return this.listing.setPrice(id, dto.priceTiyn ?? null); }

  @Post(':id/approve')
  approve(@Param('id') id: string) { return this.stores.approve(id); }

  @Post(':id/suspend')
  suspend(@Param('id') id: string) { return this.stores.suspend(id); }

  @Post(':id/block')
  block(@Param('id') id: string) { return this.stores.block(id); }
}
