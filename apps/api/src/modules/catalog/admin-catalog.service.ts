import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { Unit } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type I18n = { ru: string; kk?: string; en?: string };

function cleanName(raw: any): I18n {
  const ru = (raw?.ru ?? '').toString().trim();
  if (ru.length < 2) throw new BadRequestException('Название (ru) обязательно');
  const out: I18n = { ru };
  if (raw?.kk?.toString().trim()) out.kk = raw.kk.toString().trim();
  if (raw?.en?.toString().trim()) out.en = raw.en.toString().trim();
  return out;
}

/** Управление мастер-каталогом платформы: категории и мастер-товары. */
@Injectable()
export class AdminCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Категории ---
  categories() {
    return this.prisma.category.findMany({
      orderBy: { sort: 'asc' },
      select: { id: true, name: true, perishable: true, coldChain: true, sort: true, _count: { select: { products: true } } },
    });
  }

  createCategory(input: { name: any; perishable?: boolean; coldChain?: boolean; sort?: number }) {
    return this.prisma.category.create({
      data: {
        name: cleanName(input.name),
        perishable: !!input.perishable,
        coldChain: !!input.coldChain,
        sort: Number.isFinite(input.sort) ? Number(input.sort) : 0,
      },
      select: { id: true, name: true, perishable: true, coldChain: true, sort: true },
    });
  }

  async updateCategory(id: string, input: { name?: any; perishable?: boolean; coldChain?: boolean; sort?: number }) {
    await this.mustCategory(id);
    return this.prisma.category.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: cleanName(input.name) } : {}),
        ...(input.perishable !== undefined ? { perishable: !!input.perishable } : {}),
        ...(input.coldChain !== undefined ? { coldChain: !!input.coldChain } : {}),
        ...(input.sort !== undefined ? { sort: Number(input.sort) } : {}),
      },
      select: { id: true, name: true, perishable: true, coldChain: true, sort: true },
    });
  }

  async deleteCategory(id: string) {
    const c = await this.prisma.category.findUnique({ where: { id }, select: { _count: { select: { products: true } } } });
    if (!c) throw new NotFoundException('Категория не найдена');
    if (c._count.products > 0) throw new ConflictException('В категории есть товары — сначала перенесите/удалите их');
    await this.prisma.category.delete({ where: { id } });
    return { ok: true };
  }

  // --- Мастер-товары ---
  products(categoryId?: string) {
    return this.prisma.masterProduct.findMany({
      where: categoryId ? { categoryId } : {},
      orderBy: { name: 'asc' },
      select: {
        id: true, categoryId: true, name: true, unit: true, stepG: true, avgPieceG: true, perishable: true, storage: true,
        _count: { select: { storeProducts: true } },
      },
    });
  }

  async createProduct(input: { categoryId: string; name: any; unit: Unit; stepG?: number; avgPieceG?: number; perishable?: boolean; storage?: string }) {
    await this.mustCategory(input.categoryId);
    if (!Object.values(Unit).includes(input.unit)) throw new BadRequestException('Неверная единица измерения');
    return this.prisma.masterProduct.create({
      data: {
        categoryId: input.categoryId,
        name: cleanName(input.name),
        unit: input.unit,
        stepG: input.stepG ? Number(input.stepG) : null,
        avgPieceG: input.avgPieceG ? Number(input.avgPieceG) : null,
        perishable: !!input.perishable,
        storage: input.storage?.trim() || null,
      },
      select: { id: true, categoryId: true, name: true, unit: true, stepG: true, avgPieceG: true, perishable: true, storage: true },
    });
  }

  async updateProduct(id: string, input: { categoryId?: string; name?: any; unit?: Unit; stepG?: number | null; avgPieceG?: number | null; perishable?: boolean; storage?: string }) {
    const exists = await this.prisma.masterProduct.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Товар не найден');
    if (input.categoryId) await this.mustCategory(input.categoryId);
    if (input.unit && !Object.values(Unit).includes(input.unit)) throw new BadRequestException('Неверная единица измерения');
    return this.prisma.masterProduct.update({
      where: { id },
      data: {
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
        ...(input.name !== undefined ? { name: cleanName(input.name) } : {}),
        ...(input.unit ? { unit: input.unit } : {}),
        ...(input.stepG !== undefined ? { stepG: input.stepG ? Number(input.stepG) : null } : {}),
        ...(input.avgPieceG !== undefined ? { avgPieceG: input.avgPieceG ? Number(input.avgPieceG) : null } : {}),
        ...(input.perishable !== undefined ? { perishable: !!input.perishable } : {}),
        ...(input.storage !== undefined ? { storage: input.storage?.trim() || null } : {}),
      },
      select: { id: true, categoryId: true, name: true, unit: true, stepG: true, avgPieceG: true, perishable: true, storage: true },
    });
  }

  async deleteProduct(id: string) {
    const p = await this.prisma.masterProduct.findUnique({ where: { id }, select: { _count: { select: { storeProducts: true } } } });
    if (!p) throw new NotFoundException('Товар не найден');
    if (p._count.storeProducts > 0) throw new ConflictException('Товар используется магазинами — удалить нельзя');
    await this.prisma.masterProduct.delete({ where: { id } });
    return { ok: true };
  }

  private async mustCategory(id: string) {
    const c = await this.prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!c) throw new NotFoundException('Категория не найдена');
  }
}
