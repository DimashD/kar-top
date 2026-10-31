import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Unit } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto';
import { piiVisibleToMerchant } from './order-state';

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
}
