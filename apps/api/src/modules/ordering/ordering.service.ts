import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Unit, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto';
import { piiVisibleToMerchant, canTransition } from './order-state';

@Injectable()
export class OrderingService {
  constructor(private readonly prisma: PrismaService) {}

  /** 4-значный код подтверждения получения (покупатель называет курьеру). */
  private genDeliveryCode(): string {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  /** Создание заказа. Оплата при получении (MVP). Сумма — оценочная, уточняется после взвешивания. */
  async create(dto: CreateOrderDto) {
    const store = await this.prisma.store.findFirst({
      where: { slug: dto.storeSlug, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!store) throw new NotFoundException('Магазин не найден');

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

    const user = await this.prisma.user.upsert({
      where: { phone: dto.phone },
      update: {},
      create: { phone: dto.phone },
    });

    const order = await this.prisma.order.create({
      data: {
        storeId: store.id,
        customerId: user.id,
        status: 'PLACED',
        deliveryCode: this.genDeliveryCode(),
        address: dto.address ? (dto.address as object) : undefined,
        payMethod: dto.payMethod,
        subtotalTiyn: subtotal,
        items: { create: itemsData },
        events: { create: { to: 'PLACED', actor: 'customer' } },
      },
      select: { id: true, number: true, status: true, subtotalTiyn: true, deliveryCode: true },
    });

    // Уведомление магазину о новом заказе (звук + пуш).
    await this.prisma.outboxEvent.create({
      data: { type: 'order.placed', aggregateType: 'order', aggregateId: order.id, payload: { number: order.number } },
    });

    return { ...order, estimatedTiyn: subtotal, note: 'Оплата при получении. Точная сумма — после взвешивания.' };
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

  /** Представление заказа для магазина: ПДн клиента скрыты до ACCEPTED (на уровне сервера). */
  async forMerchant(orderId: string, userId: string) {
    const o = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, items: true },
    });
    if (!o) throw new NotFoundException('Заказ не найден');
    await this.authorizeStore(o.storeId, userId);

    const base = {
      number: o.number,
      status: o.status,
      subtotalTiyn: o.subtotalTiyn,
      payMethod: o.payMethod,
      itemCount: o.items.length,
    };
    if (!piiVisibleToMerchant(o.status)) {
      // до принятия — только район/зона, без имени, телефона и точного адреса
      return { ...base, pii: null, hint: 'Данные клиента откроются после принятия заказа' };
    }
    return {
      ...base,
      pii: {
        name: o.customer?.name ?? null,
        phone: o.customer?.phone ?? null,
        address: o.address,
      },
    };
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
        subtotalTiyn: true, finalTiyn: true, payMethod: true, deliveryCode: true,
        store: { select: { name: true, slug: true } },
        events: { orderBy: { at: 'asc' }, select: { to: true, at: true } },
        items: { select: { status: true } },
      },
    });
    if (!o) throw new NotFoundException('Заказ не найден');
    const CLOSED: OrderStatus[] = ['DELIVERED', 'COMPLETED', 'CANCELLED'];
    return {
      id: o.id,
      number: o.number,
      status: o.status,
      createdAt: o.createdAt,
      store: o.store,
      payMethod: o.payMethod,
      estimatedTiyn: o.subtotalTiyn,
      finalTiyn: o.finalTiyn,
      itemCount: o.items.length,
      missingCount: o.items.filter((i) => i.status === 'missing').length,
      timeline: o.events,
      // Код скрываем после закрытия заказа — он уже сыграл свою роль.
      deliveryCode: CLOSED.includes(o.status) ? null : o.deliveryCode,
    };
  }
  cancel(id: string, userId: string) { return this.transition(id, 'CANCELLED', 'merchant', userId); }

  /** Взвешивание позиции при сборке: фиксируем фактический вес и пересчитываем итог. */
  async weighItem(orderId: string, itemId: string, qtyActualG: number, userId: string) {
    await this.authorizeStore(await this.orderStoreId(orderId), userId);
    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId },
      select: { id: true, priceSnapTiyn: true },
    });
    if (!item) throw new NotFoundException('Позиция не найдена');
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
    await this.prisma.order.update({ where: { id: orderId }, data: { finalTiyn: final } });
    return { orderId, finalTiyn: final };
  }
}
