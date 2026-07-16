#!/bin/bash
set -euo pipefail

ROOT="/Users/snowrabbit123/Desktop/Medicheck/MediCheck"
DOCKER="/usr/local/bin/docker"
if [[ ! -x "$DOCKER" ]]; then
  DOCKER="/Applications/Docker.app/Contents/Resources/bin/docker"
fi
COMPOSE=("$DOCKER" compose -f "$ROOT/docker-compose.local.yml" --env-file "$ROOT/.env.local")

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Wait for Docker Desktop engine
for i in $(seq 1 60); do
  if "$DOCKER" info >/dev/null 2>&1; then
    break
  fi
  if [[ $i -eq 1 ]]; then
    log "Starting Docker Desktop..."
    open -a Docker || true
  fi
  sleep 5
done

if ! "$DOCKER" info >/dev/null 2>&1; then
  log "ERROR: Docker engine not ready"
  exit 1
fi

log "Bringing up MediCheck stack..."
cd "$ROOT"
"${COMPOSE[@]}" up -d --remove-orphans
log "Stack is up."
