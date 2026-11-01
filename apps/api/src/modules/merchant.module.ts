import { Module } from '@nestjs/common';
import { MerchantController } from './merchant/merchant.controller';
import { MerchantService } from './merchant/merchant.service';
import { StoreAccess } from '../common/auth/store-access.service';

// Приложение магазина: ассортимент (цены, наличие, добавление/удаление товаров).
@Module({
  controllers: [MerchantController],
  providers: [MerchantService, StoreAccess],
})
export class MerchantModule {}
