import { Module } from '@nestjs/common';
import { CatalogController } from './catalog/catalog.controller';

@Module({ controllers: [CatalogController] })
export class CatalogModule {}
