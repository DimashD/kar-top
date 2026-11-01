import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { MerchantService } from './merchant.service';
import { AddProductDto, UpdateProductDto, StoreSettingsDto } from './dto';
import { CurrentUser, RequestUser } from '../../common/auth/current-user.decorator';

// Управление ассортиментом из приложения магазина. Глобальный JwtAuthGuard + проверка членства в сервисе.
@Controller('merchant')
export class MerchantController {
  constructor(private readonly merchant: MerchantService) {}

  @Get('stores')
  myStores(@CurrentUser() user: RequestUser) {
    return this.merchant.myStores(user.userId);
  }

  @Get('stores/:id/catalog')
  catalog(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.merchant.catalog(id, user.userId);
  }

  @Get('stores/:id/settings')
  getSettings(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.merchant.getSettings(id, user.userId);
  }

  @Patch('stores/:id/settings')
  updateSettings(@Param('id') id: string, @Body() dto: StoreSettingsDto, @CurrentUser() user: RequestUser) {
    return this.merchant.updateSettings(id, user.userId, dto);
  }

  @Post('stores/:id/products')
  addProduct(@Param('id') id: string, @Body() dto: AddProductDto, @CurrentUser() user: RequestUser) {
    return this.merchant.addProduct(id, user.userId, dto);
  }

  @Patch('stores/:id/products/:spId')
  updateProduct(@Param('id') id: string, @Param('spId') spId: string, @Body() dto: UpdateProductDto, @CurrentUser() user: RequestUser) {
    return this.merchant.updateProduct(id, spId, user.userId, dto);
  }

  @Delete('stores/:id/products/:spId')
  removeProduct(@Param('id') id: string, @Param('spId') spId: string, @CurrentUser() user: RequestUser) {
    return this.merchant.removeProduct(id, spId, user.userId);
  }
}
