import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // CORS для мобильного/веб-клиента (приложение магазина — отдельный origin).
  // CORS_ORIGINS=https://a.kz,https://b.kz или '*' (по умолчанию — разрешить все, для dev).
  const origins = process.env.CORS_ORIGINS;
  app.enableCors({ origin: origins && origins !== '*' ? origins.split(',') : true });
  await app.listen(Number(process.env.PORT) || 3000);
}
bootstrap();
