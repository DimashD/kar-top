# 22. Invite-only регистрация магазинов, B2C email, FCM-бэкенд

## 22.1 Invite-only: магазины заводит только платформа

Свободной регистрации мерчантов нет. Магазин появляется, только если админ Kartop
добавил телефон владельца. Вход в приложение по OTP работает для любого номера, но без
заведённого магазина список пуст — «с улицы» создать витрину нельзя.

Флоу: договорённость → админ заводит магазин (PENDING + владелец + OWNER) → приглашение →
владелец входит, настраивает витрину из мастер-каталога → админ одобряет (ACTIVE) →
витрина видна покупателям. (Реквизиты/БИН — позже, перед первой выплатой.)

Эндпоинт (под AdminGuard):
```
POST /admin/stores { name, ownerPhone, city?, address?, kaspiPhone? }
→ Store(PENDING) + User(ownerPhone) + StoreMember(OWNER); slug — транслит+суффикс
```

Проверено: админ завёл магазин → владелец видит его (PENDING, OWNER); посторонний → пусто.

## 22.2 B2C: связка email↔телефон

При оформлении заказа покупатель может указать email — он привязывается к телефону
(`POST /orders { …, email }`). Дальше код/уведомления могут идти на почту (дешевле SMS,
см. docs/21). Email занят другим аккаунтом → заказ создаётся без привязки. Проверено.

## 22.3 FCM (бэкенд готов; приложение — после Firebase)

`FcmSender` (FCM HTTP v1, OAuth2 по сервис-аккаунту, без доп. зависимостей) обслуживает
все платформы (токены firebase_messaging — FCM-токены). Включается переменной окружения
`FIREBASE_SERVICE_ACCOUNT` (JSON) или `FIREBASE_SERVICE_ACCOUNT_PATH`. Без неё — dev-заглушка.
`PushRegistry` маршрутизирует android/ios/web в FCM.

**Что нужно, чтобы включить push (делает владелец аккаунта Google):**
1. Firebase-проект (console) → добавить Android-приложение (`kz.kartop.kartop_merchant`) →
   скачать `google-services.json`; iOS → `GoogleService-Info.plist`; включить Cloud Messaging.
2. `flutterfire configure` для `lib/firebase_options.dart` (или вручную).
3. Сервис-аккаунт (Project settings → Service accounts → Generate new private key) → JSON.
4. JSON сервис-аккаунта — в **секреты окружения** как `FIREBASE_SERVICE_ACCOUNT` (НЕ в чат).
   Конфиги приложения (`google-services.json`/plist/options) — в репозиторий приложения.

После этого остаётся добавить `firebase_messaging` в приложение магазина (регистрация
FCM-токена → уже есть `POST /devices/push-token`; громкий сигнал нового заказа) — заскаффолдим,
когда конфиги будут на месте.
