# 09. Развёртывание и тестирование

## Статус: backend-ядро запускается и проверено end-to-end

Весь поток API прогнан на реальном PostgreSQL 16 + Redis (сид демо-магазина `ruslan-fruits`):

| Проверка | Результат |
|---|---|
| `GET /api/health` | ok |
| `GET /api/catalog/categories` | 14 категорий всего базара (из БД) |
| `GET /api/shops/ruslan-fruits/catalog` | магазин + 7 товаров по 6 категориям |
| `GET /api/shops/ruslan-fruits/zone-check` | в зоне (284 м, доставка 500 ₸) / вне зоны — `inZone:false` |
| `POST /api/orders` | заказ создан, статус PLACED, оценка 890 ₸ (1 кг × 890) |
| `GET /api/merchant/orders/:id` до принятия | **ПДн скрыты** (`pii:null` + подсказка) |
| `POST .../accept` → `GET` | **ПДн открылись** (телефон виден), статус ACCEPTED |
| picking → **взвешивание 1,08 кг** → ready | итог пересчитан: **961,2 ₸**, события записаны |
| недопустимый переход READY→ACCEPTED | отклонён («Недопустимый переход») |
| `POST /api/auth/otp/request` | код отправлен (dev-канал), лимиты в Redis |
| `POST /api/billing/run-monthly` + вебхук Kaspi | счёт 14 900 ₸ выставлен → оплачен (PAID) |

Команда прогона — в истории git (ветка `feat/s4-deploy-e2e`).

## Локальный запуск
```bash
cp .env.example .env
docker compose up -d                      # Postgres+PostGIS, Redis
cd apps/api && npm install
npx prisma migrate deploy && npx prisma db seed
npm run start:dev                         # http://localhost:3000/api
```

## Staging / прод одной командой
```bash
export JWT_ACCESS_SECRET=... JWT_REFRESH_SECRET=...
docker compose -f docker-compose.prod.yml up -d --build
# api :3000, web :3001; миграции применяются автоматически при старте api
```

## Что нужно от владельца для РЕАЛЬНОГО прода (только вы)
Эти вещи требуют ваших аккаунтов/оплаты — я их выполнить не могу:

1. **Хостинг в Казахстане** (ПДн граждан РК хранятся в РК): Yandex Cloud регион `kz1` — Managed Kubernetes/PostgreSQL + Redis, либо VM в КЗ. Для **тестового staging без реальных ПДн** подойдёт любой VM/PaaS.
2. **Домен** (напр. `kar-top.kz`) + TLS.
3. **Ключи интеграций** в переменные окружения: `TELEGRAM_GATEWAY_TOKEN`, SMS-агрегатор (`SMS_API_KEY`, имя отправителя), `KASPI_MERCHANT_ID`/`KASPI_API_KEY` (Kaspi Business — оформляется заранее).
4. **Карты:** разместить `almaty.pmtiles` (OSM) на CDN/S3, указать `PMTILES_URL`.
5. **Юридическое:** оферта, политика ПДн, уведомление уполномоченного органа (до приёма реальных заказов).

Пока ключи не заданы — OTP/SMS/Kaspi работают в dev-режиме (заглушки логируют), остальной API функционирует.

## Что осталось по коду до публичного пилота
Роли и JWT-гварды на merchant/admin эндпоинтах; мерчант/админ API (ассортимент, модерация); каркас веб-витрины на Next.js по макетам (витрина → корзина → оформление → статус); планировщик счетов 1-го числа; outbox + пуши; автотесты (Testcontainers/e2e).
