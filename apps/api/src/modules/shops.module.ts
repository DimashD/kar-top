import { Module } from '@nestjs/common';
import { MyStoresController, ShopsController } from './shops/shops.controller';
import { ShopsService } from './shops/shops.service';
import { ListingService } from './shops/listing';

@Module({ controllers: [ShopsController, MyStoresController], providers: [ShopsService, ListingService], exports: [ListingService] })
export class ShopsModule {}
