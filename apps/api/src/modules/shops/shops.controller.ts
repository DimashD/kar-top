import { Controller, Get, Param, Query, BadRequestException, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ShopsService } from './shops.service';
import { Public } from '../../common/auth/public.decorator';

@Public()
@Controller('shops')
export class ShopsController {
  constructor(private readonly shops: ShopsService) {}

  @Get(':slug/catalog')
  catalog(@Param('slug') slug: string) {
    return this.shops.catalog(slug);
  }

  @Get(':slug/photo')
  async photo(@Param('slug') slug: string, @Res() res: Response) {
    const p = await this.shops.photo(slug);
    res.set({ 'content-type': p.type, 'cache-control': 'public, max-age=31536000, immutable' }).send(p.data);
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
