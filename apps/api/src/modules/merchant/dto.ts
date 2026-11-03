import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddProductDto {
  @IsString() masterProductId!: string;
  @IsInt() @Min(1) priceTiyn!: number;
  @IsOptional() @IsInt() @Min(1) oldPriceTiyn?: number;
  @IsOptional() @IsBoolean() inStock?: boolean;
}

export class UpdateProductDto {
  @IsOptional() @IsInt() @Min(1) priceTiyn?: number;
  // null разрешён — убрать старую (зачёркнутую) цену.
  @IsOptional() @IsInt() oldPriceTiyn?: number | null;
  @IsOptional() @IsBoolean() inStock?: boolean;
}

export class StoreSettingsDto {
  @IsOptional() @IsBoolean() pickupEnabled?: boolean;
  // Минимум времени от оформления до готовности к самовывозу (минуты).
  @IsOptional() @IsInt() @Min(0) pickupLeadMinutes?: number;
  @IsOptional() @IsIn(['OWN', 'SERVICE', 'BOTH']) deliveryMode?: 'OWN' | 'SERVICE' | 'BOTH';
}

export class CatalogRequestDto {
  @IsIn(['CATEGORY', 'PRODUCT']) type!: 'CATEGORY' | 'PRODUCT';
  @IsString() name!: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() categoryName?: string;
  @IsOptional() @IsIn(['KG', 'G', 'PCS', 'BUNCH', 'PACK']) unit?: string;
  @IsOptional() @IsString() note?: string;
}
