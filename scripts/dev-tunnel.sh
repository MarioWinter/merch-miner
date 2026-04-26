#!/usr/bin/env bash
# scripts/dev-tunnel.sh
#
# Open SSH tunnel for local Merch Miner dev → server-side localai-stack.
# Forwards Mac:3000 → vane:3000 and Mac:11235 → crawl4ai:11235.
#
# Uses autossh for auto-reconnect on network drops / server restarts.
# Install: brew install autossh
#
# Container IPs are pulled fresh on each run (server may have restarted).
#
# Usage:
#   ./scripts/dev-tunnel.sh           # tunnel up (foreground, ctrl+c to stop)
#   ./scripts/dev-tunnel.sh -d        # detached (background, auto-reconnect)
#   ./scripts/dev-tunnel.sh stop      # kill any running tunnel
#   ./scripts/dev-tunnel.sh status    # check if tunnel is alive
#
# Env overrides:
#   SERVER_USER=root
#   SERVER_HOST=213.165.95.5
#   VANE_CONTAINER=vane
#   CRAWL4AI_CONTAINER=crawl4ai
#   VANE_LOCAL_PORT=3000
#   CRAWL4AI_LOCAL_PORT=11235

set -euo pipefail

SERVER_USER="${SERVER_USER:-root}"
SERVER_HOST="${SERVER_HOST:-213.165.95.5}"
VANE_CONTAINER="${VANE_CONTAINER:-vane}"
CRAWL4AI_CONTAINER="${CRAWL4AI_CONTAINER:-crawl4ai}"
VANE_LOCAL_PORT="${VANE_LOCAL_PORT:-3000}"
CRAWL4AI_LOCAL_PORT="${CRAWL4AI_LOCAL_PORT:-11235}"
VANE_REMOTE_PORT="${VANE_REMOTE_PORT:-3000}"
CRAWL4AI_REMOTE_PORT="${CRAWL4AI_REMOTE_PORT:-11235}"
PID_FILE="/tmp/merch-miner-dev-tunnel.pid"

stop_tunnel() {
  if [[ -f "$PID_FILE" ]]; then
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping tunnel (pid $pid)"
      kill "$pid" || true
    fi
    rm -f "$PID_FILE"
  fi
  # Also kill any orphan autossh/ssh tunnels matching our forward
  pkill -f "autossh.*-L ${VANE_LOCAL_PORT}:" 2>/dev/null || true
  pkill -f "ssh -N.*-L ${VANE_LOCAL_PORT}:" 2>/dev/null || true
  echo "Tunnel stopped."
}

status_tunnel() {
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "Tunnel running (pid $(cat "$PID_FILE"))"
    return 0
  fi
  if pgrep -f "autossh.*-L ${VANE_LOCAL_PORT}:" >/dev/null; then
    echo "Tunnel running (orphan autossh, no PID file)"
    return 0
  fi
  echo "Tunnel NOT running"
  return 1
}

if [[ "${1:-}" == "stop" ]]; then
  stop_tunnel
  exit 0
fi

if [[ "${1:-}" == "status" ]]; then
  status_tunnel
  exit $?
fi

if ! command -v autossh >/dev/null 2>&1; then
  echo "ERROR: autossh not installed. Install with: brew install autossh"
  exit 1
fi

DETACHED=0
if [[ "${1:-}" == "-d" || "${1:-}" == "--detach" ]]; then
  DETACHED=1
fi

echo "Resolving container IPs on ${SERVER_HOST}..."
VANE_IP=$(ssh "${SERVER_USER}@${SERVER_HOST}" \
  "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' ${VANE_CONTAINER}" \
  | awk '{print $1}')
CRAWL4AI_IP=$(ssh "${SERVER_USER}@${SERVER_HOST}" \
  "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' ${CRAWL4AI_CONTAINER}" \
  | awk '{print $1}')

if [[ -z "$VANE_IP" || -z "$CRAWL4AI_IP" ]]; then
  echo "ERROR: failed to resolve container IPs (Vane=$VANE_IP Crawl4ai=$CRAWL4AI_IP)"
  exit 1
fi

echo "Vane:     ${VANE_IP}:${VANE_REMOTE_PORT} → localhost:${VANE_LOCAL_PORT}"
echo "Crawl4ai: ${CRAWL4AI_IP}:${CRAWL4AI_REMOTE_PORT} → localhost:${CRAWL4AI_LOCAL_PORT}"

# Stop any existing tunnel before opening a new one
stop_tunnel >/dev/null 2>&1 || true

# autossh config:
#   AUTOSSH_GATETIME=0  → start reconnecting immediately on first failure
#                         (default 30s gate skips reconnect for short-lived runs)
#   -M 0                → disable autossh's monitoring port; rely on SSH keepalives
#   ServerAliveInterval → ping every 30s; drop after 3 missed → autossh reconnects
export AUTOSSH_GATETIME=0

SSH_OPTS=(
  -M 0
  -N
  -o "ServerAliveInterval=30"
  -o "ServerAliveCountMax=3"
  -o "ExitOnForwardFailure=yes"
  -L "${VANE_LOCAL_PORT}:${VANE_IP}:${VANE_REMOTE_PORT}"
  -L "${CRAWL4AI_LOCAL_PORT}:${CRAWL4AI_IP}:${CRAWL4AI_REMOTE_PORT}"
  "${SERVER_USER}@${SERVER_HOST}"
)

if [[ "$DETACHED" == "1" ]]; then
  autossh -f "${SSH_OPTS[@]}"
  # autossh -f forks; capture the parent autossh pid (not the ssh child)
  pgrep -f "autossh.*-L ${VANE_LOCAL_PORT}:${VANE_IP}" | head -1 > "$PID_FILE" || true
  echo "Tunnel up (detached, auto-reconnect). To stop: $0 stop"
else
  echo "Tunnel up (auto-reconnect). Ctrl+C to close."
  exec autossh "${SSH_OPTS[@]}"
fi
