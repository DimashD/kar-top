# 28. Тестовая среда и выкатка на прод

Раньше любой пуш в `main` сразу уезжал на прод. Теперь код сначала проходит тестовую среду, и только потом, после ручного подтверждения, попадает на прод.

```
feature-ветка ─PR─▶ develop ──авто──▶ ТЕСТ  https://test.kar-top.kz  +  приложение «Kartop ТЕСТ»
                                        │  проверили руками, smoke-тест зелёный
                                        ▼
                     PR develop → main ──▶ [Approve] ──▶ ПРОД  https://kar-top.kz
```

| | Тест (staging) | Прод (production) |
|---|---|---|
| Ветка | `develop` | `main` |
| Сайт / API | `test.kar-top.kz` / `test.kar-top.kz/api` | `kar-top.kz` / `kar-top.kz/api` |
| База | своя, ненастоящие данные | боевая |
| Вход по телефону | код всегда **111111**, SMS не отправляются | настоящий код |
| Как выкатывается | автоматически после пуша | только после **Approve** |
| Мобилка | «Kartop ТЕСТ» (`kz.kartop.kartop_merchant.staging`), `.apk` в Actions | «Kartop Магазин», `.aab` для Google Play |
| На экране | красная плашка «ТЕСТОВАЯ СРЕДА» / лента «ТЕСТ» | — |

## Как работает конвейер (`.github/workflows/deploy.yml`)

1. **Тесты.** Сборка api и web (включая проверку типов) и все jest-тесты. Если что-то красное, дальше конвейер не идёт.
2. **Сборка Docker-образов** в GitHub Actions с публикацией в GHCR (`ghcr.io/dimashd/kar-top-api|web`).
   Тег образа — хэш дерева файлов (`t-xxxxxxxxxxxx`). После merge `develop → main` содержимое то же, тег тот же, поэтому **на прод уходит ровно тот образ, который проверяли на тесте**, без пересборки.
   Сервер больше ничего не собирает сам, и памяти на 2 ГБ VPS хватает.
3. **Деплой** (`deploy/deploy.sh` на сервере):
   - для прода сначала делается бэкап БД в `/opt/kar-top-backups/` (хранятся последние 14);
   - скачиваются образы, перезапускаются контейнеры, при старте api применяются миграции;
   - скрипт ждёт `/api/health` с нужной версией. Если новая версия не поднялась, **он автоматически откатывается на предыдущую**.
4. **Smoke-тест снаружи** (`deploy/smoke.sh`): проверяет health и версию, главную, `/partner`, `/admin`.

### Ручной запуск и откат
Actions → **Deploy** → Run workflow → выбрать окружение и указать **тег** прошлой версии (теги видны в заголовках прошлых запусков и в `/api/health` → `version`). Так можно откатить прод на любую версию за пару минут.

Сид каталога и назначение админа (Actions → *Seed catalog* / *Admin setup*) тоже запускаются с выбором окружения. По умолчанию выбран тест.

## Ежедневная работа
1. Делаем изменения в ветке → PR в `develop` (или пуш прямо в `develop`).
2. Через ~5–8 минут изменения на `https://test.kar-top.kz`. Тестовое приложение лежит в Actions → *Mobile* → артефакт `kartop-merchant-TEST-apk`.
3. Проверили → открываем PR **develop → main** → merge.
4. Деплой на прод ждёт подтверждения: Actions → запуск → **Review deployments → Approve**.

> Миграции БД пишем обратно совместимыми (сначала добавить колонку, потом удалять старую отдельным релизом). Тогда авто-откат кода безопасен.

## Одноразовая настройка (вручную в GitHub / DNS)

1. **DNS.** В панели hoster.kz → DNS-зона `kar-top.kz` добавить A-запись `test` → `89.126.205.212`.
2. **Подтверждение прода.** GitHub → Settings → Environments → `production` (появится после первого запуска; можно создать вручную) → **Required reviewers** → добавить себя → Save.
   *Без этого шага прод выкатывается после merge в main без кнопки Approve.*
3. **Защита main.** Settings → Branches → Add rule для `main`: *Require a pull request before merging* и *Require status checks* (`build` из CI). Тогда в `main` попадает только проверенный код из `develop`.
4. Ветку по умолчанию для новых PR можно сделать `develop` (Settings → General → Default branch).

Первый деплой теста создаёт на сервере `/opt/kar-top-staging/.env.staging` со своими секретами. Тестовый сайт начнёт открываться после того, как будет DNS-запись и **один раз** выкатится прод с этой схемой: прод-Caddy отвечает и за `test.kar-top.kz`. До этого smoke-тест staging будет красным, и это ожидаемо.

Тестовых пользователей, магазины и каталог заводим так: Actions → *Seed catalog* (target: staging) и *Admin setup* (target: staging).

## Тестовая среда на отдельном сервере (когда появится бюджет)
Сейчас тест живёт на том же VPS, что и прод: отдельная БД и Redis, лимиты памяти, сеть `kartop-edge`. Чтобы вынести его на отдельный сервер:
1. Купить маленький VPS, поставить Docker (`curl -fsSL https://get.docker.com | sh`).
2. В GitHub → Environments → `staging` задать секреты `SERVER_HOST`, `SERVER_USER`, `SERVER_PASSWORD` (или `SERVER_SSH_KEY`) нового сервера.
3. Перенаправить DNS `test` на новый IP.

`deploy.sh` сам увидит, что прод-Caddy на сервере нет, и поднимет свой (`--profile standalone`).

## Мобильное приложение
- Flavors: `prod` и `staging` (`android/app/build.gradle.kts`). Теперь `--flavor` обязателен:
  ```bash
  flutter run --flavor staging --dart-define=APP_ENV=staging --dart-define=API_BASE=https://test.kar-top.kz/api
  flutter build appbundle --release --flavor prod --dart-define=API_BASE=https://kar-top.kz/api
  ```
- `google-services.json` лежит в `android/app/src/prod/` и `src/staging/`. Для пушей в тестовом приложении нужно зарегистрировать в Firebase (проект `kartop`) Android-приложение `kz.kartop.kartop_merchant.staging` и заменить `src/staging/google-services.json` скачанным файлом. Пока это не сделано, приложение работает, но пуши в тестовую сборку не приходят.
- Раздача тестировщикам через Firebase App Distribution включится сама, если добавить секреты `FIREBASE_APP_ID_STAGING` и `FIREBASE_SERVICE_ACCOUNT_JSON` (и группу `testers` в Firebase). Без них `.apk` скачивается из артефактов Actions.

## Безопасность (рекомендация)
Деплой сейчас ходит на сервер под `root` по паролю. Лучше завести пользователя `deploy` с SSH-ключом, положить ключ в секрет `SERVER_SSH_KEY`, а `SERVER_PASSWORD` удалить. Workflow уже поддерживает ключ.
