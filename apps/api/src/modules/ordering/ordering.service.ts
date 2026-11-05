import { Injectable, NotFoundException, BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Unit, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto';
import { piiVisibleToMerchant, canTransition } from './order-state';
import { weightRange } from './weight-tolerance';
import { allowedPayMethods } from './payment-rules';
import { deliveryFee, findZone } from '../../common/zones';

@Injectable()
export class OrderingService {
  constructor(private readonly prisma: PrismaService) {}

  /** 4-значный код подтверждения получения (покупатель называет курьеру). */
  private genDeliveryCode(): string {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  /** Заказ от покупателя, подтвердившего номер по SMS: телефон — из его аккаунта. */
  async createForUser(dto: CreateOrderDto, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    if (!user?.phone) throw new UnauthorizedException('Подтвердите номер телефона');
    return this.create({ ...dto, phone: user.phone });
  }

  /** Создание заказа. Онлайн-оплаты нет (MVP): см. allowedPayMethods. Сумма — оценочная, уточняется после взвешивания. */
  async create(dto: CreateOrderDto) {
    const store = await this.prisma.store.findFirst({
      where: { slug: dto.storeSlug, status: 'ACTIVE' },
      select: { id: true, pickupEnabled: true, pickupLeadMinutes: true, deliveryMode: true, deliveryEnabled: true, zones: true },
    });
    if (!store) throw new NotFoundException('Магазин не найден');

    // Способ получения: доставка (по умолчанию) или самовывоз.
    const fulfillment = dto.fulfillment ?? 'DELIVERY';
    if (fulfillment === 'DELIVERY' && store.deliveryEnabled === false) {
      throw new BadRequestException('Доставка в этом магазине сейчас недоступна — выберите самовывоз');
    }
    if (!allowedPayMethods(fulfillment, store.deliveryMode ?? 'OWN').includes(dto.payMethod)) {
      throw new BadRequestException('Доставку выполняет курьерская служба — оплата только переводом Kaspi заранее');
    }
    let pickupAt: Date | null = null;
    if (fulfillment === 'PICKUP') {
      if (!store.pickupEnabled) throw new BadRequestException('Самовывоз в этом магазине недоступен');
      // Небольшой допуск (1 мин): UI считает «раньше всего» в минутах, учитываем дрейф секунд.
      const earliest = Date.now() + store.pickupLeadMinutes * 60_000 - 60_000;
      if (dto.pickupAt) {
        pickupAt = new Date(dto.pickupAt);
        if (isNaN(pickupAt.getTime())) throw new BadRequestException('Некорректное время самовывоза');
        if (pickupAt.getTime() < earliest) {
          throw new BadRequestException(`Самовывоз возможен не ранее чем через ${store.pickupLeadMinutes} мин после оформления`);
        }
      }
    }

    const ids = dto.items.map((i) => i.storeProductId);
    const sps = await this.prisma.storeProduct.findMany({
      where: { id: { in: ids }, storeId: store.id, inStock: true },
      select: { id: true, priceTiyn: true, master: { select: { unit: true } } },
    });
    const spMap = new Map(sps.map((s) => [s.id, s]));

    let subtotal = 0;
    const itemsData = dto.items.map((i) => {
      const sp = spMap.get(i.storeProductId);
      if (!sp) throw new BadRequestException(`Товар ${i.storeProductId} недоступен`);
      const weighted = sp.master.unit === Unit.KG || sp.master.unit === Unit.G;
      let lineTiyn: number;
      if (weighted) {
        if (!i.qtyG) throw new BadRequestException('Для весового товара нужен qtyG (граммы)');
        lineTiyn = Math.round((sp.priceTiyn * i.qtyG) / 1000); // цена за кг
      } else {
        if (!i.qty) throw new BadRequestException('Для штучного товара нужен qty');
        lineTiyn = sp.priceTiyn * i.qty;
      }
      subtotal += lineTiyn;
      return {
        storeProductId: i.storeProductId,
        qtyRequestedG: weighted ? i.qtyG ?? null : null,
        qtyRequested: weighted ? null : i.qty ?? null,
        priceSnapTiyn: sp.priceTiyn,
      };
    });

    // Доставка: если магазин задал зоны — точка обязательна, должна попасть в зону, сумма — не ниже минимальной.
    let deliveryFeeTiyn = 0;
    if (fulfillment === 'DELIVERY' && store.zones?.length) {
      const lat = dto.address?.lat;
      const lng = dto.address?.lng;
      if (lat == null || lng == null) throw new BadRequestException('Укажите точку доставки на карте');
      const zone = findZone(store.zones, [lng, lat]);
      if (!zone) throw new BadRequestException('Магазин не доставляет по этому адресу — выберите самовывоз');
      if (subtotal < zone.minOrderTiyn) {
        throw new BadRequestException(`Минимальная сумма заказа с доставкой — ${Math.round(zone.minOrderTiyn / 100)} ₸`);
      }
      deliveryFeeTiyn = deliveryFee(zone, subtotal);
    }

    // Email НЕ привязываем здесь: спаривание требует подтверждения владения (см. auth/email/*).
    const user = await this.prisma.user.upsert({
      where: { phone: dto.phone! },
      update: {},
      create: { phone: dto.phone! },
    });

    const order = await this.prisma.order.create({
      data: {
        storeId: store.id,
        customerId: user.id,
        status: 'PLACED',
        deliveryCode: this.genDeliveryCode(),
        fulfillment,
        pickupAt,
        address: fulfillment === 'DELIVERY' && dto.address ? (dto.address as object) : undefined,
        payMethod: dto.payMethod,
        subtotalTiyn: subtotal,
        deliveryFeeTiyn,
        items: { create: itemsData },
        events: { create: { to: 'PLACED', actor: 'customer' } },
      },
      select: { id: true, number: true, status: true, subtotalTiyn: true, deliveryCode: true, fulfillment: true, pickupAt: true },
    });

    const trackUrl = `${(process.env.WEB_BASE_URL || 'https://kartop.kz').replace(/\/$/, '')}/order/${order.id}`;
    await this.prisma.$transaction([
      // Магазину — новый заказ (звук + пуш).
      this.prisma.outboxEvent.create({
        data: { type: 'order.placed', aggregateType: 'order', aggregateId: order.id, payload: { number: order.number, fulfillment } },
      }),
      // Покупателю — подтверждение со ссылкой-трекингом и кодом получения.
      this.prisma.outboxEvent.create({
        data: { type: 'order.placed_customer', aggregateType: 'order', aggregateId: order.id, payload: { number: order.number, code: order.deliveryCode, trackUrl } },
      }),
    ]);

    return { ...order, estimatedTiyn: subtotal + deliveryFeeTiyn, deliveryFeeTiyn, trackUrl, note: 'Оплата при получении. Точная сумма — после взвешивания.' };
  }

  /** Проверка, что пользователь — сотрудник магазина заказа (защита от IDOR). */
  private async authorizeStore(storeId: string, userId: string) {
    const member = await this.prisma.storeMember.findUnique({
      where: { storeId_userId: { storeId, userId } },
      select: { role: true },
    });
    if (!member) throw new ForbiddenException('Нет доступа к этому магазину');
    return member.role;
  }

  private async orderStoreId(orderId: string): Promise<string> {
    const o = await this.prisma.order.findUnique({ where: { id: orderId }, select: { storeId: true } });
    if (!o) throw new NotFoundException('Заказ не найден');
    return o.storeId;
  }

  /** Список заказов магазина (для приложения магазина). ПДн не раскрываются в списке. */
  async listForStore(storeId: string, userId: string, status?: OrderStatus, limit = 100) {
    await this.authorizeStore(storeId, userId);
    const orders = await this.prisma.order.findMany({
      where: { storeId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, number: true, status: true, createdAt: true,
        subtotalTiyn: true, finalTiyn: true, payMethod: true, fulfillment: true, pickupAt: true,
        _count: { select: { items: true } },
      },
    });
    return orders.map((o) => ({
      id: o.id, number: o.number, status: o.status, createdAt: o.createdAt,
      amountTiyn: o.finalTiyn ?? o.subtotalTiyn, payMethod: o.payMethod,
      fulfillment: o.fulfillment, pickupAt: o.pickupAt, itemCount: o._count.items,
    }));
  }

  /** Названия товаров позиций заказа (OrderItem хранит storeProductId без relation). */
  private async itemsWithNames(items: { id: string; storeProductId: string; qtyRequestedG: number | null; qtyRequested: number | null; qtyActualG: number | null; priceSnapTiyn: number; status: string }[]) {
    const sps = await this.prisma.storeProduct.findMany({
      where: { id: { in: items.map((i) => i.storeProductId) } },
      select: { id: true, master: { select: { name: true, unit: true } } },
    });
    const m = new Map(sps.map((s) => [s.id, s.master]));
    return items.map((i) => ({
      id: i.id,
      name: (m.get(i.storeProductId)?.name as any)?.ru ?? 'Товар',
      names: (m.get(i.storeProductId)?.name as Record<string, string> | undefined) ?? { ru: 'Товар' },
      unit: m.get(i.storeProductId)?.unit ?? 'PCS',
      qtyRequestedG: i.qtyRequestedG,
      qtyRequested: i.qtyRequested,
      qtyActualG: i.qtyActualG,
      priceSnapTiyn: i.priceSnapTiyn,
      status: i.status,
    }));
  }

  /** Представление заказа для магазина: ПДн клиента скрыты до ACCEPTED (на уровне сервера). */
  async forMerchant(orderId: string, userId: string) {
    const o = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, items: true },
    });
    if (!o) throw new NotFoundException('Заказ не найден');
    await this.authorizeStore(o.storeId, userId);

    const addr = (o.address as Record<string, any> | null) ?? null;
    const base = {
      id: o.id,
      number: o.number,
      status: o.status,
      subtotalTiyn: o.subtotalTiyn,
      finalTiyn: o.finalTiyn,
      payMethod: o.payMethod,
      fulfillment: o.fulfillment,
      pickupAt: o.pickupAt,
      itemCount: o.items.length,
      items: await this.itemsWithNames(o.items), // позиции — не ПДн, нужны для сборки
      district: addr?.district ?? null, // район — грубая зона, можно до принятия
    };
    if (!piiVisibleToMerchant(o.status)) {
      // До принятия: состав + приблизительная зона на карте (огрублённая точка),
      // без имени, телефона и точного адреса.
      return {
        ...base,
        pii: null,
        approxLocation: this.coarseLocation(addr),
        hint: 'Точный адрес и контакты откроются после принятия заказа',
      };
    }
    return {
      ...base,
      pii: {
        name: o.customer?.name ?? null,
        phone: o.customer?.phone ?? null,
        address: o.address,
      },
      location: addr?.lat != null && addr?.lng != null ? { lat: addr.lat, lng: addr.lng } : null,
    };
  }

  /** Огрубление координат до ~1 км (2 знака) — чтобы показать зону, но не точку. */
  private coarseLocation(addr: Record<string, any> | null): { lat: number; lng: number } | null {
    if (!addr || addr.lat == null || addr.lng == null) return null;
    return { lat: Math.round(addr.lat * 100) / 100, lng: Math.round(addr.lng * 100) / 100 };
  }

  // Статус заказа → тип уведомления (outbox). Нет записи — пуш не шлём.
  private static readonly STATUS_EVENT: Partial<Record<OrderStatus, string>> = {
    ACCEPTED: 'order.accepted',
    READY: 'order.ready',
    DELIVERING: 'order.delivering',
    DELIVERED: 'order.delivered',
    CANCELLED: 'order.cancelled',
  };

  /** Идемпотентный переход статуса с записью события и outbox-уведомления (в одной транзакции). */
  async transition(orderId: string, to: OrderStatus, actor: string, userId: string) {
    const o = await this.prisma.order.findUnique({ where: { id: orderId }, select: { id: true, status: true, storeId: true, number: true } });
    if (!o) throw new NotFoundException('Заказ не найден');
    await this.authorizeStore(o.storeId, userId);
    if (o.status === to) return { id: o.id, status: to, changed: false };
    if (!canTransition(o.status, to)) {
      throw new BadRequestException(`Недопустимый переход ${o.status} → ${to}`);
    }
    const ops: any[] = [
      this.prisma.order.update({ where: { id: orderId }, data: { status: to } }),
      this.prisma.orderEvent.create({ data: { orderId, from: o.status, to, actor } }),
    ];
    const evType = OrderingService.STATUS_EVENT[to];
    if (evType) {
      ops.push(this.prisma.outboxEvent.create({
        data: { type: evType, aggregateType: 'order', aggregateId: orderId, payload: { number: o.number } },
      }));
    }
    await this.prisma.$transaction(ops);
    return { id: orderId, status: to, changed: true };
  }

  accept(id: string, userId: string) { return this.transition(id, 'ACCEPTED', 'merchant', userId); }
  startPicking(id: string, userId: string) { return this.transition(id, 'PICKING', 'merchant', userId); }
  ready(id: string, userId: string) { return this.transition(id, 'READY', 'merchant', userId); }
  delivering(id: string, userId: string) { return this.transition(id, 'DELIVERING', 'courier', userId); }

  /**
   * Подтверждение получения: курьер вводит код, который покупатель называет при передаче.
   * Неверный код — заказ не закрывается (страховка от «якобы доставлено»).
   */
  async delivered(id: string, userId: string, code: string) {
    const o = await this.prisma.order.findUnique({ where: { id }, select: { storeId: true, deliveryCode: true } });
    if (!o) throw new NotFoundException('Заказ не найден');
    await this.authorizeStore(o.storeId, userId);
    const given = (code ?? '').trim();
    if (!o.deliveryCode || given !== o.deliveryCode) {
      throw new BadRequestException('Неверный код подтверждения получения');
    }
    return this.transition(id, 'DELIVERED', 'courier', userId);
  }

  /** Публичный трекинг заказа покупателем по id (без ПДн магазина). Код получения виден владельцу. */
  async track(orderId: string) {
    const o = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true, number: true, status: true, createdAt: true,
        subtotalTiyn: true, deliveryFeeTiyn: true, finalTiyn: true, payMethod: true, deliveryCode: true,
        fulfillment: true, pickupAt: true,
        store: { select: { name: true, slug: true, address: true, kaspiPhone: true } },
        events: { orderBy: { at: 'asc' }, select: { to: true, at: true } },
        items: { select: { id: true, storeProductId: true, qtyRequestedG: true, qtyRequested: true, qtyActualG: true, priceSnapTiyn: true, status: true } },
        review: { select: { rating: true, comment: true } },
      },
    });
    if (!o) throw new NotFoundException('Заказ не найден');
    const CLOSED: OrderStatus[] = ['DELIVERED', 'COMPLETED', 'CANCELLED'];
    // Состав для покупателя: что заказал, что взвесили, что убрали — чтобы было видно, откуда изменилась сумма.
    const items = (await this.itemsWithNames(o.items)).map((i) => {
      const weighted = i.qtyRequestedG != null;
      const orderedTiyn = weighted ? Math.round((i.priceSnapTiyn * (i.qtyRequestedG ?? 0)) / 1000) : i.priceSnapTiyn * (i.qtyRequested ?? 1);
      const actualTiyn = i.status === 'missing' ? 0
        : weighted && i.qtyActualG != null ? Math.round((i.priceSnapTiyn * i.qtyActualG) / 1000) : orderedTiyn;
      return {
        id: i.id, names: i.names, unit: i.unit, status: i.status,
        qtyRequestedG: i.qtyRequestedG, qtyRequested: i.qtyRequested, qtyActualG: i.qtyActualG,
        priceTiyn: i.priceSnapTiyn, orderedTiyn, actualTiyn,
      };
    });
    return {
      id: o.id,
      number: o.number,
      status: o.status,
      createdAt: o.createdAt,
      // Номер Kaspi магазина показываем только тем, кто платит переводом, и пока заказ не закрыт.
      store: {
        name: o.store.name, slug: o.store.slug, address: o.store.address,
        kaspiPhone: o.payMethod === 'KASPI_TRANSFER' && !CLOSED.includes(o.status) ? o.store.kaspiPhone : null,
      },
      payMethod: o.payMethod,
      fulfillment: o.fulfillment,
      pickupAt: o.pickupAt,
      estimatedTiyn: o.subtotalTiyn + o.deliveryFeeTiyn,
      deliveryFeeTiyn: o.deliveryFeeTiyn,
      finalTiyn: o.finalTiyn,
      itemCount: o.items.length,
      missingCount: o.items.filter((i) => i.status === 'missing').length,
      items,
      timeline: o.events,
      // Код скрываем после закрытия заказа — он уже сыграл свою роль.
      deliveryCode: CLOSED.includes(o.status) ? null : o.deliveryCode,
      // Оценку можно оставить после выдачи/доставки и только один раз.
      canReview: ['DELIVERED', 'COMPLETED'].includes(o.status) && !o.review,
      review: o.review,
    };
  }
  cancel(id: string, userId: string) { return this.transition(id, 'CANCELLED', 'merchant', userId); }
  /** Сборка на паузе: магазин ждёт ответа покупателя (например, вес вне допуска). Возврат — startPicking. */
  awaitCustomer(id: string, userId: string) { return this.transition(id, 'AWAITING_CUSTOMER', 'merchant', userId); }

  /**
   * Взвешивание позиции при сборке: фиксируем фактический вес и пересчитываем итог.
   * Вес вне допуска (weightRange) принимается только с customerApproved — магазин согласовал с покупателем;
   * такое отклонение пишется в outbox (order.weight_override) для разбора.
   */
  async weighItem(orderId: string, itemId: string, qtyActualG: number, userId: string, customerApproved = false) {
    await this.authorizeStore(await this.orderStoreId(orderId), userId);
    if (!Number.isInteger(qtyActualG) || qtyActualG <= 0) throw new BadRequestException('Укажите вес в граммах');
    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId },
      select: { id: true, priceSnapTiyn: true, qtyRequestedG: true },
    });
    if (!item) throw new NotFoundException('Позиция не найдена');
    if (item.qtyRequestedG != null) {
      const { minG, maxG } = weightRange(item.qtyRequestedG);
      const outside = qtyActualG < minG || qtyActualG > maxG;
      if (outside && !customerApproved) {
        throw new BadRequestException({
          message: `Вес вне допуска: от ${minG} до ${maxG} г. Согласуйте с покупателем или отметьте «нет в наличии».`,
          code: 'WEIGHT_OUT_OF_RANGE',
          minG,
          maxG,
        });
      }
      if (outside) {
        await this.prisma.outboxEvent.create({
          data: {
            type: 'order.weight_override', aggregateType: 'order', aggregateId: orderId,
            payload: { itemId, requestedG: item.qtyRequestedG, actualG: qtyActualG, userId },
          },
        });
      }
    }
    await this.prisma.orderItem.update({ where: { id: itemId }, data: { qtyActualG, status: 'ok' } });
    return this.recalcFinal(orderId);
  }

  /** Отметить позицию отсутствующей (нет в наличии). */
  async markMissing(orderId: string, itemId: string, userId: string) {
    await this.authorizeStore(await this.orderStoreId(orderId), userId);
    await this.prisma.orderItem.updateMany({ where: { id: itemId, orderId }, data: { status: 'missing' } });
    const ord = await this.prisma.order.findUnique({ where: { id: orderId }, select: { number: true } });
    await this.prisma.outboxEvent.create({
      data: { type: 'order.substitution_needed', aggregateType: 'order', aggregateId: orderId, payload: { number: ord?.number } },
    });
    return this.recalcFinal(orderId);
  }

  /** Вернуть позицию в заказ (отметили «нет в наличии» по ошибке). */
  async restoreItem(orderId: string, itemId: string, userId: string) {
    await this.authorizeStore(await this.orderStoreId(orderId), userId);
    await this.prisma.orderItem.updateMany({ where: { id: itemId, orderId, status: 'missing' }, data: { status: 'ok' } });
    return this.recalcFinal(orderId);
  }

  /** Пересчёт итоговой суммы по фактическим весам/статусам позиций. */
  private async recalcFinal(orderId: string) {
    const items = await this.prisma.orderItem.findMany({
      where: { orderId },
      select: { qtyActualG: true, qtyRequested: true, qtyRequestedG: true, priceSnapTiyn: true, status: true },
    });
    let final = 0;
    for (const it of items) {
      if (it.status === 'missing') continue;
      if (it.qtyActualG != null) final += Math.round((it.priceSnapTiyn * it.qtyActualG) / 1000);
      else if (it.qtyRequestedG != null) final += Math.round((it.priceSnapTiyn * it.qtyRequestedG) / 1000);
      else if (it.qtyRequested != null) final += it.priceSnapTiyn * it.qtyRequested;
    }
    const o = await this.prisma.order.findUnique({ where: { id: orderId }, select: { deliveryFeeTiyn: true } });
    final += o?.deliveryFeeTiyn ?? 0;
    await this.prisma.order.update({ where: { id: orderId }, data: { finalTiyn: final } });
    return { orderId, finalTiyn: final };
  }
}
