#!/usr/bin/env bash
# You By What You Eat – Community-Server auf Raspberry Pi OS (oder jedem Debian/Ubuntu) installieren bzw. aktualisieren.
# Aufruf auf dem Pi:  curl -fsSL https://raw.githubusercontent.com/quitboy69/cookbook/ccr-fce936a5-5m15u6/you-by-what-you-eat/server/install.sh | bash
set -euo pipefail
BRANCH="${YBWYE_BRANCH:-ccr-fce936a5-5m15u6}"
BASE="https://raw.githubusercontent.com/quitboy69/cookbook/${BRANCH}/you-by-what-you-eat/server"
DIR=/opt/ybwye
PORT="${YBWYE_PORT:-8787}"

echo "==> 1/4 Node.js prüfen"
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  sudo apt-get update -qq && sudo apt-get install -y nodejs
fi
echo "    Node $(node -v)"

echo "==> 2/4 Server-Dateien laden"
sudo mkdir -p "$DIR/data"
sudo curl -fsSL "$BASE/server.js" -o "$DIR/server.js"
sudo curl -fsSL "$BASE/package.json" -o "$DIR/package.json"
id ybwye >/dev/null 2>&1 || sudo useradd --system --home-dir "$DIR" --shell /usr/sbin/nologin ybwye
sudo chown -R ybwye:ybwye "$DIR"

echo "==> 3/4 Dienst einrichten (startet automatisch beim Hochfahren)"
sudo tee /etc/systemd/system/ybwye.service >/dev/null <<UNIT
[Unit]
Description=You By What You Eat – Community-Server
After=network-online.target
Wants=network-online.target

[Service]
User=ybwye
WorkingDirectory=$DIR
Environment=PORT=$PORT
Environment=YBWYE_DATA=$DIR/data
ExecStart=$(command -v node) $DIR/server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DIR/data
MemoryMax=400M

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable ybwye >/dev/null 2>&1
sudo systemctl restart ybwye
sleep 3

echo "==> 4/4 Test"
if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null; then echo "    Server läuft ✓  (http://$(hostname -I | awk '{print $1}'):$PORT)"; else echo "    Server antwortet nicht – Log: sudo journalctl -u ybwye -n 50"; fi
echo
sudo -u ybwye env YBWYE_DATA="$DIR/data" node "$DIR/server.js" --invite
echo
echo "Nächster Schritt: von außen erreichbar machen (Tailscale Funnel), siehe ANLEITUNG.md"
