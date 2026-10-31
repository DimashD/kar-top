# 03. Архитектура (CTO)

## 1. Принципы
1. **Модульный монолит сначала, микросервисы — по необходимости.** Чёткие bounded contexts с собственными схемами БД и API между модулями; выносим в сервис модуль, когда этого требует нагрузка или команда. Так делают Shopify и ранний Instacart: скорость сейчас, масштаб потом.
2. **Stateless‑приложения + горизонтальное масштабирование.** Состояние — только в Postgres/Redis/S3/очереди.
3. **Event‑driven внутри:** доменные события через transactional outbox → брокер. Уведомления, поиск, аналитика — подписчики.
4. **API‑first:** OpenAPI‑контракт → генерация клиентов для Dart (Flutter) и TypeScript (веб).
5. **Деньги — в минорных единицах (integer) + валюта.** Вес — в граммах (integer).
6. **Мультитенантность** по `store_id` с Row‑Level Security в Postgres.

## 2. Стек
| Слой | Технология | Почему |
|---|---|---|
| Мобильные (покупатель, магазин) | **Flutter** (Riverpod, go_router, dio, freezed) | Одна кодовая база iOS/Android, нативная производительность |
| Веб‑витрина | **Next.js** (React, SSR/ISR) | SEO, быстрый первый рендер, шаринг ссылок магазинов. Flutter Web для SEO не подходит |
| Админка платформы | **Next.js + React** (TanStack Query, shadcn/ui) | Таблицы, формы, карты. Веб‑кабинета магазина нет — магазины работают только в мобильном приложении |
| Карты | **MapLibre + PMTiles (OSM) + свой геокодер** в MVP; 2GIS / Яндекс — адаптеры через `MapProvider` | Бесплатно и без лимитов, проверено Kartop в Алматы, см. §11 |
| Backend | **TypeScript / NestJS** (модульный монолит) | Общие типы с вебом, большой рынок найма, быстрая разработка. Горячие пути (поиск слотов, трекинг) при необходимости — на Go |
| БД | **PostgreSQL 16** + PostGIS | Транзакции для заказов/денег, геозоны доставки |
| Кэш / локи / лимиты | **Redis** | Резерв слотов, rate limiting, сессии, кэш витрин |
| Поиск | **OpenSearch** (или Meilisearch на старте) | Морфология ru/kk, опечатки, фасеты |
| Очередь / события | **NATS JetStream** на старте → **Kafka** при росте | Outbox → события заказов, уведомлений, аналитики |
| Файлы | **S3** + **imgproxy** + **CDN** | Фото каталога в нужных размерах, WebP/AVIF |
| Realtime | WebSocket (Socket.IO/uWS) через Redis pub/sub; fallback — polling | Статусы заказа, новые заказы в кабинете |
| Push | FCM + APNs | |
| Инфраструктура | **Kubernetes** (managed), **Terraform**, ArgoCD, GitHub Actions | ПДн граждан РК хранятся в РК: Yandex Cloud, регион Казахстан (kz1) + резервные копии у второго провайдера в РК, см. `08-otp-and-launch.md` |
| OTP | Telegram Gateway → SMS (казахстанский агрегатор) → WhatsApp Cloud API; только официальные каналы | См. `08-otp-and-launch.md` |
| Веб-витрина | Адаптивная (телефон + компьютер) + PWA, первой выходит в Алматы и Астане | Быстрее, чем выход в сторы |
| Наблюдаемость | OpenTelemetry → Grafana (Prometheus, Loki, Tempo), Sentry | |

## 3. Контексты (модули backend)
```
identity      — пользователи, OTP, токены, роли, устройства
merchant      — магазины, сотрудники, график, зоны, слоты, способы оплаты, модерация
catalog       — мастер‑каталог, категории, медиа, ассортимент и цены магазинов
search        — индексация (подписчик событий catalog), поиск
cart          — корзины (Redis + снапшоты в БД)
ordering      — заказы, машина состояний, сборка, замены
payments      — провайдеры, холды, списания, возвраты, сплит, выплаты
delivery      — назначение курьера, трекинг, партнёры (v2)
notification  — push/SMS/e‑mail, шаблоны
backoffice    — API админки, аудит
analytics     — экспорт событий
```

```
[Flutter Customer] [Flutter Merchant] [Next.js Web] [Next.js Admin]
          \               |               |              /
           ----------  API Gateway / BFF (REST + WS)  ----------
                                 |
                     NestJS modular monolith (N pods)
          identity | merchant | catalog | ordering | payments | ...
              |            |             |              |
          PostgreSQL    Redis        OpenSearch      NATS/Kafka --> notification, search-indexer, analytics
           (+replicas)                                S3 + imgproxy + CDN
```

