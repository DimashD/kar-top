import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { MerchantService } from './merchant.service';
import { AddProductDto, UpdateProductDto, StoreSettingsDto, CatalogRequestDto, ZonesDto } from './dto';
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

  @Get('stores/:id/zones')
  getZones(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.merchant.getZones(id, user.userId);
  }

  @Put('stores/:id/zones')
  saveZones(@Param('id') id: string, @Body() dto: ZonesDto, @CurrentUser() user: RequestUser) {
    return this.merchant.saveZones(id, user.userId, dto);
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

  // Заявка магазина на новую категорию/товар в мастер-каталог.
  @Post('stores/:id/catalog-requests')
  submitCatalogRequest(@Param('id') id: string, @Body() dto: CatalogRequestDto, @CurrentUser() user: RequestUser) {
    return this.merchant.submitCatalogRequest(id, user.userId, dto);
  }

  @Get('stores/:id/catalog-requests')
  myCatalogRequests(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.merchant.myCatalogRequests(id, user.userId);
  }
}
