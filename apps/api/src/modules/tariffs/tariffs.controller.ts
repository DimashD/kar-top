import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CurrentUser, RequestUser } from '../../common/auth/current-user.decorator';
import { AdminGuard } from '../../common/auth/admin.guard';
import { Public } from '../../common/auth/public.decorator';
import { TariffsService } from './tariffs.service';

class TariffDto {
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsString() @MinLength(5) @MaxLength(5000) body!: string;
  /** Абонплата, тиыны в месяц. */
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) monthlyFeeTiyn?: number | null;
  /** Процент с заказа в сотых долях процента (250 = 2,5%). */
  @IsOptional() @IsInt() @Min(0) @Max(5000) commissionBp?: number | null;
  @IsDateString() effectiveFrom!: string;
}

@Controller('tariffs')
export class TariffsController {
  constructor(private readonly svc: TariffsService) {}

  @Public()
  @Get()
  overview() { return this.svc.overview(); }
}

@UseGuards(AdminGuard)
@Controller('admin/tariffs')
export class AdminTariffsController {
  constructor(private readonly svc: TariffsService) {}

  @Get()
  list() { return this.svc.overview(); }

  @Post()
  publish(@CurrentUser() user: RequestUser, @Body() dto: TariffDto) { return this.svc.publish(user.userId, dto); }

  @Delete(':id')
  cancel(@Param('id') id: string) { return this.svc.cancel(id); }
}
