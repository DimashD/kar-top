import { Module } from '@nestjs/common';
import { OrderingController } from './ordering/ordering.controller';
import { OrderingService } from './ordering/ordering.service';

@Module({ controllers: [OrderingController], providers: [OrderingService] })
export class OrderingModule {}
