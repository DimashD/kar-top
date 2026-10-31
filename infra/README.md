# Инфраструктура

Персональные данные граждан РК хранятся в Казахстане (закон № 94-V, см. `docs/07-security-audit.md`).

- **prod/staging:** Yandex Cloud, регион Казахстан (`kz1`) — Managed Kubernetes + Managed PostgreSQL (PostGIS) + Redis. Ограничение: одна зона доступности `kz1-a`; резервные копии у второго провайдера в РК.
- **IaC:** Terraform (`infra/terraform`), деплой через Helm/ArgoCD (`infra/helm`).
- **Локально:** `docker compose up -d` (Postgres+PostGIS, Redis).
