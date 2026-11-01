import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

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
