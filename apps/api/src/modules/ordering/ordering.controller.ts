import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { OrderingService } from './ordering.service';
import { CreateOrderDto } from './dto';
import { Public } from '../../common/auth/public.decorator';
import { CurrentUser, RequestUser } from '../../common/auth/current-user.decorator';

@Controller()
export class OrderingController {
  constructor(private readonly ordering: OrderingService) {}

  // Оформление — только после подтверждения номера по SMS: нужен access-токен покупателя,
  // номер заказа берётся из его аккаунта, а не из формы.
  @Post('orders')
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: RequestUser) {
    return this.ordering.createForUser(dto, user.userId);
  }

  // «Мои заказы» покупателя (по access-токену): свежие сверху.
  @Get('me/orders')
  myOrders(@CurrentUser() user: RequestUser) {
    return this.ordering.myOrders(user.userId);
  }

  // Публичный трекинг заказа покупателем (по id-ссылке). Показывает код получения до закрытия.
  @Public()
  @Get('orders/:id/track')
  track(@Param('id') id: string) {
    return this.ordering.track(id);
  }

  // --- Магазин (требует access-токен + членство в магазине заказа) ---
  @Get('merchant/stores/:storeId/orders')
  listForStore(@Param('storeId') storeId: string, @Query('status') status: OrderStatus | undefined, @CurrentUser() user: RequestUser) {
    return this.ordering.listForStore(storeId, user.userId, status);
  }

  @Get('merchant/orders/:id')
  forMerchant(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.ordering.forMerchant(id, user.userId);
  }

  @Post('merchant/orders/:id/accept')
  accept(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.ordering.accept(id, user.userId);
  }

  @Post('merchant/orders/:id/picking')
  picking(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.ordering.startPicking(id, user.userId);
  }

  @Post('merchant/orders/:id/ready')
  ready(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.ordering.ready(id, user.userId);
  }

  @Post('merchant/orders/:id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.ordering.cancel(id, user.userId);
  }

  @Post('merchant/orders/:id/items/:itemId/weigh')
  weigh(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body('qtyActualG') qtyActualG: number,
    @Body('customerApproved') customerApproved: boolean | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    return this.ordering.weighItem(id, itemId, Number(qtyActualG), user.userId, customerApproved === true);
  }

  @Post('merchant/orders/:id/await-customer')
  awaitCustomer(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.ordering.awaitCustomer(id, user.userId);
  }

  @Post('merchant/orders/:id/items/:itemId/missing')
  missing(@Param('id') id: string, @Param('itemId') itemId: string, @CurrentUser() user: RequestUser) {
    return this.ordering.markMissing(id, itemId, user.userId);
  }

  @Post('merchant/orders/:id/items/:itemId/restore')
  restore(@Param('id') id: string, @Param('itemId') itemId: string, @CurrentUser() user: RequestUser) {
    return this.ordering.restoreItem(id, itemId, user.userId);
  }

  // --- Курьер ---
  @Post('courier/orders/:id/delivering')
  delivering(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.ordering.delivering(id, user.userId);
  }

  // Курьер вводит код, названный покупателем при передаче заказа.
  @Post('courier/orders/:id/delivered')
  delivered(@Param('id') id: string, @Body('code') code: string, @CurrentUser() user: RequestUser) {
    return this.ordering.delivered(id, user.userId, code);
  }
}
