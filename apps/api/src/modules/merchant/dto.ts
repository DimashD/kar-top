import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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

/** Фото магазина: base64 без префикса data:; data null/пусто — убрать фото. */
export class StorePhotoDto {
  @IsOptional() @IsString() data?: string | null;
  @IsOptional() @IsIn(['image/jpeg', 'image/png', 'image/webp']) type?: string;
}

export class StoreSettingsDto {
  @IsOptional() @IsBoolean() pickupEnabled?: boolean;
  @IsOptional() @IsBoolean() deliveryEnabled?: boolean;
  // Минимум времени от оформления до готовности к самовывозу (минуты).
  @IsOptional() @IsInt() @Min(0) pickupLeadMinutes?: number;
  @IsOptional() @IsIn(['OWN', 'SERVICE', 'BOTH']) deliveryMode?: 'OWN' | 'SERVICE' | 'BOTH';
  // Готовность к передаче курьерской службе (минуты от оформления).
  @IsOptional() @IsInt() @Min(0) @Max(1440) courierHandoverMinutes?: number;
  // Средняя продолжительность своей доставки (минуты от оформления до вручения).
  @IsOptional() @IsInt() @Min(0) @Max(1440) ownDeliveryMinutes?: number;
}

export class ZoneDto {
  @IsIn(['radius', 'polygon']) kind!: 'radius' | 'polygon';
  // Радиус круга вокруг магазина, метры (для kind = radius).
  @IsOptional() @IsInt() @Min(100) @Max(30000) radiusM?: number;
  // Точки обведённой области [[lat, lng], ...] (для kind = polygon).
  @IsOptional() @IsArray() points?: [number, number][];
  @IsInt() @Min(0) feeTiyn!: number;
  @IsInt() @Min(0) minOrderTiyn!: number;
  @IsOptional() @IsInt() @Min(0) freeFromTiyn?: number | null;
}

export class ZonesDto {
  // Точка магазина — центр радиуса и ориентир для покупателя.
  @IsNumber() @Min(-90) @Max(90) lat!: number;
  @IsNumber() @Min(-180) @Max(180) lng!: number;
  @IsArray() @ArrayMaxSize(5) @ValidateNested({ each: true }) @Type(() => ZoneDto) zones!: ZoneDto[];
}

export class CatalogRequestDto {
  @IsIn(['CATEGORY', 'PRODUCT']) type!: 'CATEGORY' | 'PRODUCT';
  @IsString() name!: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() categoryName?: string;
  @IsOptional() @IsIn(['KG', 'G', 'PCS', 'BUNCH', 'PACK']) unit?: string;
  @IsOptional() @IsString() note?: string;
}
