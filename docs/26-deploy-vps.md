# 26. Боевой деплой на VPS (hoster.kz Cloud 2-2-50)

Сервер: **89.126.205.212** · Ubuntu 24.04 · 2 vCPU / 2 GB RAM / 50 GB NVMe · Алматы
Домен: **kar-top.kz** (куплен на hoster.kz)

Итог: витрина `https://kar-top.kz`, API `https://kar-top.kz/api`, авто-HTTPS (Let's Encrypt через Caddy),
миграции БД применяются сами при старте, секреты генерируются один раз в `.env.prod`.

---

## Шаг 1. DNS — направить домен на сервер

В панели hoster.kz → раздел доменов → **kar-top.kz** → «Управление DNS» (DNS-зона).
Создать/исправить две A-записи:

| Тип | Имя (host) | Значение            | TTL  |
|-----|------------|---------------------|------|
| A   | `@`        | `89.126.205.212`    | 3600 |
| A   | `www`      | `89.126.205.212`    | 3600 |

Если есть старые A/AAAA/CNAME на `@` или `www` — удалить, чтобы не конфликтовали.
Проверка (через 5–30 мин, иногда до 2–4 ч):

```bash
dig +short kar-top.kz
```

Должно вернуть `89.126.205.212`. Пока не вернёт — HTTPS-сертификат не выпустится.

---

## Шаг 2. Зайти на сервер

Вариант А — через веб-консоль hoster.kz (VNC/Console в карточке сервера) — ничего ставить не надо.
Вариант Б — с Mac через Терминал:

```bash
ssh root@89.126.205.212
```

(пароль root — из письма/панели hoster.kz; **никому и никуда в чат его не вставляй**).

---

## Шаг 3. Доступ к приватному репозиторию

Репозиторий `github.com/DimashD/kar-top` приватный, поэтому серверу нужен доступ на чтение.
Есть два пути — выбери один.

### Путь 1 (рекомендую): read-only токен GitHub
1. На GitHub: Settings → Developer settings → **Fine-grained tokens** → Generate new token.
2. Repository access → Only select repositories → `DimashD/kar-top`.
3. Permissions → Repository → **Contents: Read-only**. Срок — 90 дней (потом перевыпустить).
4. Скопировать токен (`github_pat_...`).
5. На сервере (токен подставляется **прямо в команду на сервере**, не в чат):

```bash
cd /opt
git clone https://github_pat_ВСТАВЬ_ТОКЕН@github.com/DimashD/kar-top.git
cd kar-top
```

### Путь 2: временно сделать репозиторий публичным
GitHub → репозиторий → Settings → General → внизу «Change visibility» → Public.
Тогда на сервере просто:

```bash
cd /opt && git clone https://github.com/DimashD/kar-top.git && cd kar-top
```

> Секретов в коде нет (пароли/ключи генерируются в `.env.prod` на сервере), так что публичность
> не раскрывает ключи. Но бизнес-логика станет видна — решай сам.

---

## Шаг 4. Один запуск — всё поднимется

Из каталога репозитория на сервере:

```bash
sudo bash deploy/bootstrap.sh kar-top.kz admin@kar-top.kz +77011115999
```

Третий аргумент (телефон) необязателен — если указать, скрипт сразу назначит этот номер
сотрудником платформы (вход в `/admin/*`). Без него деплой тоже пройдёт.

Скрипт сам:
- создаёт swap 2 ГБ (чтобы сборка не упала на 2 ГБ RAM),
- ставит Docker,
- генерирует `.env.prod` со случайными паролем БД и JWT-секретами,
- собирает и запускает: PostgreSQL+PostGIS, Redis, API (с авто-миграциями), Web, Caddy (HTTPS),
- назначает админа (если передан телефон).

Первая сборка — 5–15 мин. По завершении:
- `https://kar-top.kz` — витрина,
- `https://kar-top.kz/api/health` — должен отдать ok.

---

## Шаг 5. Демо-данные (один раз, по желанию)

```bash
cd /opt/kar-top
docker compose --env-file .env.prod -f docker-compose.prod.yml exec api npx prisma db seed
```

---

## Шаг 6. Боевые ключи интеграций (когда появятся)

Править `/opt/kar-top/.env.prod` на сервере (значения **только на сервере**, не в чат):

| Переменная                 | Для чего                                           |
|----------------------------|----------------------------------------------------|
| `FIREBASE_SERVICE_ACCOUNT` | JSON сервис-аккаунта Firebase — включает реальные пуши |
| `EMAIL_API_KEY`            | отправка OTP на почту (дешевле SMS)                |
| `TELEGRAM_GATEWAY_TOKEN`   | OTP через Telegram                                 |
| `SMS_API_KEY`              | OTP по SMS (крайний канал)                         |
| `CORS_ORIGINS`             | домены, которым можно к API (по умолч. `*`)        |

`FIREBASE_SERVICE_ACCOUNT` вставлять одной строкой в кавычках:
```
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"kartop",...}'
```
После правки — перезапуск:
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

---

## Обновление версии (деплой нового кода)

```bash
cd /opt/kar-top
git pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

## Полезное

```bash
# логи
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f api
# состояние контейнеров
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
# место на диске
df -h /
```

## Сборка мобильного приложения под этот сервер

```bash
flutter build apk --dart-define=API_BASE=https://kar-top.kz/api
```
(API живёт на том же домене, Caddy отдаёт его по префиксу `/api`.)
