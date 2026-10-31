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

  // Представление для магазина: ПДн скрыты до принятия (TODO: защитить guard'ом роли магазина).
  @Get('merchant/orders/:id')
  forMerchant(@Param('id') id: string) {
    return this.ordering.forMerchant(id);
  }
}
