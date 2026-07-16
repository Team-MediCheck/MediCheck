#!/bin/bash
# Install GitHub Actions self-hosted runner for MediCheck Mac Mini deploy.
# Usage:
#   export GH_TOKEN=ghp_...   # repo admin PAT with admin:repo_hook or repo scope
#   ./scripts/macos/install-github-runner.sh
#
# Or with a one-time registration token:
#   export RUNNER_TOKEN=...
#   ./scripts/macos/install-github-runner.sh

set -euo pipefail

REPO="Team-MediCheck/MediCheck"
RUNNER_DIR="${HOME}/actions-runner"
RUNNER_VERSION="${RUNNER_VERSION:-2.335.1}"
LABELS="self-hosted,macOS,medicheck,arm64"
NAME="${RUNNER_NAME:-medicheck-macmini}"
ARCH="osx-arm64"

GH_BIN="${GH_BIN:-$(command -v gh || true)}"
if [[ -z "${GH_BIN}" && -x "${HOME}/.local/bin/gh" ]]; then
  GH_BIN="${HOME}/.local/bin/gh"
fi

mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

if [[ ! -f ./config.sh ]]; then
  echo "Downloading actions-runner ${RUNNER_VERSION} (${ARCH})..."
  curl -fsSL -o actions-runner.tar.gz \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-${ARCH}-${RUNNER_VERSION}.tar.gz"
  tar xzf actions-runner.tar.gz
  rm -f actions-runner.tar.gz
fi

if [[ -z "${RUNNER_TOKEN:-}" ]]; then
  if [[ -z "${GH_TOKEN:-}" && -n "${GH_BIN}" ]]; then
    # Prefer gh auth if already logged in
    if "${GH_BIN}" auth status >/dev/null 2>&1; then
      RUNNER_TOKEN="$("${GH_BIN}" api -X POST "repos/${REPO}/actions/runners/registration-token" --jq .token)"
    fi
  fi
  if [[ -z "${RUNNER_TOKEN:-}" && -n "${GH_TOKEN:-}" ]]; then
    RUNNER_TOKEN="$(curl -fsSL -X POST \
      -H "Authorization: Bearer ${GH_TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/${REPO}/actions/runners/registration-token" | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')"
  fi
fi

if [[ -z "${RUNNER_TOKEN:-}" ]]; then
  echo "RUNNER_TOKEN or GH_TOKEN required (or run: gh auth login)."
  echo "Create token at: https://github.com/${REPO}/settings/actions/runners/new"
  exit 1
fi

if [[ -f .runner ]]; then
  echo "Runner already configured (.runner exists). Skipping config."
else
  ./config.sh --unattended \
    --url "https://github.com/${REPO}" \
    --token "${RUNNER_TOKEN}" \
    --name "${NAME}" \
    --labels "${LABELS}" \
    --work "_work" \
    --replace
fi

# User LaunchAgent service (login session)
./svc.sh uninstall 2>/dev/null || true
./svc.sh install
./svc.sh start

echo "Runner installed and started."
./svc.sh status || true
