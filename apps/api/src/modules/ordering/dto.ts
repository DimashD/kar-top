import { IsArray, IsInt, IsNumber, IsOptional, IsString, Min, Max, ValidateNested, IsIn, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsString() storeProductId!: string;
  // Для весовых — граммы, для штучных — qty. Указывается одно из двух.
  // Весовой товар — не больше 20 кг в одной позиции.
  @IsOptional() @IsInt() @Min(1) @Max(20000, { message: 'Не больше 20 кг одного товара' }) qtyG?: number;
  @IsOptional() @IsInt() @Min(1) qty?: number;
}

export class AddressDto {
  @IsString() line!: string;
  @IsOptional() @IsString() entrance?: string;
  @IsOptional() @IsString() floor?: string;
  @IsOptional() @IsString() apartment?: string;
  @IsOptional() @IsString() intercom?: string;
  @IsOptional() @IsString() comment?: string;
  // Район/зона — не точные ПДн, можно показывать магазину до принятия.
  @IsOptional() @IsString() district?: string;
  // Координаты точки доставки (точные). Магазину до принятия отдаём огрублённые.
  @IsOptional() @IsNumber() @Min(-90) @Max(90) lat?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) lng?: number;
}

export class CreateOrderDto {
  @IsString() storeSlug!: string;
  // Номер берётся из подтверждённого аккаунта (createForUser); в форме — не обязателен.
  @IsOptional() @IsString() phone?: string;
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => OrderItemDto) items!: OrderItemDto[];
  @IsOptional() @ValidateNested() @Type(() => AddressDto) address?: AddressDto;
  @IsIn(['CASH', 'CARD_COURIER', 'KASPI_TRANSFER']) payMethod!: 'CASH' | 'CARD_COURIER' | 'KASPI_TRANSFER';
  @IsOptional() @IsIn(['DELIVERY', 'PICKUP']) fulfillment?: 'DELIVERY' | 'PICKUP';
  // Доставка: OWN — магазин сам (по зонам), SERVICE — курьерская служба (Яндекс и др.), оплачивает покупатель отдельно.
  @IsOptional() @IsIn(['OWN', 'SERVICE']) deliveryBy?: 'OWN' | 'SERVICE';
  // Желаемое время получения (ISO): самовывоз — не раньше оформление + pickupLeadMinutes;
  // доставка — не раньше оформление + срок доставки магазина (своя: ownDeliveryMinutes, служба: courierHandoverMinutes).
  @IsOptional() @IsString() pickupAt?: string;
}
