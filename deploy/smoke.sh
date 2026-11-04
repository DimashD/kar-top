#!/usr/bin/env bash
# Smoke-тест окружения снаружи (из GitHub Actions):
#   bash deploy/smoke.sh https://test.kar-top.kz <ожидаемая_версия>
# Проверяет: API жив и это именно нужная версия; витрина и админка открываются.
set -uo pipefail
BASE="${1:?base url}"
WANT="${2:-}"
fail=0

check() { # name url expected-codes-regex
  local code; code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$2")"
  if [[ "$code" =~ ^($3)$ ]]; then echo "✔ $1 ($code)"; else echo "✘ $1: $2 → HTTP $code"; fail=1; fi
}

# 1) health с нужной версией (ждём до ~3 мин: выпуск сертификата / старт контейнеров).
ok=""
for _ in $(seq 1 18); do
  body="$(curl -s --max-time 10 "$BASE/api/health" || true)"
  if echo "$body" | grep -q '"status":"ok"' && { [ -z "$WANT" ] || echo "$body" | grep -q "\"version\":\"$WANT\""; }; then
    ok=1; break
  fi
  sleep 10
done
if [ -n "$ok" ]; then echo "✔ /api/health: $body"; else echo "✘ /api/health (ждали версию $WANT): ${body:-нет ответа}"; fail=1; fi

# 2) Ключевые страницы.
check "Главная"          "$BASE/"              "200"
check "Вход для магазина" "$BASE/partner"       "200|30[1278]"
check "Админка"          "$BASE/admin"         "200|30[1278]"
check "API: 404 на мусор" "$BASE/api/__nope__" "404"

exit $fail
