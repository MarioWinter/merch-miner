FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile

FROM base AS dev
COPY . .
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM base AS build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
COPY . .
RUN npm run build

FROM caddy:2-alpine AS prod
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
