FROM node:20-alpine AS build
# Не /app: у сайта есть страница /app, и при сборке в каталоге /app Next.js подменял главную
# страницу страницей «Приложение». Рабочий каталог с другим именем снимает конфликт.
WORKDIR /srv/web
COPY package*.json ./
# Монорепозиторий: единый lock в корне, здесь ставим по package.json.
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build
FROM node:20-alpine
WORKDIR /srv/web
COPY --from=build /srv/web/.next ./.next
COPY --from=build /srv/web/node_modules ./node_modules
COPY --from=build /srv/web/package.json ./
COPY --from=build /srv/web/next.config.js ./
COPY --from=build /srv/web/public ./public
EXPOSE 3001
CMD ["npm", "start"]
