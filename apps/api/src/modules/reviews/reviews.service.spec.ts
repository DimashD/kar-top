import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

function makePrisma(order: any, existingReview: any = null) {
  return {
    order: { findUnique: jest.fn().mockResolvedValue(order) },
    review: {
      findUnique: jest.fn().mockResolvedValue(existingReview),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'r1', rating: data.rating, comment: data.comment, createdAt: new Date() })),
      aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4.5 }, _count: { _all: 2 } }),
    },
    store: { update: jest.fn().mockResolvedValue({}) },
  };
}
const deliveredOrder = { id: 'o1', storeId: 's1', customerId: 'c1', status: 'DELIVERED' };

describe('ReviewsService.create', () => {
  it('принимает отзыв по доставленному заказу и пересчитывает рейтинг', async () => {
    const prisma = makePrisma(deliveredOrder);
    const svc = new ReviewsService(prisma as any);
    const r = await svc.create('o1', 5, '  отлично  ');
    expect(r.rating).toBe(5);
    expect(prisma.review.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ comment: 'отлично', storeId: 's1' }) }));
    expect(prisma.store.update).toHaveBeenCalledWith(expect.objectContaining({ data: { rating: 4.5, reviewCount: 2 } }));
  });

  it('отклоняет оценку вне 1..5', async () => {
    const svc = new ReviewsService(makePrisma(deliveredOrder) as any);
    await expect(svc.create('o1', 0)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.create('o1', 6)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('нельзя оценить недоставленный заказ', async () => {
    const svc = new ReviewsService(makePrisma({ ...deliveredOrder, status: 'PLACED' }) as any);
    await expect(svc.create('o1', 5)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('повторный отзыв по заказу → конфликт', async () => {
    const svc = new ReviewsService(makePrisma(deliveredOrder, { id: 'exists' }) as any);
    await expect(svc.create('o1', 4)).rejects.toBeInstanceOf(ConflictException);
  });

  it('заказ не найден → 404', async () => {
    const svc = new ReviewsService(makePrisma(null) as any);
    await expect(svc.create('nope', 5)).rejects.toBeInstanceOf(NotFoundException);
  });
});
