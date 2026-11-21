import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/auth/current-user.decorator';
import { AdminGuard } from '../../common/auth/admin.guard';
import { Public } from '../../common/auth/public.decorator';
import { OnboardingService } from './onboarding.service';
import { ApplicationDto, RejectDto, StoreDocumentDto } from './dto';
import { Origin } from '../legal/legal.service';

const origin = (req: any): Origin => ({
  ip: String(req.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim() || req.ip || null,
  userAgent: req.headers?.['user-agent'] ?? null,
});

const sendImage = (res: any, d: { data: Buffer | Uint8Array; type: string }) => {
  res.setHeader('Content-Type', d.type);
  res.setHeader('Cache-Control', 'private, no-store');
  res.end(Buffer.from(d.data));
};

// Заявка магазина из приложения магазина (вошедший по коду пользователь становится владельцем).
@Controller('merchant')
export class OnboardingController {
  constructor(private readonly svc: OnboardingService) {}

  @Post('applications')
  create(@CurrentUser() user: RequestUser, @Body() dto: ApplicationDto) { return this.svc.create(user.userId, dto); }

  @Get('stores/:id/application')
  status(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.svc.status(id, user.userId); }

  @Put('stores/:id/application')
  update(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body() dto: ApplicationDto) { return this.svc.update(id, user.userId, dto); }

  @Post('stores/:id/application/submit')
  submit(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.svc.submit(id, user.userId); }

  @Post('stores/:id/application/contract-link')
  contractLink(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.svc.contractLink(id, user.userId); }

  @Post('stores/:id/documents')
  addDoc(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body() dto: StoreDocumentDto) {
    return this.svc.addDocument(id, user.userId, dto.kind, dto.data, dto.type);
  }

  @Get('stores/:id/documents/:docId')
  async doc(@Param('id') id: string, @Param('docId') docId: string, @CurrentUser() user: RequestUser, @Res() res: any) {
    sendImage(res, await this.svc.ownDocument(id, user.userId, docId));
  }

  @Delete('stores/:id/documents/:docId')
  removeDoc(@Param('id') id: string, @Param('docId') docId: string, @CurrentUser() user: RequestUser) {
    return this.svc.removeDocument(id, user.userId, docId);
  }
}

// Печатная форма договора с данными магазина — по одноразовой ссылке из приложения.
@Controller('contract')
export class ContractController {
  constructor(private readonly svc: OnboardingService) {}

  @Public()
  @Get()
  data(@Query('t') t: string) { return this.svc.contractData(t ?? ''); }
}

// Очередь заявок в админке.
@UseGuards(AdminGuard)
@Controller('admin/applications')
export class AdminApplicationsController {
  constructor(private readonly svc: OnboardingService) {}

  @Get()
  list() { return this.svc.adminList(); }

  @Get(':id')
  one(@Param('id') id: string) { return this.svc.details(id); }

  @Get(':id/documents/:docId')
  async doc(@Param('id') id: string, @Param('docId') docId: string, @Res() res: any) {
    sendImage(res, await this.svc.document(id, docId));
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: RequestUser, @Req() req: any) { return this.svc.approve(id, user.userId, origin(req)); }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectDto) { return this.svc.reject(id, dto.reason); }
}
