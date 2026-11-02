import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PartnerLeadStatus } from '@prisma/client';
import { PartnersService } from './partners.service';
import { Public } from '../../common/auth/public.decorator';
import { AdminGuard } from '../../common/auth/admin.guard';

class ApplyPartnerDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(10) @MaxLength(20) phone!: string;
  @IsOptional() @IsString() @MaxLength(200) company?: string;
  @IsOptional() @IsString() @MaxLength(500) twogisUrl?: string;
  @IsOptional() @IsIn(['web', 'merchant_app']) source?: string;
}

class SetStatusDto {
  @IsIn(['NEW', 'CONTACTED', 'CONVERTED', 'REJECTED']) status!: PartnerLeadStatus;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

@Controller('partners')
export class PartnersController {
  constructor(private readonly partners: PartnersService) {}

  // Публичная заявка «Стать партнёром» (сайт/приложение мерчанта). Без авторизации.
  @Public()
  @Post('apply')
  apply(@Body() dto: ApplyPartnerDto) {
    return this.partners.apply(dto);
  }

  // --- Платформа (админка) ---
  @UseGuards(AdminGuard)
  @Get()
  list(@Query('status') status?: string, @Query('limit') limit?: string) {
    return this.partners.list(status, limit ? Number(limit) : 50);
  }

  @UseGuards(AdminGuard)
  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() dto: SetStatusDto) {
    return this.partners.setStatus(id, dto.status, dto.note);
  }
}
