# Built on the Home Assistant box itself when the app is installed.
ARG BUILD_FROM

FROM node:22-alpine AS web
WORKDIR /web
COPY config.yaml /config.yaml
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build:hub

FROM $BUILD_FROM
RUN apk add --no-cache nodejs
COPY server/ /app/
COPY --from=web /web/dist /app/www
CMD ["node", "/app/main.mjs"]
