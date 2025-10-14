#!/bin/sh
set -eu

TEMPLATE="/coturn/config/turnserver.conf.tmpl"
OUT="/etc/turnserver.conf"

: "${COTURN_REALM:=platform.ai-center.online}"
: "${COTURN_USER:=test}"
: "${COTURN_PASS:=test}"
: "${COTURN_PORT:=3478}"
: "${COTURN_TLS_PORT:=5349}"
: "${COTURN_MIN_PORT:=49160}"
: "${COTURN_MAX_PORT:=49200}"
: "${COTURN_EXTERNAL_IP:=}"
# --- AUTODETECT INTERNAL IP FOR COTURN ---------------------------------------
# Приоритет источников:
# 1) Явно заданный COTURN_INTERNAL_IP (не трогаем)
# 2) S_INTERNAL_IP (из .env)
# 3) ip route get 1.1.1.1 | awk '/src/ {print $7}'
# 4) hostname -I  -> берём первый RFC1918/100.64/10
# 5) ip -4 -o addr show scope global
# 6) ifconfig

: "${COTURN_INTERNAL_IP:=}"
: "${COTURN_DETECT_DEBUG:=0}"

if [ -z "${COTURN_INTERNAL_IP}" ]; then
  if [ -n "${S_INTERNAL_IP:-}" ]; then
    COTURN_INTERNAL_IP="${S_INTERNAL_IP}"
  else
    # 3) ip route get (если доступен)
    if command -v ip >/dev/null 2>&1; then
      COTURN_INTERNAL_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '/src/ {print $7; exit}')"
    fi

    # 4) hostname -I (busybox/util-linux)
    if [ -z "${COTURN_INTERNAL_IP}" ] && command -v hostname >/dev/null 2>&1; then
      for a in $(hostname -I 2>/dev/null || true); do
        case "$a" in
          127.*) continue ;;
          10.*|192.168.*|172.16.*|172.17.*|172.18.*|172.19.*|172.2[0-9].*|172.30.*|172.31.*|100.6[4-9].*|100.[7-9][0-9].*|100.1[0-1][0-9].*|100.12[0-7].*)
            COTURN_INTERNAL_IP="$a"; break ;;
        esac
      done
    fi

    # 5) ip -4 -o addr show (если доступен)
    if [ -z "${COTURN_INTERNAL_IP}" ] && command -v ip >/dev/null 2>&1; then
      COTURN_INTERNAL_IP="$(ip -4 -o addr show scope global 2>/dev/null | awk '{split($4,a,"/"); print a[1]; exit}')"
    fi

    # 6) ifconfig (как последний шанс)
    if [ -z "${COTURN_INTERNAL_IP}" ] && command -v ifconfig >/dev/null 2>&1; then
      COTURN_INTERNAL_IP="$(ifconfig 2>/dev/null | awk '/inet (addr:)?/ && $2 !~ /^127/ {sub("addr:","",$2); print $2; exit}')"
    fi
  fi
fi

[ "${COTURN_DETECT_DEBUG}" = "1" ] && echo "coturn: detected internal ip: ${COTURN_INTERNAL_IP:-<none>}" >&2

export COTURN_INTERNAL_IP

COTURN_EXTERNAL_BLOCK=""
if [ -n "${COTURN_EXTERNAL_IP:-}" ] && [ -n "${COTURN_INTERNAL_IP:-}" ]; then
  COTURN_EXTERNAL_BLOCK="external-ip=${COTURN_EXTERNAL_IP}/${COTURN_INTERNAL_IP}"
elif [ -n "${COTURN_EXTERNAL_IP:-}" ]; then
  COTURN_EXTERNAL_BLOCK="external-ip=${COTURN_EXTERNAL_IP}"
fi
export COTURN_EXTERNAL_BLOCK

mkdir -p "$(dirname "$OUT")"

if command -v envsubst >/dev/null 2>&1; then
  envsubst < "$TEMPLATE" > "$OUT"
else
  # Фолбэк без envsubst: построчно раскрываем ${VARS} через eval+printf (POSIX).
  : > "$OUT"
  while IFS= read -r line || [ -n "$line" ]; do
    eval "printf '%s\n' \"$line\"" >> "$OUT"
  done < "$TEMPLATE"
fi

TURN_BIN="$(command -v turnserver || echo /usr/bin/turnserver)"
exec "$TURN_BIN" -c "$OUT" -f

