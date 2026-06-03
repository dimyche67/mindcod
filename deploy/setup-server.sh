#!/bin/bash
# =============================================================
#  setup-server.sh — первичная настройка Ubuntu VPS для mindcod.ru
#  Запускать один раз от root: bash setup-server.sh
# =============================================================
set -e

DOMAIN="mindcod.ru"
APP_DIR="/var/www/$DOMAIN"
LOG_DIR="/var/log/mindcod"
NODE_VERSION="20"

echo "╔══════════════════════════════════════╗"
echo "║  Настройка сервера для $DOMAIN  ║"
echo "╚══════════════════════════════════════╝"

# ── 1. Обновление системы ─────────────────────────────────────
echo "→ Обновление пакетов..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Установка Node.js ──────────────────────────────────────
echo "→ Установка Node.js $NODE_VERSION..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

echo "   Node: $(node -v)"
echo "   npm:  $(npm -v)"

# ── 3. Установка PM2 ──────────────────────────────────────────
echo "→ Установка PM2..."
npm install -g pm2
pm2 startup systemd -u root --hp /root | tail -1 | bash

# ── 4. Установка nginx ────────────────────────────────────────
echo "→ Установка nginx..."
apt-get install -y nginx
systemctl enable nginx
systemctl start nginx

# ── 5. Установка certbot (SSL) ────────────────────────────────
echo "→ Установка certbot..."
apt-get install -y certbot python3-certbot-nginx

# ── 6. Установка git ─────────────────────────────────────────
apt-get install -y git

# ── 7. Директории ────────────────────────────────────────────
echo "→ Создание директорий..."
mkdir -p $APP_DIR $LOG_DIR
chmod 755 $APP_DIR

# ── 8. Nginx конфиг ──────────────────────────────────────────
echo "→ Настройка nginx..."
cat > /etc/nginx/sites-available/$DOMAIN << 'NGINXEOF'
server {
    listen 80;
    server_name mindcod.ru www.mindcod.ru;

    root /var/www/mindcod.ru/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|woff2?|png|jpg|svg|ico)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Api-Key";
        if ($request_method = OPTIONS) { return 204; }
    }

    client_max_body_size 20m;
}
NGINXEOF

ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx

# ── 9. Firewall ──────────────────────────────────────────────
echo "→ Настройка firewall..."
apt-get install -y ufw
ufw allow OpenSSH
ufw allow 'Nginx Full'
echo "y" | ufw enable

echo ""
echo "✅ Сервер готов!"
echo "   Следующий шаг: запустите deploy.sh для загрузки приложения"
echo "   Затем получите SSL: certbot --nginx -d mindcod.ru -d www.mindcod.ru"
