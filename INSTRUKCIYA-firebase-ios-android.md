# Инструкция: Firebase (push), публикация Android и iOS

Пошагово для приложения магазина `apps/merchant` (Flutter, Bundle ID
`kz.kartop.kartop_merchant`). Делается один раз. Что уже готово в коде — помечено ✅.

---

## Часть 1. Firebase (push-уведомления)

Нужен Google-аккаунт. ~10 минут.

1. **Создать проект.** console.firebase.google.com → Add project → имя «Kartop».
2. **Android-приложение.** В проекте → Add app → Android:
   - Package name: `kz.kartop.kartop_merchant`
   - Скачать `google-services.json` → положить в `apps/merchant/android/app/src/prod/google-services.json` (тестовое приложение — `src/staging/`, пакет `kz.kartop.kartop_merchant.staging`).
3. **iOS-приложение.** Add app → iOS:
   - Bundle ID: `kz.kartop.kartop_merchant`
   - Скачать `GoogleService-Info.plist` → положить в `apps/merchant/ios/Runner/GoogleService-Info.plist`
     (добавить в проект через Xcode).
4. **Включить Cloud Messaging.** Build → Messaging (по умолчанию включён).
5. **Сервис-аккаунт для бэкенда (отправка пушей).**
   Project settings → Service accounts → **Generate new private key** → скачается JSON.
   - НЕ класть в git и НЕ присылать в чат.
   - Добавить его как **секрет окружения** сессии/прода: переменная
     `FIREBASE_SERVICE_ACCOUNT` = содержимое JSON (или `FIREBASE_SERVICE_ACCOUNT_PATH` = путь к файлу).
     ✅ Бэкенд (`FcmSender`) уже это читает и шлёт через FCM HTTP v1.
6. **Конфиг приложения.** Проще всего:
   ```
   dart pub global activate flutterfire_cli
   cd apps/merchant && flutterfire configure
   ```
   Это создаст `lib/firebase_options.dart` и привяжет оба приложения к проекту.
7. Сообщите мне, что `google-services.json` / `GoogleService-Info.plist` / `firebase_options.dart`
   на месте — я добавлю `firebase_messaging` в приложение (регистрация FCM-токена уже
   поддержана бэкендом: `POST /devices/push-token`) и громкий сигнал нового заказа.

---

## Часть 2. Android — сборка и Google Play

Нужен Android SDK (ставится с Android Studio) и аккаунт Google Play Console ($25 разово).

1. **Ключ подписи** (хранить в секрете, один раз):
   ```
   keytool -genkey -v -keystore ~/kartop-merchant.jks -keyalg RSA -keysize 2048 -validity 10000 -alias kartop
   ```
2. Создать `apps/merchant/android/key.properties` по образцу `key.properties.example`:
   ```
   storePassword=...
   keyPassword=...
   keyAlias=kartop
   storeFile=/абсолютный/путь/к/kartop-merchant.jks
   ```
   ✅ Конфиг подписи/минификации в `build.gradle.kts` уже настроен.
3. **Собрать AAB:**
   ```
   cd apps/merchant
   flutter build appbundle --release --dart-define=API_BASE=https://api.kartop.kz/api
   ```
   Файл: `build/app/outputs/bundle/release/app-release.aab`.
4. **Google Play Console:** создать приложение → загрузить AAB → заполнить:
   - Store listing (тексты — `docs/23 §23.3`), иконка ✅, скриншоты.
   - Data safety: телефон, email, местоположение (примерное), данные заказов, push-токен.
   - Возрастной рейтинг, Privacy Policy URL: `https://kartop.kz/privacy`.
   - Включить Play App Signing.

---

## Часть 3. iOS — сборка и App Store

Нужен **macOS + Xcode** (на Linux собрать нельзя) и Apple Developer Program ($99/год).
Варианты: ваш Mac, либо CI с macOS-раннерами (например Codemagic).

1. В Apple Developer / App Store Connect создать App ID и приложение
   (Bundle ID `kz.kartop.kartop_merchant`).
2. На macOS:
   ```
   cd apps/merchant
   flutter build ipa --release --dart-define=API_BASE=https://api.kartop.kz/api
   ```
3. Загрузить сборку через Xcode Organizer или Transporter.
4. В App Store Connect заполнить App Privacy, листинг (тексты — `docs/23`),
   Privacy Policy URL, скриншоты. Отправить на ревью.

---

## Полезное

- Прод-API: все сборки — с `--dart-define=API_BASE=https://api.kartop.kz/api`.
- Privacy/Terms: `https://kartop.kz/privacy`, `https://kartop.kz/terms` (проверить с юристом).
- Хотите, настрою **CI (Codemagic / GitHub Actions)**, чтобы `.aab` (и `.ipa` на их macOS)
  собирались автоматически по пушу — скажите.
- Приложение покупателя сейчас веб/PWA; публикация в сторы — позже (TWA/обёртка или
  отдельное Flutter-приложение). См. `docs/23 §23.5`.
