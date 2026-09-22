#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

DEVICE="${1:-Quarto}"
PORT="${SRHELL_CAST_PORT:-8787}"
DIR="${HOME}/.srhell-cast"
BASE="https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/cast"

if command -v pkg >/dev/null 2>&1; then
  pkg install -y python curl >/dev/null
fi

python -m pip install -U catt >/dev/null 2>&1
mkdir -p "$DIR"

curl -fsSL "$BASE/classic.html" -o "$DIR/classic.html"
curl -fsSL "$BASE/server.py" -o "$DIR/server.py"

if [ -f "$DIR/server.pid" ]; then
  OLD_PID="$(cat "$DIR/server.pid" 2>/dev/null || true)"
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" 2>/dev/null || true
    sleep 0.4
  fi
fi

(
  cd "$DIR"
  nohup env SRHELL_CAST_PORT="$PORT" python server.py >server.log 2>&1 &
  echo $! >server.pid
)

sleep 1
IP="$(python - <<'PY'
import socket
s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)
try:
    s.connect(("8.8.8.8",80))
    print(s.getsockname()[0])
finally:
    s.close()
PY
)"
URL="http://$IP:$PORT/"

printf '\nSRHELL Classic: %s\n' "$URL"
printf 'Chromecast: %s\n\n' "$DEVICE"

catt -d "$DEVICE" cast_site "$URL"

if command -v termux-open-url >/dev/null 2>&1; then
  termux-open-url "$URL" >/dev/null 2>&1 || true
fi

printf '\nAbra o mesmo link no navegador para trocar o M3U e selecionar categorias.\n'
printf 'Ao tocar em Atualizar, o Chromecast recebe a nova configuração automaticamente.\n'
