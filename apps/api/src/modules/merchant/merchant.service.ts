import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreAccess } from '../../common/auth/store-access.service';
import { AddProductDto, UpdateProductDto, StoreSettingsDto, StorePhotoDto, ZonesDto, AddMemberDto, UpdateMemberDto } from './dto';
import { LngLat, haversineMeters } from '../../common/geo';
import { circlePolygon, ZoneShape } from '../../common/zones';
import { hoursOf, parseHours, WeekHours } from '../../common/hours';

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

  /** Настройки магазина (самовывоз, лид-тайм, режим доставки) — для приложения магазина. */
  async getSettings(storeId: string, userId: string) {
    await this.access.assertMember(storeId, userId);
    const s = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, name: true, deliveryMode: true, deliveryEnabled: true, pickupEnabled: true, pickupLeadMinutes: true, courierHandoverMinutes: true, ownDeliveryMinutes: true, slug: true, photoAt: true, hours: true },
    });
    if (!s) throw new NotFoundException('Магазин не найден');
    const { photoAt, hours, ...rest } = s;
    return { ...rest, hours: hoursOf(hours), photoVersion: photoAt ? photoAt.getTime() : null };
  }

  /** Фото магазина: JPEG/PNG/WebP в base64, до 2 МБ. null — убрать фото. Только OWNER/MANAGER. */
  async setPhoto(storeId: string, userId: string, dto: StorePhotoDto) {
    await this.access.assertMember(storeId, userId, CATALOG_ROLES);
    let photo: Buffer | null = null;
    if (dto.data) {
      photo = Buffer.from(dto.data, 'base64');
      if (photo.length > 2 * 1024 * 1024) throw new BadRequestException('Фото больше 2 МБ');
    }
    const s = await this.prisma.store.update({
      where: { id: storeId },
      data: { photo, photoType: photo ? dto.type ?? 'image/jpeg' : null, photoAt: photo ? new Date() : null },
      select: { photoAt: true },
    });
    return { photoVersion: s.photoAt ? s.photoAt.getTime() : null };
  }

  /** Изменить настройки доставки/самовывоза. Только OWNER/MANAGER. */
  async updateSettings(storeId: string, userId: string, dto: StoreSettingsDto) {
    await this.access.assertMember(storeId, userId, CATALOG_ROLES);
    // Хотя бы один способ получения должен остаться — иначе магазин не сможет принимать заказы.
    if (dto.pickupEnabled === false || dto.deliveryEnabled === false) {
      const cur = await this.prisma.store.findUnique({ where: { id: storeId }, select: { pickupEnabled: true, deliveryEnabled: true } });
      const pickup = dto.pickupEnabled ?? cur?.pickupEnabled;
      const delivery = dto.deliveryEnabled ?? cur?.deliveryEnabled;
      if (!pickup && !delivery) throw new BadRequestException('Оставьте включённым хотя бы один способ: доставку или самовывоз');
    }
    let hours: WeekHours | undefined;
    if (dto.hours !== undefined) {
      try { hours = parseHours(dto.hours); } catch (e) { throw new BadRequestException((e as Error).message); }
    }
    await this.prisma.store.update({
      where: { id: storeId },
      data: {
        ...(hours ? { hours } : {}),
        ...(dto.pickupEnabled != null ? { pickupEnabled: dto.pickupEnabled } : {}),
        ...(dto.deliveryEnabled != null ? { deliveryEnabled: dto.deliveryEnabled } : {}),
        ...(dto.pickupLeadMinutes != null ? { pickupLeadMinutes: dto.pickupLeadMinutes } : {}),
        ...(dto.deliveryMode != null ? { deliveryMode: dto.deliveryMode } : {}),
        ...(dto.courierHandoverMinutes != null ? { courierHandoverMinutes: dto.courierHandoverMinutes } : {}),
        ...(dto.ownDeliveryMinutes != null ? { ownDeliveryMinutes: dto.ownDeliveryMinutes } : {}),
      },
    });
    // Тот же ответ, что и при чтении (с фото и часами) — приложение заменяет им свои настройки.
    return this.getSettings(storeId, userId);
  }

  /** Точка магазина и зоны доставки — для экрана «Зона доставки». */
  async getZones(storeId: string, userId: string) {
    await this.access.assertMember(storeId, userId);
    const s = await this.prisma.store.findUnique({ where: { id: storeId }, select: { geom: true, zones: true } });
    if (!s) throw new NotFoundException('Магазин не найден');
    const c = (s.geom as any)?.coordinates as [number, number] | undefined;
    return {
      location: c ? { lat: c[1], lng: c[0] } : null,
      zones: s.zones.map((z) => {
        const shape = z.polygon as unknown as ZoneShape;
        return {
          id: z.id,
          kind: shape.kind ?? 'polygon',
          radiusM: shape.radiusM ?? null,
          // Старые зоны (сид) хранили кольцо в rings, новые — в coordinates (GeoJSON).
          points: shape.kind === 'radius' ? [] : ((shape.coordinates ?? (shape as any).rings)?.[0] ?? []).slice(0, -1).map(([lng, lat]: [number, number]) => [lat, lng]),
          feeTiyn: z.feeTiyn,
          minOrderTiyn: z.minOrderTiyn,
          freeFromTiyn: z.freeFromTiyn,
        };
      }),
    };
  }

  /** Сохранить точку магазина и зоны (заменяет все зоны). Только OWNER/MANAGER. */
  async saveZones(storeId: string, userId: string, dto: ZonesDto) {
    await this.access.assertMember(storeId, userId, CATALOG_ROLES);
    const center: LngLat = [dto.lng, dto.lat];
    const shapes: ZoneShape[] = dto.zones.map((z) => {
      if (z.kind === 'radius') {
        if (!z.radiusM) throw new BadRequestException('Укажите радиус зоны');
        return { type: 'Polygon', kind: 'radius', radiusM: z.radiusM, coordinates: [circlePolygon(center, z.radiusM)] };
      }
      const pts = (z.points ?? []).filter((p) => Array.isArray(p) && p.length === 2);
      if (pts.length < 3 || pts.length > 200) throw new BadRequestException('Обведите зону минимум по трём точкам');
      // Защита от опечаток: все точки — не дальше 30 км от магазина.
      if (pts.some(([lat, lng]) => haversineMeters(center, [lng, lat]) > 30_000)) {
        throw new BadRequestException('Зона доставки не может быть дальше 30 км от магазина');
      }
      const ring: LngLat[] = pts.map(([lat, lng]) => [lng, lat]);
      ring.push(ring[0]);
      return { type: 'Polygon', kind: 'polygon', coordinates: [ring] };
    });
    await this.prisma.$transaction([
      this.prisma.store.update({ where: { id: storeId }, data: { geom: { type: 'Point', coordinates: center } } }),
      this.prisma.deliveryZone.deleteMany({ where: { storeId } }),
      ...shapes.map((polygon, i) =>
        this.prisma.deliveryZone.create({
          data: {
            storeId,
            polygon: polygon as any,
            feeTiyn: dto.zones[i].feeTiyn,
            minOrderTiyn: dto.zones[i].minOrderTiyn,
            freeFromTiyn: dto.zones[i].freeFromTiyn ?? null,
          },
        }),
      ),
    ]);
    return this.getZones(storeId, userId);
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
        master: { select: { id: true, name: true, unit: true, category: { select: { id: true, name: true, sort: true, parent: { select: { id: true, name: true, sort: true } } } } } },
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

  /** Заявка магазина на новую категорию/товар в мастер-каталог (админ одобряет). */
  async submitCatalogRequest(storeId: string, userId: string, dto: {
    type: 'CATEGORY' | 'PRODUCT'; name: string; categoryId?: string; categoryName?: string; unit?: string; note?: string;
  }) {
    await this.access.assertMember(storeId, userId, CATALOG_ROLES);
    const name = (dto.name || '').trim();
    if (name.length < 2) throw new BadRequestException('Укажите название');
    if (dto.type !== 'CATEGORY' && dto.type !== 'PRODUCT') throw new BadRequestException('Неверный тип заявки');
    const req = await this.prisma.catalogRequest.create({
      data: {
        storeId, requestedBy: userId, type: dto.type, name,
        categoryId: dto.categoryId || null,
        categoryName: dto.categoryName?.trim() || null,
        unit: (dto.type === 'PRODUCT' && dto.unit ? dto.unit : null) as any,
        note: dto.note?.trim() || null,
      },
      select: { id: true, status: true, createdAt: true },
    });
    return req;
  }

  /** Заявки магазина (чтобы видеть статус). */
  async myCatalogRequests(storeId: string, userId: string) {
    await this.access.assertMember(storeId, userId);
    return this.prisma.catalogRequest.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, type: true, name: true, categoryName: true, unit: true, status: true, note: true, createdAt: true },
    });
  }

  // --- Сотрудники магазина ---

  /** Список сотрудников. Видят владелец и менеджер. */
  async members(storeId: string, userId: string) {
    await this.access.assertMember(storeId, userId, CATALOG_ROLES);
    const rows = await this.prisma.storeMember.findMany({
      where: { storeId },
      select: { role: true, user: { select: { id: true, phone: true, name: true, passwordHash: true } } },
    });
    const order: Record<string, number> = { OWNER: 0, MANAGER: 1, PICKER: 2, COURIER: 3 };
    return rows
      .map((m) => ({
        userId: m.user.id, phone: m.user.phone, name: m.user.name, role: m.role,
        // Входил ли уже (придумал пароль) — чтобы владелец видел, что доступ работает.
        active: !!m.user.passwordHash, you: m.user.id === userId,
      }))
      .sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9));
  }

  /** Выдать доступ по номеру телефона. Только владелец. */
  async addMember(storeId: string, userId: string, dto: AddMemberDto) {
    await this.access.assertMember(storeId, userId, [Role.OWNER]);
    const d = (dto.phone || '').replace(/\D/g, '');
    const phone = '+' + (d.startsWith('8') && d.length === 11 ? '7' + d.slice(1) : d);
    if (!/^\+77\d{9}$/.test(phone)) throw new BadRequestException('Неверный номер: нужен казахстанский +7 7XX XXX XX XX');
    const name = dto.name?.trim() || undefined;
    const user = await this.prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone, name },
    });
    const existing = await this.prisma.storeMember.findUnique({ where: { storeId_userId: { storeId, userId: user.id } } });
    if (existing?.role === Role.OWNER) throw new BadRequestException('Это владелец магазина');
    if (name && !user.name) await this.prisma.user.update({ where: { id: user.id }, data: { name } });
    await this.prisma.storeMember.upsert({
      where: { storeId_userId: { storeId, userId: user.id } },
      update: { role: dto.role as Role },
      create: { storeId, userId: user.id, role: dto.role as Role },
    });
    return this.members(storeId, userId);
  }

  /** Сменить роль сотрудника. Только владелец; владельца не меняем. */
  async updateMember(storeId: string, userId: string, memberId: string, dto: UpdateMemberDto) {
    await this.access.assertMember(storeId, userId, [Role.OWNER]);
    const m = await this.prisma.storeMember.findUnique({ where: { storeId_userId: { storeId, userId: memberId } } });
    if (!m) throw new NotFoundException('Сотрудник не найден');
    if (m.role === Role.OWNER) throw new ForbiddenException('Роль владельца не меняется');
    await this.prisma.storeMember.update({ where: { storeId_userId: { storeId, userId: memberId } }, data: { role: dto.role as Role } });
    return this.members(storeId, userId);
  }

  /** Забрать доступ. Только владелец; себя и владельца удалить нельзя. */
  async removeMember(storeId: string, userId: string, memberId: string) {
    await this.access.assertMember(storeId, userId, [Role.OWNER]);
    const m = await this.prisma.storeMember.findUnique({ where: { storeId_userId: { storeId, userId: memberId } } });
    if (!m) throw new NotFoundException('Сотрудник не найден');
    if (m.role === Role.OWNER) throw new ForbiddenException('Владельца удалить нельзя');
    await this.prisma.storeMember.delete({ where: { storeId_userId: { storeId, userId: memberId } } });
    // Пуши этого магазина ему больше не нужны — токены держатся за пользователя, а заказы рассылаются по членству.
    return this.members(storeId, userId);
  }
}
