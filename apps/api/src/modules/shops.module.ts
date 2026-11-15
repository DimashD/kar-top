import { Module } from '@nestjs/common';
import { MyStoresController, ShopsController } from './shops/shops.controller';
import { ShopsService } from './shops/shops.service';

@Module({ controllers: [ShopsController, MyStoresController], providers: [ShopsService] })
export class ShopsModule {}
