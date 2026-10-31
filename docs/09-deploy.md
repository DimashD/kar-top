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

## Развёртывание на VPS PS.KZ (Казахстан)

1. **Заказать на ps.kz:** VPS с Ubuntu 22.04/24.04, минимум **2 vCPU / 4 ГБ RAM / 60 ГБ SSD** (хватает для db+redis+api+web+TLS в Docker на старте; для роста — отдельная БД/кластер).
2. **Домен** `kar-top.kz`: в DNS создать **A-запись** на IP вашего VPS (и `www` при желании).
3. На сервере:
   ```bash
   ssh root@<IP-вашего-VPS>
   git clone https://github.com/DimashD/kar-top.git && cd kar-top
   sudo bash deploy/bootstrap.sh kar-top.kz admin@kar-top.kz
   ```
   Скрипт сам ставит Docker, генерирует секреты в `.env.prod`, поднимает стек и получает HTTPS-сертификат (Let's Encrypt через Caddy).
4. Первичный сид демо-магазина (один раз):
   ```bash
   docker compose --env-file .env.prod -f docker-compose.prod.yml exec api npx prisma db seed
   ```
5. Открыть `https://kar-top.kz/api/health` — должно вернуть `{"status":"ok"}`.

Ключи интеграций (Telegram/SMS/Kaspi) вписываются в `.env.prod` позже — до этого OTP/биллинг работают в dev-режиме, остальной API — полностью.
