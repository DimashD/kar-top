import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreAccess } from '../../common/auth/store-access.service';
import { AddProductDto, UpdateProductDto } from './dto';

// Роли, которым разрешено управлять ассортиментом.
const CATALOG_ROLES: Role[] = [Role.OWNER, Role.MANAGER];

@Injectable()
export class MerchantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StoreAccess,
  ) {}

  /** Магазины, в которых состоит пользователь (для выбора в приложении магазина). */
  async myStores(userId: string) {
    const members = await this.prisma.storeMember.findMany({
      where: { userId },
      select: { role: true, store: { select: { id: true, slug: true, name: true, status: true } } },
    });
    return members.map((m) => ({ ...m.store, myRole: m.role }));
  }

  /** Полный ассортимент магазина (включая снятые с продажи) — только для сотрудников. */
  async catalog(storeId: string, userId: string) {
    await this.access.assertMember(storeId, userId);
    const items = await this.prisma.storeProduct.findMany({
      where: { storeId },
      select: {
        id: true,
        priceTiyn: true,
        oldPriceTiyn: true,
        inStock: true,
        master: { select: { id: true, name: true, unit: true, category: { select: { id: true, name: true } } } },
      },
      orderBy: { master: { name: 'asc' } },
    });
    return { storeId, count: items.length, items };
  }

  /** Добавить товар из мастер-каталога в ассортимент магазина. */
  async addProduct(storeId: string, userId: string, dto: AddProductDto) {
    await this.access.assertMember(storeId, userId, CATALOG_ROLES);
    const master = await this.prisma.masterProduct.findUnique({ where: { id: dto.masterProductId }, select: { id: true } });
    if (!master) throw new NotFoundException('Товар мастер-каталога не найден');
    if (dto.priceTiyn <= 0) throw new BadRequestException('Цена должна быть больше нуля');

    const existing = await this.prisma.storeProduct.findUnique({
      where: { storeId_masterProductId: { storeId, masterProductId: dto.masterProductId } },
      select: { id: true },
    });
    if (existing) throw new BadRequestException('Этот товар уже есть в ассортименте');

    return this.prisma.storeProduct.create({
      data: {
        storeId,
        masterProductId: dto.masterProductId,
        priceTiyn: dto.priceTiyn,
        oldPriceTiyn: dto.oldPriceTiyn ?? null,
        inStock: dto.inStock ?? true,
      },
      select: { id: true, priceTiyn: true, oldPriceTiyn: true, inStock: true },
    });
  }

  /** Изменить цену / наличие позиции ассортимента. */
  async updateProduct(storeId: string, spId: string, userId: string, dto: UpdateProductDto) {
    await this.access.assertMember(storeId, userId, CATALOG_ROLES);
    const sp = await this.prisma.storeProduct.findFirst({ where: { id: spId, storeId }, select: { id: true } });
    if (!sp) throw new NotFoundException('Позиция ассортимента не найдена');
    if (dto.priceTiyn != null && dto.priceTiyn <= 0) throw new BadRequestException('Цена должна быть больше нуля');

    return this.prisma.storeProduct.update({
      where: { id: spId },
      data: {
        ...(dto.priceTiyn != null ? { priceTiyn: dto.priceTiyn } : {}),
        ...(dto.oldPriceTiyn !== undefined ? { oldPriceTiyn: dto.oldPriceTiyn } : {}),
        ...(dto.inStock != null ? { inStock: dto.inStock } : {}),
      },
      select: { id: true, priceTiyn: true, oldPriceTiyn: true, inStock: true },
    });
  }

  /** Убрать товар из ассортимента. */
  async removeProduct(storeId: string, spId: string, userId: string) {
    await this.access.assertMember(storeId, userId, CATALOG_ROLES);
    const sp = await this.prisma.storeProduct.findFirst({ where: { id: spId, storeId }, select: { id: true } });
    if (!sp) throw new NotFoundException('Позиция ассортимента не найдена');
    await this.prisma.storeProduct.delete({ where: { id: spId } });
    return { removed: true };
  }
}
