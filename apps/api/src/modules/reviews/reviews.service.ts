import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const REVIEWABLE = ['DELIVERED', 'COMPLETED'];

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Оставить отзыв по заказу. Доступно после выдачи/доставки, один раз на заказ. */
  async create(orderId: string, rating: number, comment?: string) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('Оценка — целое число от 1 до 5');
    }
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, storeId: true, customerId: true, status: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (!REVIEWABLE.includes(order.status)) {
      throw new BadRequestException('Оценить можно только полученный заказ');
    }
    const exists = await this.prisma.review.findUnique({ where: { orderId }, select: { id: true } });
    if (exists) throw new ConflictException('Отзыв по этому заказу уже оставлен');

    const review = await this.prisma.review.create({
      data: { orderId, storeId: order.storeId, customerId: order.customerId, rating, comment: comment?.trim() || null },
      select: { id: true, rating: true, comment: true, createdAt: true },
    });
    await this.recalcStoreRating(order.storeId);
    return review;
  }

  /** Публичные отзывы магазина (последние). */
  async forStore(slug: string, limit = 20) {
    const store = await this.prisma.store.findUnique({
      where: { slug },
      select: { id: true, rating: true, reviewCount: true },
    });
    if (!store) throw new NotFoundException('Магазин не найден');
    const reviews = await this.prisma.review.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, rating: true, comment: true, createdAt: true },
    });
    return { rating: store.rating, reviewCount: store.reviewCount, reviews };
  }

  /** Пересчёт среднего рейтинга и количества отзывов магазина. */
  private async recalcStoreRating(storeId: string) {
    const agg = await this.prisma.review.aggregate({
      where: { storeId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await this.prisma.store.update({
      where: { id: storeId },
      data: {
        rating: Math.round((agg._avg.rating ?? 0) * 10) / 10,
        reviewCount: agg._count._all,
      },
    });
  }
}
