#!/usr/bin/env bash
set -euo pipefail
archive="$HOME/elara-site.tar.gz"
site=/etc/nginx/conf.d/elara-fichas.conf
release="/var/www/elara-fichas/releases/$(date +%Y%m%d%H%M%S)"
test -f "$archive"
if sudo test -e "$site"; then
  echo "A configuração $site já existe. Nenhuma alteração feita."
  exit 1
fi
if sudo ss -ltn | awk '{print $4}' | grep -q ':8088$'; then
  echo 'A porta 8088 já está em uso. Nenhuma alteração feita.'
  exit 1
fi
sudo mkdir -p "$release"
sudo tar -xzf "$archive" -C "$release" --no-same-owner
sudo find "$release" -type d -exec chmod 755 {} +
sudo find "$release" -type f -exec chmod 644 {} +
sudo tee "$site" >/dev/null <<EOF
server {
    listen 100.124.152.1:8088;
    server_name _;
    root $release;
    index index.html;
    location / { try_files \$uri \$uri/ /index.html; }
    location /assets/ { try_files \$uri =404; }
    location = /index.html { add_header Cache-Control "no-cache"; }
}
EOF
if ! sudo nginx -t; then
  sudo rm -- "$site"
  echo 'Configuração rejeitada; Nginx não foi recarregado.'
  exit 1
fi
sudo systemctl reload nginx
curl --fail --silent --output /dev/null http://100.124.152.1:8088/
echo 'Publicado: http://100.124.152.1:8088 (Tailscale)'
