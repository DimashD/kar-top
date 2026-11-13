import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/auth/current-user.decorator';
import { AdminGuard } from '../../common/auth/admin.guard';
import { LegalService, Origin } from './legal.service';
import { AcceptDocsDto, AcceptOfferDto, MarkOfferDto } from './dto';

// API стоит за прокси: настоящий адрес клиента — первый в X-Forwarded-For.
const origin = (req: any): Origin => ({
  ip: String(req.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim() || req.ip || null,
  userAgent: req.headers?.['user-agent'] ?? null,
});

// Принятие документов: покупатели и сотрудники (соглашение, согласие на ПДн), владельцы магазинов (оферта).
@Controller()
export class LegalController {
  constructor(private readonly legal: LegalService) {}

  @Get('me/legal')
  mine(@CurrentUser() user: RequestUser) { return this.legal.myStatus(user.userId); }

  @Post('me/legal/accept')
  acceptMine(@CurrentUser() user: RequestUser, @Body() dto: AcceptDocsDto, @Req() req: any) {
    return this.legal.acceptMine(user.userId, dto.docs, origin(req));
  }

  @Get('merchant/stores/:id/offer')
  offer(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.legal.offerStatusForMember(id, user.userId); }

  @Post('merchant/stores/:id/offer/request-code')
  offerCode(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.legal.requestOfferCode(id, user.userId); }

  @Post('merchant/stores/:id/offer/accept')
  acceptOffer(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body() dto: AcceptOfferDto, @Req() req: any) {
    return this.legal.acceptOffer(id, user.userId, dto.legalName, dto.bin, dto.code, origin(req));
  }
}

@UseGuards(AdminGuard)
@Controller('admin/stores')
export class AdminLegalController {
  constructor(private readonly legal: LegalService) {}

  @Get(':id/legal')
  status(@Param('id') id: string) { return this.legal.offerStatus(id); }

  @Post(':id/legal/mark')
  mark(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body() dto: MarkOfferDto, @Req() req: any) {
    return this.legal.markOffer(id, user.userId, dto.method, dto.legalName, dto.bin, dto.note, origin(req));
  }
}
