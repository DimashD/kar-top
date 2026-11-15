import { Controller, Get, Header, Param, Post, Query, BadRequestException, StreamableFile } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/auth/current-user.decorator';
import { ShopsService } from './shops.service';
import { Public } from '../../common/auth/public.decorator';

@Public()
@Controller('shops')
export class ShopsController {
  constructor(private readonly shops: ShopsService) {}

  /**
   * Список магазинов: «для всех» + те, что покупатель уже открывал (visited=slug1,slug2 — с его устройства
   * и из /me/stores). Без visited — только магазины «для всех».
   */
  @Get()
  list(@Query('lat') lat?: string, @Query('lng') lng?: string, @Query('visited') visited?: string) {
    const la = Number(lat), ln = Number(lng);
    return this.shops.list(lat && lng && Number.isFinite(la) && Number.isFinite(ln) ? [ln, la] : undefined, parseSlugs(visited));
  }

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

/** visited=slug1,slug2 → до 100 корректных slug. */
export function parseSlugs(raw?: string): string[] {
  return [...new Set((raw ?? '').split(',').map((x) => x.trim().toLowerCase()).filter((x) => /^[a-z0-9-]{1,64}$/.test(x)))].slice(0, 100);
}

/** Магазины покупателя (по access-токену): запомнить визит и получить свой список. */
@Controller('me/stores')
export class MyStoresController {
  constructor(private readonly shops: ShopsService) {}

  @Get()
  async mine(@CurrentUser() user: RequestUser) {
    return { slugs: await this.shops.myStores(user.userId) };
  }

  @Post(':slug/visit')
  visit(@Param('slug') slug: string, @CurrentUser() user: RequestUser) {
    return this.shops.rememberVisit(user.userId, slug);
  }
}
