FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# Монорепозиторий: единый lock в корне, здесь ставим по package.json.
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
EXPOSE 3001
CMD ["npm", "start"]
