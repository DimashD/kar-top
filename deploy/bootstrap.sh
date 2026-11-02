#!/usr/bin/env bash
# Развёртывание Kartop на чистом Ubuntu-VPS.
# Запускать из корня репозитория:
#   sudo bash deploy/bootstrap.sh <домен> <email-для-TLS> [телефон-админа]
# Пример (с автоназначением сотрудника платформы):
#   sudo bash deploy/bootstrap.sh kar-top.kz admin@kar-top.kz +77011115999
set -euo pipefail
DOMAIN="${1:?Укажите домен: bash deploy/bootstrap.sh kar-top.kz admin@kar-top.kz}"
EMAIL="${2:?Укажите e-mail для TLS}"
ADMIN_PHONE="${3:-}"   # необязательно: телефон, которому выдать роль PLATFORM_ADMIN
COMPOSE="docker compose --env-file .env.prod -f docker-compose.prod.yml"

# 0) Swap (для сборки на 2 ГБ RAM — иначе next/nest build может упасть по памяти)
if [ ! -f /swapfile ] && [ "$(free -m | awk '/^Mem:/{print $2}')" -lt 3000 ]; then
  echo "Создаю swap 2G…"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 1) Docker
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

# 2) Секреты в .env.prod (генерируются один раз)
if [ ! -f .env.prod ]; then
  cat > .env.prod <<ENV
DOMAIN=${DOMAIN}
ACME_EMAIL=${EMAIL}
DB_PASSWORD=$(openssl rand -hex 24)
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
CORS_ORIGINS=*
# Заполнить при подключении интеграций:
TELEGRAM_GATEWAY_TOKEN=
SMS_API_KEY=
EMAIL_API_KEY=
KASPI_MERCHANT_ID=
KASPI_API_KEY=
# Push (FCM): сюда — JSON сервис-аккаунта Firebase ОДНОЙ строкой в кавычках, например:
# FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"kartop",...}'
FIREBASE_SERVICE_ACCOUNT=
ENV
  echo ".env.prod создан (секреты сгенерированы). Заполните ключи интеграций позже."
fi

# 3) Запуск (миграции применяются автоматически при старте api)
$COMPOSE up -d --build

# 4) Назначить сотрудника платформы (роль для входа в /admin/*), если передан телефон.
#    Ждём, пока api поднимется и применит миграции — повторяем grant, пока не сработает.
if [ -n "$ADMIN_PHONE" ]; then
  echo "Назначаю сотрудника платформы: ${ADMIN_PHONE} (жду старт API)…"
  granted=""
  for _ in $(seq 1 40); do
    if $COMPOSE exec -T api node prisma/grant-admin.js "$ADMIN_PHONE" 2>/dev/null; then granted=1; break; fi
    sleep 5
  done
  [ -n "$granted" ] || echo "⚠ Админа не удалось назначить автоматически. Позже: $COMPOSE exec api node prisma/grant-admin.js ${ADMIN_PHONE}"
fi

echo ""
echo "Готово. Витрина: https://${DOMAIN}  ·  API: https://${DOMAIN}/api/health"
[ -n "$ADMIN_PHONE" ] && echo "Админка заявок: https://${DOMAIN}/admin/partners  (вход по ${ADMIN_PHONE})"
echo "Первичный сид демо-магазина (по желанию, один раз):"
echo "  $COMPOSE exec api npx prisma db seed"