## 4. Ключевая модель данных (упрощённо)
- `stores(id, slug, status[pending|active|suspended|blocked], legal_*, rating, settings jsonb)`
- `store_members(store_id, user_id, role)`
- `store_schedules`, `delivery_zones(store_id, polygon geography, fee, min_order, free_from)`
- `delivery_slots(store_id, starts_at, ends_at, capacity, reserved, booked)`
- `categories(id, parent_id, name i18n, perishable bool, cold_chain bool, sort)` — дерево всего рынка
- `master_products(id, category_id, name i18n, unit, step_g, avg_piece_g, nutrition, media[], perishable bool, storage)`
- `store_products(store_id, master_product_id, price_minor, old_price_minor, unit_price_basis, in_stock, stock_qty)`
- `orders(id, store_id, customer_id, status, slot_id, address, payment_method, subtotal, delivery_fee, hold_amount, final_amount, substitution_policy)` — партиционирование по месяцу
- `order_items(order_id, store_product_id, qty_requested, qty_actual, price_snapshot, status[ok|replaced|missing])`
- `order_events(order_id, from, to, actor, at)` — история
- `payments(order_id, provider, type[hold|capture|refund], amount, status, idempotency_key)`

## 5. Машина состояний заказа
```
created → awaiting_payment → placed → accepted → picking → (awaiting_customer: замены)
        → ready → courier_assigned → delivering → delivered → completed
Любое до picking → cancelled (покупатель/магазин/система по SLA)
picking+ → cancelled только магазином/саппортом с возвратом
```
Каждый переход — транзакция + запись в `order_events` + событие в outbox. Переходы идемпотентны (ключ запроса).

## 6. Весовой товар и деньги

**MVP (оплата при получении):** в заказе — оценочная сумма; после сборки фиксируется `final_amount` по фактическому весу, покупатель получает пуш с итоговой суммой, курьер принимает оплату и отмечает способ. Ниже — схема для онлайн‑оплаты (v1).

1. При оформлении: `hold = subtotal × (1 + buffer)` для весовых позиций (buffer 10–15%, настраивается).
2. Сборщик вводит фактический вес → пересчёт позиции.
3. На `ready`: `capture(final_amount)`; разница холда освобождается автоматически.
4. Если `final > hold` — правило: ограничиваем превышение, предлагаем покупателю доплату или сокращение.

## 7. Масштабирование до миллионов пользователей
- **Чтение витрин** (90% трафика): кэш в Redis + CDN для веб‑витрины (ISR), фото через CDN. Витрина магазина — один агрегированный запрос.
- **Поиск** вынесен в OpenSearch, не нагружает Postgres.
- **Postgres:** primary + read‑реплики, PgBouncer, партиционирование `orders/order_events`, архив старых данных. При росте — шардирование по `store_id`/региону (Citus) — модель к этому готова.
- **Слоты:** атомарный резерв в Redis (Lua) + подтверждение в БД — нет оверсела в пиковые часы.
- **Пики** (вечер, выходные, праздники): HPA по CPU/RPS, очереди сглаживают уведомления.
- **Мульти‑регион:** данные по странам (требования к ПДн), ворота на уровне gateway.
- **SLO:** доступность API 99.9%, p95 витрины < 300 мс, p95 оформления < 800 мс.

## 8. Безопасность
- OTP с rate limiting и защитой от SMS‑фрода; JWT короткоживущий (15 мин) + refresh с ротацией.
- RBAC + RLS по `store_id`, принцип наименьших привилегий для сотрудников, 2FA в админке.
- PCI DSS: карты не храним — токенизация у провайдера.
- Секреты — в Vault/Secret Manager, шифрование ПДн at rest, аудит‑лог.
- OWASP ASVS, SAST/DAST в CI, зависимости — Dependabot/Renovate.

## 9. Монорепозиторий
```
freshmarket/
  apps/
    customer_app/      # Flutter, покупатель
    merchant_app/      # Flutter, магазин (сборка, курьер)
    web/               # Next.js — витрина для покупателей
    admin/             # Next.js — админка платформы (только сотрудники)
    api/               # NestJS модульный монолит
  packages/
    api-contract/      # OpenAPI спецификация + генерация клиентов
    flutter_ui/        # общий Flutter UI kit (дизайн‑токены)
    web-ui/            # общий React UI kit
  infra/               # Terraform, Helm, k8s
  docs/
```

## 10. Решения для согласования (ADR)
1. Модульный монолит на NestJS (а не микросервисы с первого дня).
2. Flutter для мобилок, Next.js для веба (а не Flutter Web).
3. Магазин работает только в мобильном приложении; веб — только админка и витрина покупателя.
5. В MVP нет онлайн‑оплаты: модуль `payments` хранит способ и факт оплаты при получении; эквайринг подключается в v1 без изменения модели заказа.
6. ПДн клиента скрыты от магазина до `accepted` — фильтрация в API (DTO по статусу), не в клиенте.
4. Один магазин на корзину в MVP.

