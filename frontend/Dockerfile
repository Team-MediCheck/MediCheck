FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_KAKAO_APP_KEY
ENV VITE_KAKAO_APP_KEY=${VITE_KAKAO_APP_KEY}
ARG VITE_KAKAO_OAUTH_REDIRECT_ORIGIN
ENV VITE_KAKAO_OAUTH_REDIRECT_ORIGIN=${VITE_KAKAO_OAUTH_REDIRECT_ORIGIN}

# Fail fast if compose/build args forgot to pass the Kakao JS key (Vite bakes it at build time).
RUN if [ -z "$VITE_KAKAO_APP_KEY" ]; then \
      echo "ERROR: VITE_KAKAO_APP_KEY build arg is empty. Rebuild with --env-file .env.local" >&2; \
      exit 1; \
    fi

RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.main.docker.conf /etc/nginx/nginx.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

RUN mkdir -p /tmp/nginx/client_body /tmp/nginx/proxy /tmp/nginx/fastcgi /tmp/nginx/uwsgi /tmp/nginx/scgi \
    && chown -R nginx:nginx /tmp/nginx

USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
