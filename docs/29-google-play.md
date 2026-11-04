# 29. Публикация в Google Play (автоматическая)

Сборку, тексты, иконку, баннер и скриншоты загружает workflow **Play Store** (`.github/workflows/play-store.yml`)
через Google Play API. Вручную, только в Play Console, делается то, чего API не умеет: создать приложение,
пройти анкеты и выдать доступ роботу.

## Что уже в репозитории
- Тексты страницы: `apps/merchant/fastlane/metadata/android/ru-RU/` (`title.txt`, `short_description.txt`, `full_description.txt`, `changelogs/default.txt`).
- Иконка 512×512 и баннер 1024×500: `.../ru-RU/images/`.
- Скриншоты 1080×1920 снимаются автоматически: веб-сборка приложения, вход в демо-магазин тестовой среды (`apps/merchant/store/screenshots.js`).
- Подписанная сборка `.aab` (flavor `prod`, API `https://kar-top.kz/api`), ключ подписи — секреты `ANDROID_KEYSTORE_*`.

## Разово, вручную

### 1. Создать приложение (Play Console)
https://play.google.com/console → **Создать приложение**:
- Название: `Kartop Магазин`; язык по умолчанию: **русский (ru-RU)**; Приложение; Бесплатное; согласиться с правилами.

### 2. Первая сборка — вручную
Google принимает загрузки через API только после того, как у приложения есть хотя бы одна сборка.
- Скачать `.aab`: Actions → *Mobile (merchant app)* → последний ручной запуск → Artifacts → `kartop-merchant-aab` (zip → `.aab`).
- Play Console → **Тестирование → Внутреннее тестирование → Создать выпуск** → загрузить `.aab` → Сохранить.
  Play App Signing — согласиться (по умолчанию).

### 3. Доступ для робота (ключ Google Play API)
1. https://console.cloud.google.com → выбрать проект **kartop** (тот же, что у Firebase).
2. **APIs & Services → Library** → найти **Google Play Android Developer API** → **Enable**.
3. **IAM & Admin → Service accounts → Create service account**: имя `play-publisher` → Create and continue → роли не нужны → Done.
4. Открыть созданный аккаунт → **Keys → Add key → Create new key → JSON** → скачается файл.
5. Play Console → **Пользователи и разрешения → Пригласить пользователей** → email сервисного аккаунта
   (`play-publisher@kartop.iam.gserviceaccount.com`) → **Разрешения для приложения** → «Kartop Магазин» → **Администратор** → Пригласить.
6. GitHub → Settings → Secrets → Actions → **New repository secret** `PLAY_SERVICE_ACCOUNT_JSON` = всё содержимое JSON-файла. Файл удалить.

### 4. Анкеты в Play Console (только вручную; ответы — `apps/merchant/Kartop-play-console-instrukciya.pdf`)
Раздел **Policy → App content**: Политика конфиденциальности (`https://kar-top.kz/privacy`), Доступ к приложению
(см. ниже), Реклама (нет),
Возрастной рейтинг (анкета IARC), Целевая аудитория (18+), Data safety, Удаление аккаунта (`https://kar-top.kz/delete-account`),
Новостное приложение (нет), Госприложение (нет), Финансовые функции (нет), Здоровье (нет).

**Доступ к приложению для проверяющих Google.** Вход в приложение — по SMS-коду, у проверяющих его не будет.
Нужно указать в анкете «Доступ к приложению» инструкцию и рабочий вход. Варианты: отдельный номер-«демо» с постоянным кодом на проде
(требует доработки API — сейчас фиксированный код работает только на тестовой среде) или реальный номер, по которому вы продиктуете код.

## Выпуск версии
Actions → **Play Store** → Run workflow:
- `track`: `internal` (внутреннее тестирование) → потом `alpha` (закрытое) → `production`;
- `release_status`: `draft`, пока Google не проверил приложение впервые; потом `completed`.

Workflow соберёт `.aab` с новым versionCode, снимет свежие скриншоты и загрузит всё в Play.

## Ограничение Google для личных аккаунтов
Личный аккаунт разработчика (создан после 13.11.2023) получает доступ к **Production** только после **закрытого тестирования
с ≥12 тестировщиками в течение 14 дней подряд**. Аккаунт организации (D-U-N-S) — без этого требования.