## 11. Карты для Казахстана

| Вариант | Данные по KZ | Flutter | Стоимость | Ограничения |
|---|---|---|---|---|
| **2GIS** (MapGL JS, Mobile SDK, Geocoder, Suggest) | Лучшие: здания, номера, подъезды, входы, организации | Есть официальный Flutter SDK | Платно по запросам; демо‑ключ на месяц; цену для KZ даёт менеджер | Бесплатного постоянного тарифа нет |
| **Яндекс Карты** (MapKit, Geocoder) | Хорошие, здания и номера | Есть плагины | Бесплатно до ~1000 DAU карты при соблюдении условий (бесплатное публичное приложение) | В бесплатной версии запрещён трекинг транспорта; дальше — дорогая лицензия |
| **MapLibre + OpenStreetMap** | Средние: номера домов есть не везде, подъездов почти нет | maplibre_gl | Бесплатно (свой тайл‑сервер или OpenFreeMap) | Геокодер (Nominatim/Photon) слабее для адресов KZ |

**Рекомендация (обновлено после разбора Kartop, см. `06-benchmark-kartop.md`):** MVP — **MapLibre + свои векторные тайлы города в одном файле PMTiles** (данные OpenStreetMap, ~30 МБ на Алматы, раздаём со своего S3/CDN) + **свой геокодер** по адресам OSM (Photon/Pelias или таблица адресов в PostGIS с поиском pg_trgm). Стоимость — 0 ₸, без лимитов и ключей; во Flutter — `maplibre_gl`. Kartop показывает, что для Алматы номера домов и корпусов в OSM достаточно полные. Слабые места (подъезды, новые ЖК) закрываем ручным уточнением пина и полями подъезд/этаж. Если качества адресов не хватит в новом городе — подключаем 2GIS или Яндекс как адаптер. Весь код работает через интерфейс `MapProvider` (карта, геокодирование, подсказки, полигоны), поэтому смена провайдера — это замена адаптера, а не переписывание. Координаты зон храним в PostGIS независимо от провайдера.

## 12. Доставка: своя и подключаемая служба (обновление)

Два режима доставки, магазин выбирает сам в приложении (раздел «Доставка»):

1. **Своя доставка** (MVP, по умолчанию). Магазин развозит своими курьерами. Настраивает зоны (полигон/радиус на карте), цену доставки, мин. заказ, порог бесплатной доставки, окна/слоты. Платформа комиссию за логистику не берёт.
2. **Служба доставки Kartop** (v1, включается тумблером, платно). Магазин, у которого нет своих курьеров, включает подключаемую доставку. Заказ автоматически передаётся партнёру‑логисту (Яндекс Доставка и т.п.) через `delivery` модуль. Берётся отдельная плата за доставку (с покупателя и/или магазина, настраивается). Тумблер «вкл/выкл» на уровне магазина и зоны; платформа может централизованно включать/выключать провайдера.

**Модель данных:** `stores.delivery_mode` = `own | service | both`; при `both` для зон вне своей — служба. `delivery_providers`, `delivery_assignments(order_id, provider, status, fee, external_id)`. Абстракция `DeliveryProvider` (оценка цены, создание заявки, статус, вебхуки) — так же как `MapProvider`. Включение службы — фича‑флаг на магазине + тариф.

## 13. Биллинг магазинов: подписка через Kaspi Pay (авто‑счёт)

Платформа ежемесячно автоматически выставляет каждому магазину счёт на абонентскую плату (тариф Free/Pro/Business) и приём платежа через **Kaspi Pay**.

- **Как работает:** планировщик 1‑го числа формирует инвойсы по активным магазинам (сумма = тариф − скидки + overage), создаёт счёт в Kaspi Pay (Invoice/QR или ссылка на оплату через Kaspi API), отправляет магазину пуш/SMS/в приложение. Статус оплаты приходит вебхуком Kaspi → помечаем `paid`. Неоплата за N дней → напоминания, затем ограничение витрины (`suspended`) до оплаты.
- **Модуль `billing`:** `subscriptions(store_id, plan, price_minor, status, next_invoice_at)`, `invoices(id, store_id, period, amount_minor, status[draft|issued|paid|overdue|void], kaspi_invoice_id, issued_at, paid_at)`, `billing_events` (outbox). Идемпотентность по `(store_id, period)` — один счёт за месяц.
- **Безопасность:** подпись вебхуков Kaspi проверяется; суммы в minor units; все операции в аудит‑логе; ретраи создания счёта с backoff.
- **Разделение с оплатой заказов:** биллинг магазина (магазин → платформа) — это НЕ оплата заказа покупателем (которая в MVP «при получении»). Разные потоки, разные модули.
- **Провайдер как абстракция `PaymentProvider`:** Kaspi Pay — первый; позже Halyk/CloudPayments для эквайринга заказов (v1).
