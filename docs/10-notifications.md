# 10. Уведомления (push + резервный SMS)

Единая система уведомлений для **покупателя** и **магазина**. Доменные события
записываются в transactional outbox в одной транзакции с изменением состояния,
а диспетчер доставляет их в пуши (и, для критичных, резервный SMS).

## 10.1 Принципы

- **Transactional outbox.** Событие (`OutboxEvent`) пишется той же транзакцией,
  что и смена статуса заказа / выставление счёта. Пуш никогда не «теряется» из-за
  того, что транзакция откатилась, и не уходит раньше, чем состояние зафиксировано.
- **At-least-once + идемпотентность.** Диспетчер помечает событие `processedAt`
  после доставки. Повторный прогон не задваивает уже обработанные события; клиент
  дедуплицирует по `data.type + data.id`.
- **Аудитория у события одна, тексты разные.** Одно событие знает, кому оно адресовано
  (`customer` / `merchant` / `both`), и несёт отдельный текст для каждой стороны.
- **Критичное → резервный SMS.** Если у получателя нет ни одного push-токена, а событие
  помечено `critical`, оно уходит по SMS (тот же канал, что и OTP: Telegram → WhatsApp → SMS).
- **Деньги — в тиынах, вес — в граммах, время — UTC** (как и везде, см. `03-architecture.md`).

## 10.2 Поток

```
изменение состояния ─┐
                     ├─ один $transaction ─> OutboxEvent(processedAt=null)
запись OrderEvent  ──┘
                                   │
            NotificationDispatcher.process()  (воркер / планировщик)
                                   │
          recipients(audience) ──> PushToken по платформам
                                   │
     FcmProvider / ApnsProvider / WebPushProvider   (+ fallback-SMS для critical)
                                   │
                    OutboxEvent.processedAt = now, attempts++
```

## 10.3 События и шаблоны

`apps/api/src/modules/notifications/templates.ts`

| Событие                       | Кому       | Заголовок              | critical | loud |
|-------------------------------|------------|------------------------|:-------:|:----:|
| `order.placed`                | магазин    | Новый заказ            | ✓       | ✓    |
| `order.accepted`              | покупатель | Магазин принял заказ   | ✓       |      |
| `order.substitution_needed`   | покупатель | Нужна замена           | ✓       |      |
| `order.price_updated`         | покупатель | Сумма уточнена         |         |      |
| `order.ready`                 | покупатель | Заказ готов            |         |      |
| `order.delivering`            | покупатель | Курьер в пути          |         |      |
| `order.delivered`             | покупатель | Заказ доставлен        |         |      |
| `order.cancelled`             | оба        | Заказ отменён          |         |      |
| `billing.invoice_issued`      | магазин    | Счёт на подписку       | ✓       |      |
| `billing.invoice_paid`        | магазин    | Оплата получена        |         |      |

- `loud` — у приложения магазина громкий повторяющийся сигнал «новый заказ» до принятия.
- `critical` — при отсутствии push отправляется резервный SMS.

## 10.4 Каналы (провайдеры)

`apps/api/src/modules/notifications/push-provider.ts`

- **FCM** — Android.
- **APNs** — iOS.
- **Web Push (VAPID)** — PWA покупателя (на iOS web push ограничен → там и нативное приложение).
- Выбор провайдера — по `PushToken.platform` через `PushRegistry`.
- На проде провайдеры подключаются реальными ключами (FCM service account, APNs key, VAPID);
  в dev они логируют отправку (`[fcm] … «title: body»`).

## 10.5 Получатели

`NotificationDispatcher.recipients(audience, aggregateType, aggregateId)`

- `order` → покупатель (`order.customerId`) и/или все сотрудники магазина (`StoreMember`).
- `subscription` → все сотрудники магазина.
- ПДн покупателя при этом не раскрываются магазину раньше `ACCEPTED` — пуш несёт только
  номер заказа и район, тексты не содержат телефон/адрес/имя (см. `07-security-audit.md`).

## 10.6 Регистрация токенов

`POST /api/devices/push-token` (требует access-токен)

```json
{ "platform": "android|ios|web", "token": "<device push token>" }
```

Upsert по `token`: смена владельца устройства перепривязывает токен к новому пользователю.

## 10.7 Запуск диспетчера

- **Планировщик** (`SchedulerService`, `@nestjs/schedule`) вызывает `process()` каждые 5 с
  с защитой от наложения прогонов. Включается `SCHEDULER_ENABLED=1` (в тестах/CI выключен —
  прогоны детерминированы, без фоновых пушей).
- Ежемесячные счёта — `@Cron('0 6 1 * *', UTC)`: 1-го числа 06:00 UTC (11:00 Алматы),
  идемпотентно по (subscription, period).
- Ручной/проверочный прогон диспетчера — `POST /api/internal/notifications/dispatch`
  (под `AdminGuard`), возвращает `{ processed, pushesSent }`.

## 10.8 Проверено e2e

Полный прогон (`seed` → логин admin/owner/customer по OTP → регистрация токенов →
заказ → приёмка → отметка «нет товара» → биллинг) подтвердил:

- `order.placed` → магазину (FCM, loud);
- `order.accepted` → покупателю (web + ios, 2 пуша);
- `order.substitution_needed` → покупателю (web + ios);
- `billing.invoice_issued` → магазину (FCM);
- все `OutboxEvent.processedAt` проставлены, `attempts = 1` (без дублей).
