# 23. Публикация приложений (Google Play / App Store)

Относится к приложению магазина (`apps/merchant`, Flutter) — единственному нативному
приложению. Приложение покупателя сейчас — веб/PWA (о публикации PWA в сторы — §5).

## 23.1 Что уже подготовлено (в репозитории)

- **Иконки** приложения (carrot-логотип) — Android (adaptive) и iOS, сгенерированы
  `flutter_launcher_icons` из `assets/icon/icon.png` (+ `icon_foreground.png`).
- **Название** приложения: «Kartop Магазин» (Android `android:label`, iOS `CFBundleDisplayName`).
- **Разрешения** Android: `INTERNET`, `USE_BIOMETRIC`. iOS: `NSFaceIDUsageDescription`.
- **Релизная подпись** Android: `signingConfigs.release` читает `android/key.properties`
  (в git не попадает), минификация R8 + `proguard-rules.pro`. Шаблон — `android/key.properties.example`.
- **Bundle/Application ID**: `kz.kartop.kartop_merchant`.
- **Privacy Policy / Terms**: страницы `kartop.kz/privacy` и `kartop.kz/terms` (черновики,
  проверить с юристом) — обязательные URL для обоих сторов.
- **API в проде**: приложение собирается с `--dart-define=API_BASE=https://api.kartop.kz/api`.

## 23.2 Что нужно сделать владельцу (разово)

### Общее
- Домены/URL для сторов: Privacy `https://kartop.kz/privacy`, Terms `https://kartop.kz/terms`,
  поддержка `support@kartop.kz`.
- Скриншоты: минимум 2–4 телефонных (есть готовые экраны — заказы, карточка, курьер, товары).

### Google Play (Android)
1. Аккаунт Google Play Console (разовый взнос $25).
2. Создать ключ подписи (хранить в секрете, НЕ коммитить):
   ```
   keytool -genkey -v -keystore ~/kartop-merchant.jks -keyalg RSA -keysize 2048 -validity 10000 -alias kartop
   ```
   Заполнить `android/key.properties` по образцу `key.properties.example`.
3. Собрать AAB:
   ```
   flutter build appbundle --release --flavor prod --dart-define=API_BASE=https://api.kartop.kz/api
   ```
   (нужен установленный Android SDK; в этом окружении SDK нет — собрать локально или в CI.)
4. В Play Console: создать приложение, загрузить AAB, заполнить **Data safety** (телефон,
   email, местоположение, данные заказа), возрастной рейтинг, листинг (тексты ниже),
   указать Privacy Policy URL. Включить Play App Signing.

### App Store (iOS)
1. Apple Developer Program ($99/год).
2. Сборка iOS возможна только на **macOS + Xcode** (в этом Linux-окружении — нельзя).
   Варианты: собрать на Mac либо через CI (например Codemagic — поддерживает Flutter + macOS).
   ```
   flutter build ipa --release --dart-define=API_BASE=https://api.kartop.kz/api
   ```
3. В App Store Connect: создать app (Bundle ID `kz.kartop.kartop_merchant`), загрузить сборку
   (Xcode/Transporter), заполнить **App Privacy**, листинг, Privacy Policy URL, скриншоты.

## 23.3 Тексты листинга (RU, черновик)

**Название:** Kartop Магазин
**Короткое описание (до 80 симв.):** Приёмка и сборка заказов зелёного базара — для магазинов Kartop.
**Полное описание:**
> Приложение для магазинов и продавцов зелёного базара на платформе Kartop.
> • Новые заказы с звуковым сигналом и составом для сборки.
> • Взвешивание весовых товаров и отметка «нет в наличии» прямо при сборке.
> • Выдача заказа по коду получения — подтверждение, что заказ у клиента на руках.
> • Управление ассортиментом: цены и наличие в пару тапов.
> • Доставка и самовывоз, настройки магазина.
> • Данные клиента открываются только после принятия заказа; до принятия — только
>   состав и примерная зона на карте.
> Вход по номеру телефона, защита входа по Face ID / отпечатку / PIN.
**Ключевые слова (App Store):** базар, магазин, доставка, продукты, заказы, Kartop, овощи, фрукты.
**Категория:** Бизнес / Покупки.

## 23.4 Данные для форм приватности сторов

Собираемые данные: номер телефона, email, имя, примерная геолокация (с разрешения),
данные заказов/адрес, идентификатор устройства/push-токен. Назначение: работа сервиса,
связь по заказу, уведомления. Не продаются третьим лицам. Хранение ПДн граждан РК — в РК.

## 23.5 Приложение покупателя

Сейчас покупатель — веб/PWA (`apps/web`). Публикация в сторы позже:
- **Android**: Trusted Web Activity (TWA) / Bubblewrap — обёртка PWA в APK/AAB.
- **iOS**: нативная обёртка (PWABuilder) или отдельное Flutter-приложение покупателя.
Либо собрать нативное приложение покупателя на Flutter (переиспользовать стиль/модели).

## 23.6 Ограничения окружения

Здесь нет Android SDK и macOS, поэтому **бинарники (.aab/.ipa) собрать нельзя** — всё готово
к сборке на машине разработчика или в CI. Иконки, подпись-конфиг, манифесты, разрешения,
privacy/terms и тексты листингов подготовлены.
