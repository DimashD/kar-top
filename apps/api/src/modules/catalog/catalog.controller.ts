import { Controller, Get, Header, Param, StreamableFile } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/auth/public.decorator';
import { ProductPhotoService } from './product-photo.service';

@Public()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly prisma: PrismaService, private readonly photos: ProductPhotoService) {}

  /** Фото товара, сгенерированное в админке (media.url с ?v=версия — поэтому кэш навсегда). */
  @Get('products/:id/photo')
  @Header('cache-control', 'public, max-age=31536000, immutable')
  async photo(@Param('id') id: string) {
    const p = await this.photos.photo(id);
    return new StreamableFile(p.data, { type: p.type });
  }

  /** Дерево категорий всего зелёного базара (сид — prisma/seed.ts). */
  @Get('categories')
  categories() {
    return this.prisma.category.findMany({
      orderBy: { sort: 'asc' },
      select: { id: true, name: true, perishable: true, coldChain: true, sort: true },
    });
  }
}
