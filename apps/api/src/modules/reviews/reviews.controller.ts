import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ReviewsService } from './reviews.service';
import { Public } from '../../common/auth/public.decorator';

class CreateReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

@Public()
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  // Отзыв по заказу (покупатель оставляет со страницы трекинга).
  @Post('orders/:id/review')
  create(@Param('id') id: string, @Body() dto: CreateReviewDto) {
    return this.reviews.create(id, dto.rating, dto.comment);
  }

  // Публичные отзывы магазина.
  @Get('shops/:slug/reviews')
  forStore(@Param('slug') slug: string, @Query('limit') limit?: string) {
    return this.reviews.forStore(slug, limit ? Number(limit) : 20);
  }
}
