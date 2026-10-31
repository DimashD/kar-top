import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly prisma: PrismaService) {}

  /** Дерево категорий всего зелёного базара (сид — prisma/seed.ts). */
  @Get('categories')
  categories() {
    return this.prisma.category.findMany({
      orderBy: { sort: 'asc' },
      select: { id: true, name: true, perishable: true, coldChain: true, sort: true },
    });
  }
}
