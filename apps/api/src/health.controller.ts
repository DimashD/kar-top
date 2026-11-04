import { Controller, Get } from '@nestjs/common';
import { Public } from './common/auth/public.decorator';

@Public()
@Controller('health')
export class HealthController {
  @Get()
  health() {
    return {
      status: 'ok',
      service: 'freshmarket-api',
      // env/version проставляет деплой — по ним smoke-тест проверяет, что выкатилась нужная сборка.
      env: process.env.APP_ENV || 'local',
      version: process.env.APP_VERSION || 'local',
      ts: new Date().toISOString(),
    };
  }
}
