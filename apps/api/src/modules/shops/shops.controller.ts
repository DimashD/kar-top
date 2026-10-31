import { Controller, Get, Param, Query, BadRequestException } from '@nestjs/common';
import { ShopsService } from './shops.service';

@Controller('shops')
export class ShopsController {
  constructor(private readonly shops: ShopsService) {}

  @Get(':slug/catalog')
  catalog(@Param('slug') slug: string) {
    return this.shops.catalog(slug);
  }

  @Get(':slug/zone-check')
  zoneCheck(@Param('slug') slug: string, @Query('lat') lat?: string, @Query('lng') lng?: string) {
    const latN = Number(lat);
    const lngN = Number(lng);
    if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
      throw new BadRequestException('lat и lng обязательны и должны быть числами');
    }
    return this.shops.zoneCheck(slug, latN, lngN);
  }
}
