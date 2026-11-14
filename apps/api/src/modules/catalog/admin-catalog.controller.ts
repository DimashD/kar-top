import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Put, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Unit } from '@prisma/client';
import { AdminCatalogService } from './admin-catalog.service';
import { ProductPhotoService } from './product-photo.service';
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

/** Фото реального товара: base64 без префикса data:; пусто/null — удалить. */
class SourcePhotoDto {
  @IsOptional() @IsString() data?: string | null;
  @IsOptional() @IsIn(['image/jpeg', 'image/png', 'image/webp']) type?: string;
}

class GeneratePhotoDto {
  /** Уточнение к шаблону: «3 штуки», «в сетке», «без упаковки». */
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

@UseGuards(AdminGuard)
@Controller('admin/catalog')
export class AdminCatalogController {
  constructor(private readonly catalog: AdminCatalogService, private readonly photos: ProductPhotoService) {}

  // --- Фото товара: реальное фото → генерация по шаблону (Gemini) → проверка → на витрины ---
  @Get('products/:id/photo-status')
  photoStatus(@Param('id') id: string) { return this.photos.status(id); }

  @Put('products/:id/source-photo')
  setSource(@Param('id') id: string, @Body() dto: SourcePhotoDto) { return this.photos.setSource(id, dto.data, dto.type); }

  @Get('products/:id/source-photo')
  @Header('cache-control', 'private, no-store')
  async source(@Param('id') id: string) { const p = await this.photos.source(id); return new StreamableFile(p.data, { type: p.type }); }

  @Post('products/:id/generate-photo')
  generate(@Param('id') id: string, @Body() dto: GeneratePhotoDto) { return this.photos.generate(id, dto.note); }

  @Get('products/:id/photo-draft')
  @Header('cache-control', 'private, no-store')
  async draft(@Param('id') id: string) { const p = await this.photos.draft(id); return new StreamableFile(p.data, { type: p.type }); }

  @Post('products/:id/apply-photo')
  apply(@Param('id') id: string) { return this.photos.apply(id); }

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

  // --- Заявки магазинов на категорию/товар ---
  @Get('requests')
  requests(@Query('status') status?: string) { return this.catalog.listRequests(status); }

  @Post('requests/:id/approve')
  approveRequest(@Param('id') id: string) { return this.catalog.approveRequest(id); }

  @Post('requests/:id/reject')
  rejectRequest(@Param('id') id: string) { return this.catalog.rejectRequest(id); }
}
