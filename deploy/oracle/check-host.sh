#!/usr/bin/env bash
# Non-destructive ARM64/Compose readiness check. Does not print staging secrets.
set -Eeuo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"

if [[ "$(uname -m)" != "aarch64" ]]; then
  echo "Oracle A1 readiness failed: aarch64 host required, found $(uname -m)" >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed. Run the reviewed OCI prep script." >&2
  exit 1
fi
if ! sudo docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is unavailable or sudo cannot access it." >&2
  exit 1
fi
if [[ ! -f deploy/staging/.env ]]; then
  echo "Missing protected deploy/staging/.env; see docs/oracle-cloud-deployment.md." >&2
  exit 1
fi

# Interpolation validation happens without showing any full env or hashed password.
sudo docker compose --env-file deploy/staging/.env -f deploy/staging/compose.yml config --quiet
echo "Host architecture: $(uname -m)"
echo "Reviewed checkout: $(git rev-parse --short=12 HEAD)"
df -h .
echo "Compose config: valid. Staging services NOT started by this check."
