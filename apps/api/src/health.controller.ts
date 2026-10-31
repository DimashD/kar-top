import { Controller, Get } from '@nestjs/common';
import { Public } from './common/auth/public.decorator';

@Public()
@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok', service: 'freshmarket-api', ts: new Date().toISOString() };
  }
}
