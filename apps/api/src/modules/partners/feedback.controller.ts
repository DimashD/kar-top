import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { FeedbackKind, FeedbackStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/auth/public.decorator';
import { AdminGuard } from '../../common/auth/admin.guard';
import { StoreAccess } from '../../common/auth/store-access.service';
import { CurrentUser, RequestUser } from '../../common/auth/current-user.decorator';

const KINDS = ['IDEA', 'PROBLEM', 'COMPLAINT', 'PRAISE', 'OTHER'];

class CustomerFeedbackDto {
  @IsIn(KINDS) kind!: FeedbackKind;
  @IsString() @MinLength(3) @MaxLength(2000) text!: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(80) storeSlug?: string;
  @IsOptional() @IsString() @MaxLength(300) page?: string;
}

class MerchantFeedbackDto {
  @IsIn(KINDS) kind!: FeedbackKind;
  @IsString() @MinLength(3) @MaxLength(2000) text!: string;
  @IsString() storeId!: string;
}

class SetStatusDto {
  @IsIn(['NEW', 'IN_PROGRESS', 'DONE']) status!: FeedbackStatus;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

/** Отзывы о работе сервиса. Покупатель пишет без входа (номер — по желанию), магазин — из своего приложения. */
@Controller()
export class FeedbackController {
  constructor(private readonly prisma: PrismaService, private readonly access: StoreAccess) {}

  @Public()
  @Post('feedback')
  async fromCustomer(@Body() dto: CustomerFeedbackDto) {
    const digits = (dto.phone ?? '').replace(/\D/g, '');
    if (digits && digits.length < 10) throw new BadRequestException('Проверьте номер телефона');
    const store = dto.storeSlug
      ? await this.prisma.store.findUnique({ where: { slug: dto.storeSlug }, select: { id: true } })
      : null;
    await this.prisma.feedback.create({
      data: {
        source: 'CUSTOMER', kind: dto.kind, text: dto.text.trim(), phone: digits ? `+${digits.replace(/^8/, '7')}` : null,
        storeId: store?.id ?? null, storeSlug: dto.storeSlug ?? null, page: dto.page ?? null,
      },
    });
    return { ok: true };
  }

  @Post('merchant/feedback')
  async fromMerchant(@Body() dto: MerchantFeedbackDto, @CurrentUser() user: RequestUser) {
    await this.access.assertMember(dto.storeId, user.userId);
    const [store, u] = await Promise.all([
      this.prisma.store.findUnique({ where: { id: dto.storeId }, select: { slug: true } }),
      this.prisma.user.findUnique({ where: { id: user.userId }, select: { phone: true } }),
    ]);
    await this.prisma.feedback.create({
      data: {
        source: 'MERCHANT', kind: dto.kind, text: dto.text.trim(), userId: user.userId,
        phone: u?.phone ?? null, storeId: dto.storeId, storeSlug: store?.slug ?? null,
      },
    });
    return { ok: true };
  }

  // --- Платформа (админка) ---
  @UseGuards(AdminGuard)
  @Get('admin/feedback')
  list(@Query('status') status?: string, @Query('source') source?: string) {
    const where: Prisma.FeedbackWhereInput = {};
    if (status && ['NEW', 'IN_PROGRESS', 'DONE'].includes(status)) where.status = status as FeedbackStatus;
    if (source === 'CUSTOMER' || source === 'MERCHANT') where.source = source;
    return this.prisma.feedback.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  @UseGuards(AdminGuard)
  @Patch('admin/feedback/:id')
  setStatus(@Param('id') id: string, @Body() dto: SetStatusDto) {
    return this.prisma.feedback.update({ where: { id }, data: { status: dto.status, ...(dto.note !== undefined ? { note: dto.note } : {}) } });
  }
}
