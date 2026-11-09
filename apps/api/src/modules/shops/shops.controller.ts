import { Controller, Get, Header, Param, Query, BadRequestException, StreamableFile } from '@nestjs/common';
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
  @Header('cache-control', 'public, max-age=31536000, immutable')
  async photo(@Param('slug') slug: string) {
    const p = await this.shops.photo(slug);
    return new StreamableFile(p.data, { type: p.type });
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
