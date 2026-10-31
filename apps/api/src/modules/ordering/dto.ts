import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested, IsIn, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsString() storeProductId!: string;
  // Для весовых — граммы, для штучных — qty. Указывается одно из двух.
  @IsOptional() @IsInt() @Min(1) qtyG?: number;
  @IsOptional() @IsInt() @Min(1) qty?: number;
}

export class AddressDto {
  @IsString() line!: string;
  @IsOptional() @IsString() entrance?: string;
  @IsOptional() @IsString() floor?: string;
  @IsOptional() @IsString() apartment?: string;
  @IsOptional() @IsString() intercom?: string;
  @IsOptional() @IsString() comment?: string;
  @IsOptional() @IsInt() lat?: number;
  @IsOptional() @IsInt() lng?: number;
}

export class CreateOrderDto {
  @IsString() storeSlug!: string;
  @IsString() phone!: string;
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => OrderItemDto) items!: OrderItemDto[];
  @IsOptional() @ValidateNested() @Type(() => AddressDto) address?: AddressDto;
  @IsIn(['CASH', 'CARD_COURIER', 'KASPI_TRANSFER']) payMethod!: 'CASH' | 'CARD_COURIER' | 'KASPI_TRANSFER';
}
