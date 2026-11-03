import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Unit } from '@prisma/client';
import { AdminCatalogService } from './admin-catalog.service';
import { AdminGuard } from '../../common/auth/admin.guard';

const UNITS = ['KG', 'G', 'PCS', 'BUNCH', 'PACK'];

class CategoryDto {
  @IsOptional() @IsObject() name?: any;
  @IsOptional() @IsBoolean() perishable?: boolean;
  @IsOptional() @IsBoolean() coldChain?: boolean;
  @IsOptional() @IsInt() sort?: number;
}

class ProductDto {
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsObject() name?: any;
  @IsOptional() @IsIn(UNITS) unit?: Unit;
  @IsOptional() @IsInt() @Min(1) stepG?: number;
  @IsOptional() @IsInt() @Min(1) avgPieceG?: number;
  @IsOptional() @IsBoolean() perishable?: boolean;
  @IsOptional() @IsString() @MaxLength(200) storage?: string;
}

@UseGuards(AdminGuard)
@Controller('admin/catalog')
export class AdminCatalogController {
  constructor(private readonly catalog: AdminCatalogService) {}

  @Get('categories')
  categories() { return this.catalog.categories(); }

  @Post('categories')
  createCategory(@Body() dto: CategoryDto) { return this.catalog.createCategory(dto as any); }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: CategoryDto) { return this.catalog.updateCategory(id, dto); }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) { return this.catalog.deleteCategory(id); }

  @Get('products')
  products(@Query('categoryId') categoryId?: string) { return this.catalog.products(categoryId); }

  @Post('products')
  createProduct(@Body() dto: ProductDto) { return this.catalog.createProduct(dto as any); }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: ProductDto) { return this.catalog.updateProduct(id, dto as any); }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) { return this.catalog.deleteProduct(id); }
}
