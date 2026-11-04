// Регистрирует в Firebase (проект из FIREBASE_SERVICE_ACCOUNT) Android-приложение тестовой сборки
// kz.kartop.kartop_merchant.staging (если его ещё нет) и печатает его google-services.json.
// Запуск — внутри прод-контейнера api (там есть сервис-аккаунт), через workflow «Server ops»:
//   docker compose ... exec -T api node - < deploy/ops/firebase-staging-app.js
// Без зависимостей: OAuth-токен по JWT сервис-аккаунта (node:crypto), Firebase Management API v1beta1.
const { createSign } = require('node:crypto');

const PACKAGE = process.env.STAGING_PACKAGE || 'kz.kartop.kartop_merchant.staging';
const DISPLAY = 'Kartop ТЕСТ (staging)';
const API = 'https://firebase.googleapis.com/v1beta1';

async function token(sa) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${unsigned}.${sig}`,
  });
  if (!r.ok) throw new Error(`oauth ${r.status}: ${await r.text()}`);
  return (await r.json()).access_token;
}

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT не задан в .env.prod');
  const sa = JSON.parse(raw);
  const project = sa.project_id;
  const t = await token(sa);
  const call = async (method, url, body) => {
    const r = await fetch(url, {
      method,
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`${method} ${url} → ${r.status}: ${text}`);
    return text ? JSON.parse(text) : {};
  };

  const list = await call('GET', `${API}/projects/${project}/androidApps?pageSize=100`);
  let app = (list.apps || []).find((a) => a.packageName === PACKAGE);
  if (app) {
    console.log(`Приложение уже есть: ${app.appId}`);
  } else {
    console.log(`Создаю Android-приложение ${PACKAGE} в проекте ${project}…`);
    let op = await call('POST', `${API}/projects/${project}/androidApps`, { packageName: PACKAGE, displayName: DISPLAY });
    for (let i = 0; i < 30 && !op.done; i++) {
      await new Promise((res) => setTimeout(res, 2000));
      op = await call('GET', `${API}/${op.name}`);
    }
    if (!op.done) throw new Error('Firebase не завершил создание приложения за 60 с');
    if (op.error) throw new Error(`Ошибка создания: ${JSON.stringify(op.error)}`);
    app = op.response;
    console.log(`Создано: ${app.appId}`);
  }

  const cfg = await call('GET', `${API}/projects/${project}/androidApps/${app.appId}/config`);
  const json = Buffer.from(cfg.configFileContents, 'base64').toString('utf8');
  // google-services.json не секрет (он и так лежит в приложении) — печатаем, чтобы закоммитить.
  console.log(`STAGING_APP_ID=${app.appId}`);
  console.log('-----BEGIN google-services.json-----');
  console.log(json);
  console.log('-----END google-services.json-----');
}

main().catch((e) => {
  console.error(`ОШИБКА: ${e.message}`);
  process.exit(1);
});
