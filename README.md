# FreshMarket / Kartop

Онлайн **зелёный базар** — мультитенантная платформа витрин и доставки. Магазины (овощи, фрукты, мясо, молочка, корейские салаты и весь ассортимент рынка) открывают онлайн-витрину; покупатели заказывают с доставкой или самовывозом из магазинов района. Запуск: Алматы + Астана.

## Структура (монорепо)
```
apps/
  api/        NestJS (модульный монолит): identity(OTP), catalog, merchant, ordering, payments…
  web/        Next.js — веб-витрина покупателя (desktop + mobile, PWA). Первой выходит в прод.
  # customer_app/  Flutter — приложение покупателя (после пилота)
  # merchant_app/  Flutter — приложение магазина (нативное: заказы, сборка, цены, зоны)
  # admin/     Next.js — админка платформы
packages/
  api-contract/  OpenAPI спецификация
infra/        Terraform (Yandex Cloud kz1) + Helm/ArgoCD
design/       макеты (артборды) — см. artifact/холст
docs/         продукт, архитектура, безопасность, OTP, запуск, разбор Kartop
```

## Быстрый старт (локально)
```bash
cp .env.example .env
docker compose up -d                 # Postgres+PostGIS, Redis
npm install
npm --workspace apps/api run prisma:generate
npm run dev:api                      # http://localhost:3000/api/health
npm run dev:web                      # http://localhost:3001
```

## Документация
- `docs/01-product-discovery.md` — продукт, ассортимент (весь базар), MVP
- `docs/02-backlog.md` — эпики и спринты
- `docs/03-architecture.md` — архитектура, модель данных, карты, доставка, биллинг
- `docs/05-ux-audit.md` · `docs/06-benchmark-kartop.md` — дизайн и бенчмарк
- `docs/07-security-audit.md` · `docs/08-otp-and-launch.md` — ИБ/ПДн, OTP, план запуска

## Ключевые решения
Деньги — в тиынах (Int). Вес — в граммах (Int). ПДн граждан РК хранятся в РК.
Данные клиента скрыты от магазина до принятия заказа. Оплата заказа — при получении (MVP);
подписка магазина — авто-счёт через Kaspi Pay. Карты — MapLibre + OSM (PMTiles) с абстракцией MapProvider.
