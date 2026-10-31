import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { OrderingService } from './ordering.service';
import { CreateOrderDto } from './dto';

@Controller()
export class OrderingController {
  constructor(private readonly ordering: OrderingService) {}

  @Post('orders')
  create(@Body() dto: CreateOrderDto) {
    return this.ordering.create(dto);
  }

  // --- Магазин (TODO: защитить guard'ом роли магазина) ---
  // Представление: ПДн скрыты до принятия.
  @Get('merchant/orders/:id')
  forMerchant(@Param('id') id: string) {
    return this.ordering.forMerchant(id);
  }

  @Post('merchant/orders/:id/accept')
  accept(@Param('id') id: string) {
    return this.ordering.accept(id);
  }

  @Post('merchant/orders/:id/picking')
  picking(@Param('id') id: string) {
    return this.ordering.startPicking(id);
  }

  @Post('merchant/orders/:id/ready')
  ready(@Param('id') id: string) {
    return this.ordering.ready(id);
  }

  @Post('merchant/orders/:id/cancel')
  cancel(@Param('id') id: string) {
    return this.ordering.cancel(id);
  }

  @Post('merchant/orders/:id/items/:itemId/weigh')
  weigh(@Param('id') id: string, @Param('itemId') itemId: string, @Body('qtyActualG') qtyActualG: number) {
    return this.ordering.weighItem(id, itemId, Number(qtyActualG));
  }

  @Post('merchant/orders/:id/items/:itemId/missing')
  missing(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.ordering.markMissing(id, itemId);
  }

  // --- Курьер ---
  @Post('courier/orders/:id/delivering')
  delivering(@Param('id') id: string) {
    return this.ordering.delivering(id);
  }

  @Post('courier/orders/:id/delivered')
  delivered(@Param('id') id: string) {
    return this.ordering.delivered(id);
  }
}
