#!/usr/bin/env bash
# Деплой готовых образов (из GHCR) в окружение. Запускается GitHub Actions на сервере:
#   bash deploy/deploy.sh <staging|production> <api_image> <web_image> <version>
# Окружение переменных (опционально): GHCR_USER, GHCR_TOKEN — чтобы скачать приватные образы;
#   STAGING_DOMAIN, ACME_EMAIL — для первичного создания .env.staging.
#
# Что делает:
#   1) прод: бэкап БД (pg_dump) перед обновлением, хранит последние 14;
#   2) pull образов + перезапуск (миграции применяются при старте api);
#   3) ждёт /api/health с нужной версией; если не дождался — откатывает на предыдущие образы.
set -euo pipefail

ENV_NAME="${1:?staging|production}"
NEW_API="${2:?api image}"
NEW_WEB="${3:?web image}"
NEW_VERSION="${4:?version}"

case "$ENV_NAME" in
  production)
    DIR=/opt/kar-top; ENV_FILE=.env.prod; COMPOSE_FILE=docker-compose.prod.yml
    PROJECT=kar-top; API_SVC=api; WEB_SVC=web ;;
  staging)
    DIR=/opt/kar-top-staging; ENV_FILE=.env.staging; COMPOSE_FILE=docker-compose.staging.yml
    PROJECT=kartop-staging; API_SVC=staging-api; WEB_SVC=staging-web ;;
  *) echo "Неизвестное окружение: $ENV_NAME"; exit 2 ;;
esac

cd "$DIR"
STATE_FILE=".deployed"          # API_IMAGE/WEB_IMAGE/APP_VERSION текущего релиза — для отката
BACKUP_DIR=/opt/kar-top-backups

docker network create kartop-edge >/dev/null 2>&1 || true

# Первичное создание секретов тестовой среды (один раз).
if [ "$ENV_NAME" = staging ] && [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<ENV
DOMAIN=${STAGING_DOMAIN:-test.kar-top.kz}
ACME_EMAIL=${ACME_EMAIL:-admin@kar-top.kz}
DB_PASSWORD=$(openssl rand -hex 24)
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
CORS_ORIGINS=*
# Код входа по телефону для тестировщиков (только в тестовой среде).
TEST_OTP_CODE=111111
# Интеграции: в тесте только sandbox-ключи или пусто (тогда заглушки).
SMTP_HOST=
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
KASPI_MERCHANT_ID=
KASPI_API_KEY=
FIREBASE_SERVICE_ACCOUNT=
ENV
  chmod 600 "$ENV_FILE"
  echo "Создан $DIR/$ENV_FILE (секреты тестовой среды сгенерированы)."
fi

# Если тестовая среда стоит на отдельном сервере (нет прод-Caddy) — поднимаем свой Caddy.
PROFILE_ARGS=()
if [ "$ENV_NAME" = staging ] && ! docker ps --format '{{.Names}}' | grep -qx 'kar-top-caddy-1'; then
  PROFILE_ARGS=(--profile standalone)
fi

compose() {
  docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "${PROFILE_ARGS[@]}" "$@"
}

health_version() {
  # В образе api нет curl — спрашиваем health изнутри контейнера через node.
  compose exec -T "$API_SVC" node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.json()).then(j=>console.log(j.status+' '+j.version)).catch(()=>console.log('down'))" 2>/dev/null || echo down
}

wait_healthy() {
  local want="$1"
  for _ in $(seq 1 36); do   # до ~3 минут (миграции + старт Nest)
    local got; got="$(health_version | tail -n1)"
    if [ "$got" = "ok $want" ]; then echo "health: $got"; return 0; fi
    sleep 5
  done
  echo "health не дождались (последний ответ: $(health_version | tail -n1))"
  return 1
}

up_with() {
  export API_IMAGE="$1" WEB_IMAGE="$2" APP_VERSION="$3"
  compose up -d --no-build
}

# Предыдущий релиз (для отката).
PREV_API=""; PREV_WEB=""; PREV_VERSION=""
if [ -f "$STATE_FILE" ]; then
  # shellcheck disable=SC1090
  . "./$STATE_FILE"
  PREV_API="${API_IMAGE:-}"; PREV_WEB="${WEB_IMAGE:-}"; PREV_VERSION="${APP_VERSION:-}"
fi

if [ -n "${GHCR_TOKEN:-}" ]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-github}" --password-stdin >/dev/null
fi
trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT

docker pull "$NEW_API"
docker pull "$NEW_WEB"

# Бэкап прод-БД перед миграциями.
if [ "$ENV_NAME" = production ] && [ -n "$(compose ps -q db 2>/dev/null)" ]; then
  mkdir -p "$BACKUP_DIR"
  f="$BACKUP_DIR/prod-$(date +%Y%m%d-%H%M%S)-${NEW_VERSION}.sql.gz"
  compose exec -T db pg_dump -U freshmarket freshmarket | gzip > "$f"
  echo "Бэкап БД: $f ($(du -h "$f" | cut -f1))"
  ls -1t "$BACKUP_DIR"/prod-*.sql.gz | tail -n +15 | xargs -r rm -f
fi

echo "Деплой $ENV_NAME: $NEW_VERSION (было: ${PREV_VERSION:-нет данных})"
up_with "$NEW_API" "$NEW_WEB" "$NEW_VERSION"

if wait_healthy "$NEW_VERSION"; then
  printf 'API_IMAGE=%s\nWEB_IMAGE=%s\nAPP_VERSION=%s\n' "$NEW_API" "$NEW_WEB" "$NEW_VERSION" > "$STATE_FILE"
  # Выкладок много (тест — десятки в день): неиспользуемые образы старше суток удаляем, иначе кончается диск.
  docker image prune -af --filter "until=24h" >/dev/null 2>&1 || true
  docker builder prune -af >/dev/null 2>&1 || true
  echo "Deploy OK: $ENV_NAME $NEW_VERSION"
  exit 0
fi

echo "::error::Новая версия не поднялась. Логи api:"
compose logs --tail=80 "$API_SVC" || true
if [ -n "$PREV_API" ]; then
  echo "Откат на $PREV_VERSION…"
  up_with "$PREV_API" "$PREV_WEB" "$PREV_VERSION"
  wait_healthy "$PREV_VERSION" && echo "Откат выполнен: работает $PREV_VERSION" || echo "::error::Откат тоже не поднялся — нужна ручная проверка!"
else
  echo "Предыдущей версии для отката нет (первый деплой через образы)."
fi
exit 1
