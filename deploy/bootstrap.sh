#!/usr/bin/env bash
# Развёртывание FreshMarket/Kartop на чистом Ubuntu-VPS (PS.KZ).
# Запускать из корня репозитория:  sudo bash deploy/bootstrap.sh kar-top.kz admin@kar-top.kz
set -euo pipefail
DOMAIN="${1:?Укажите домен: bash deploy/bootstrap.sh kar-top.kz admin@kar-top.kz}"
EMAIL="${2:?Укажите e-mail для TLS}"

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
# Заполнить при подключении интеграций:
TELEGRAM_GATEWAY_TOKEN=
SMS_API_KEY=
KASPI_MERCHANT_ID=
KASPI_API_KEY=
ENV
  echo ".env.prod создан (секреты сгенерированы). Заполните ключи интеграций позже."
fi

# 3) Запуск (миграции применяются автоматически при старте api)
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build

echo "Готово. Витрина: https://${DOMAIN}  ·  API: https://${DOMAIN}/api/health"
echo "Первичный сид демо-магазина (один раз):"
echo "  docker compose --env-file .env.prod -f docker-compose.prod.yml exec api npx prisma db seed"
