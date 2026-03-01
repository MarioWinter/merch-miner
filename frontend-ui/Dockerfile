FROM node:20-alpine AS builder
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile
COPY . .
RUN npm run build

FROM alpine:3.20
COPY --from=builder /app/dist /data/dist
CMD ["sh", "-c", "cp -r /data/dist/. /srv/frontend/ && echo 'Frontend dist seeded'"]
