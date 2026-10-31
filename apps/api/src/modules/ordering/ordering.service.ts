import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Unit, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto';
import { piiVisibleToMerchant, canTransition } from './order-state';

@Injectable()
export class OrderingService {
  constructor(private readonly prisma: PrismaService) {}

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
        address: dto.address ? (dto.address as object) : undefined,
        payMethod: dto.payMethod,
        subtotalTiyn: subtotal,
        items: { create: itemsData },
        events: { create: { to: 'PLACED', actor: 'customer' } },
      },
      select: { id: true, number: true, status: true, subtotalTiyn: true },
    });

    return { ...order, estimatedTiyn: subtotal, note: 'Оплата при получении. Точная сумма — после взвешивания.' };
  }

  /** Представление заказа для магазина: ПДн клиента скрыты до ACCEPTED (на уровне сервера). */
  async forMerchant(orderId: string) {
    const o = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, items: true },
    });
    if (!o) throw new NotFoundException('Заказ не найден');

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

  /** Идемпотентный переход статуса с записью события. Повтор того же статуса — no-op. */
  async transition(orderId: string, to: OrderStatus, actor: string) {
    const o = await this.prisma.order.findUnique({ where: { id: orderId }, select: { id: true, status: true } });
    if (!o) throw new NotFoundException('Заказ не найден');
    if (o.status === to) return { id: o.id, status: to, changed: false };
    if (!canTransition(o.status, to)) {
      throw new BadRequestException(`Недопустимый переход ${o.status} → ${to}`);
    }
    await this.prisma.$transaction([
      this.prisma.order.update({ where: { id: orderId }, data: { status: to } }),
      this.prisma.orderEvent.create({ data: { orderId, from: o.status, to, actor } }),
    ]);
    // TODO: событие в outbox → пуш покупателю/магазину.
    return { id: orderId, status: to, changed: true };
  }

  accept(id: string) { return this.transition(id, 'ACCEPTED', 'merchant'); }
  startPicking(id: string) { return this.transition(id, 'PICKING', 'merchant'); }
  ready(id: string) { return this.transition(id, 'READY', 'merchant'); }
  delivering(id: string) { return this.transition(id, 'DELIVERING', 'courier'); }
  delivered(id: string) { return this.transition(id, 'DELIVERED', 'courier'); }
  cancel(id: string, actor = 'merchant') { return this.transition(id, 'CANCELLED', actor); }

  /** Взвешивание позиции при сборке: фиксируем фактический вес и пересчитываем итог. */
  async weighItem(orderId: string, itemId: string, qtyActualG: number) {
    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId },
      select: { id: true, priceSnapTiyn: true },
    });
    if (!item) throw new NotFoundException('Позиция не найдена');
    await this.prisma.orderItem.update({ where: { id: itemId }, data: { qtyActualG, status: 'ok' } });
    return this.recalcFinal(orderId);
  }

  /** Отметить позицию отсутствующей (нет в наличии). */
  async markMissing(orderId: string, itemId: string) {
    await this.prisma.orderItem.updateMany({ where: { id: itemId, orderId }, data: { status: 'missing' } });
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
