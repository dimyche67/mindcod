#!/bin/bash
# =============================================================
#  deploy.sh — деплой приложения на сервер mindcod.ru
#  Запускать локально: bash deploy/deploy.sh
#
#  Требования:
#    - SSH доступ к серверу (ключ или пароль)
#    - На сервере уже запущен setup-server.sh
# =============================================================
set -e

SERVER="root@mindcod.ru"       # Поменяйте на IP если домен ещё не привязан
APP_DIR="/var/www/mindcod.ru"
DOMAIN="mindcod.ru"

echo "╔════════════════════════════════════╗"
echo "║  Деплой → $DOMAIN          ║"
echo "╚════════════════════════════════════╝"

# ── 1. Сборка фронтенда ───────────────────────────────────────
echo "→ [1/5] Сборка фронтенда..."
cd "$(dirname "$0")/.."
VITE_API_URL="" npm run build
echo "   ✓ Build готов в ./dist"

# ── 2. Архивирование ──────────────────────────────────────────
echo "→ [2/5] Архивирование..."
tar -czf /tmp/mindcod-dist.tar.gz dist/
tar -czf /tmp/mindcod-backend.tar.gz \
    backend/routes backend/middleware backend/database.js \
    backend/server.js backend/plans.js backend/package.json \
    deploy/ecosystem.config.js
echo "   ✓ Архивы созданы"

# ── 3. Загрузка на сервер ─────────────────────────────────────
echo "→ [3/5] Загрузка на сервер..."
scp /tmp/mindcod-dist.tar.gz $SERVER:/tmp/
scp /tmp/mindcod-backend.tar.gz $SERVER:/tmp/
scp backend/.env $SERVER:$APP_DIR/backend/.env 2>/dev/null || echo "   (!) .env нужно создать вручную на сервере"
echo "   ✓ Файлы загружены"

# ── 4. Распаковка и установка зависимостей ────────────────────
echo "→ [4/5] Установка на сервере..."
ssh $SERVER << ENDSSH
set -e
cd $APP_DIR

# Распаковка фронтенда
echo "   Распаковка фронтенда..."
rm -rf dist
tar -xzf /tmp/mindcod-dist.tar.gz

# Распаковка бэкенда
echo "   Распаковка бэкенда..."
mkdir -p backend
tar -xzf /tmp/mindcod-backend.tar.gz

# Копируем ecosystem
cp deploy/ecosystem.config.js .

# Установка зависимостей бэкенда
echo "   npm install..."
cd backend
npm install --production --silent
cd ..

# Создаём лог-директорию
mkdir -p /var/log/mindcod

echo "   ✓ Файлы установлены"
ENDSSH

# ── 5. Перезапуск приложения ──────────────────────────────────
echo "→ [5/5] Перезапуск приложения..."
ssh $SERVER << 'ENDSSH'
cd /var/www/mindcod.ru
pm2 delete mindcod-backend 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save
systemctl reload nginx
echo "   ✓ Приложение запущено"
pm2 status mindcod-backend
ENDSSH

echo ""
echo "══════════════════════════════════════"
echo "✅  Деплой завершён!"
echo "   Сайт: https://$DOMAIN"
echo "   API:  https://$DOMAIN/api/health"
echo "══════════════════════════════════════"
