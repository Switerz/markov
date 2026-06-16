# syntax=docker/dockerfile:1.7

# --- Stage 1: deps ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY gograph/frontend/package.json gograph/frontend/package-lock.json ./
RUN npm ci

# --- Stage 2: build (used by prod profile) ---
FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=${VITE_API_BASE}
COPY --from=deps /app/node_modules ./node_modules
COPY gograph/frontend/ ./
RUN npm run build

# --- Stage 3: dev (used by dev profile) ---
FROM node:22-alpine AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY gograph/frontend/ ./
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --- Stage 4: prod runtime (nginx serving dist) ---
FROM nginx:1.27-alpine AS prod
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null || exit 1
