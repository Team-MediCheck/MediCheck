#!/usr/bin/env bash
set -euo pipefail
umask 077

DEPLOY_PATH="${DEPLOY_PATH:?DEPLOY_PATH must point to the private deployment environment directory}"
VERIFY_ONLY="${VERIFY_ONLY:-true}"
case "$VERIFY_ONLY" in true|false) ;; *) echo "VERIFY_ONLY must be true or false" >&2; exit 1 ;; esac
SOURCE_DIR="$(git rev-parse --show-toplevel)"
REVISION="$(git rev-parse HEAD)"

test -f "$DEPLOY_PATH/.env.local"
test -f "$DEPLOY_PATH/backend/server/.env.prod"
test -f "$SOURCE_DIR/docker-compose.local.yml"

for i in $(seq 1 36); do
  if docker info >/dev/null 2>&1; then break; fi
  if [[ "$i" == 1 ]]; then open -a Docker || true; fi
  sleep 5
done
docker info >/dev/null

# Build only committed source. Keep the operator's checkout and local files intact.
# Keep background Docker builds outside macOS-protected Desktop/Documents paths.
RELEASE_ROOT="${RELEASE_ROOT:-$HOME/.local/share/medicheck/releases}"
mkdir -p "$RELEASE_ROOT"
RELEASE_DIR="$(mktemp -d "$RELEASE_ROOT/${REVISION:0:12}.XXXXXX")"
git -C "$SOURCE_DIR" archive "$REVISION" | tar -x -C "$RELEASE_DIR"
cp "$DEPLOY_PATH/.env.local" "$RELEASE_DIR/.env.local"
cp "$DEPLOY_PATH/backend/server/.env.prod" "$RELEASE_DIR/backend/server/.env.prod"
chmod 600 "$RELEASE_DIR/.env.local" "$RELEASE_DIR/backend/server/.env.prod"

# The LaunchAgent cannot use the login keychain. Use a temporary Docker config
# with the same contexts, without modifying ~/.docker or another project's credentials.
ORIGINAL_DOCKER_CONFIG="${DOCKER_CONFIG:-$HOME/.docker}"
DOCKER_CONTEXT="$(docker context show)"
export DOCKER_CONTEXT
DOCKER_CONFIG="$(mktemp -d "${TMPDIR:-/tmp}/medicheck-docker.XXXXXX")"
export DOCKER_CONFIG
cleanup() {
  rm -rf "$DOCKER_CONFIG"
  if [[ "$VERIFY_ONLY" == true ]]; then rm -rf "$RELEASE_DIR"; fi
}
trap cleanup EXIT
printf '%s\n' '{}' > "$DOCKER_CONFIG/config.json"
for entry in contexts cli-plugins; do
  if [[ -d "$ORIGINAL_DOCKER_CONFIG/$entry" ]]; then
    ln -s "$ORIGINAL_DOCKER_CONFIG/$entry" "$DOCKER_CONFIG/$entry"
  fi
done

COMPOSE=(docker compose --project-name medicheck
  --project-directory "$RELEASE_DIR"
  --env-file "$RELEASE_DIR/.env.local"
  -f "$RELEASE_DIR/docker-compose.local.yml")
echo "Validating Compose configuration for $REVISION"
"${COMPOSE[@]}" config --quiet </dev/null
test "$(docker inspect --format '{{.State.Health.Status}}' medicheck-mysql)" = healthy

if [[ "$VERIFY_ONLY" == true ]]; then
  docker exec medicheck-backend curl -fsS http://127.0.0.1:8080/actuator/health
  echo "Verified revision $REVISION; no containers changed."
  exit 0
fi

# Finish both builds before replacing running services. MySQL and Caddy stay up.
"${COMPOSE[@]}" build backend frontend </dev/null
"${COMPOSE[@]}" up -d --no-deps --wait --wait-timeout 180 backend </dev/null
"${COMPOSE[@]}" up -d --no-deps --wait --wait-timeout 60 frontend </dev/null
docker exec medicheck-backend curl -fsS http://127.0.0.1:8080/actuator/health
docker exec medicheck-frontend wget -q -O /dev/null http://127.0.0.1:8080/
docker exec medicheck-frontend wget -q -O /dev/null http://127.0.0.1:8080/api/hospitals/search/symptom-keywords
printf '%s\n' "$REVISION" > "$RELEASE_DIR/DEPLOYED_COMMIT"
echo "Deployed $REVISION from $RELEASE_DIR"
