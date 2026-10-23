#!/usr/bin/env bash
# DPN launch gate — destructive only to uniquely named EPHEMERAL CI Docker resources.
# Validates a true named-volume container restart AND restore from an online SQLite snapshot.
set -Eeuo pipefail
if [[ "${CI:-}" != "true" || -z "${RUNNER_TEMP:-}" ]]; then
  echo "This is a GitHub Actions-only isolated test, not an operator backup command." >&2
  exit 2
fi
image=memespace:staging-ci
prefix="memespace-durability-${GITHUB_RUN_ID:-test}-${GITHUB_RUN_ATTEMPT:-1}"
container="${prefix}-app"
restored="${prefix}-restore"
data_volume="${prefix}-db"
restore_volume="${prefix}-restore-db"
workdir=$(mktemp -d "${RUNNER_TEMP}/memespace-durability-XXXXXXXX")
chmod 700 "$workdir"

cleanup(){
  local status=$?
  if (( status != 0 )); then
    echo "Durability gate failed. Container logs (last 80 lines):" >&2
    docker logs --tail=80 "$container" >&2 || true
    docker logs --tail=80 "$restored" >&2 || true
  fi
  docker rm -f "$container" "$restored" >/dev/null 2>&1 || true
  docker volume rm "$data_volume" "$restore_volume" >/dev/null 2>&1 || true
  rm -rf -- "$workdir"
  exit "$status"
}
trap cleanup EXIT
docker image inspect "$image" >/dev/null

wait_healthy(){
  local port="$1" ok=0
  for _ in $(seq 1 75); do
    if curl --fail --silent "http://127.0.0.1:${port}/api/health" | grep -q '"ok":true'; then
      ok=1;break
    fi
    sleep 2
  done
  test "$ok" -eq 1
}
start_app(){
  local name="$1" volume="$2" port="$3"
  docker run -d --name "$name" \
    -e MEMESPACE_PUBLIC_ORIGIN=https://staging.example.org \
    -e MEMESPACE_LAUNCH_SCOPE=beta \
    -e MEMESPACE_REGISTRATION_GATE=external \
    -v "$volume:/app/data" \
    -p "127.0.0.1:${port}:5173" \
    "$image" >/dev/null
  wait_healthy "$port"
}

docker volume create "$data_volume" >/dev/null
start_app "$container" "$data_volume" 5190
node scripts/staging-durability-e2e.mjs seed http://127.0.0.1:5190 "$workdir/fixture.json"

# SQLite backup() performs a consistent live snapshot even with WAL enabled.
docker exec "$container" node deploy/oracle/backup-sqlite.mjs
mkdir -p "$workdir/snapshots"
docker cp "$container:/app/data/snapshots/." "$workdir/snapshots/"
if ! compgen -G "$workdir/snapshots/*.sqlite" >/dev/null; then
  echo "No SQLite snapshot copied from live container" >&2
  exit 1
fi

echo "Recreating container over the original Docker named volume..."
docker rm -f "$container" >/dev/null
start_app "$container" "$data_volume" 5190
node scripts/staging-durability-e2e.mjs verify http://127.0.0.1:5190 "$workdir/fixture.json"

echo "Restoring the copied online SQLite snapshot into a FRESH named volume..."
docker volume create "$restore_volume" >/dev/null
docker run --rm --user 0 \
  -v "$restore_volume:/app/data" \
  -v "$workdir/snapshots:/snapshots:ro" \
  --entrypoint sh "$image" -ec 'set -- /snapshots/*.sqlite; test "$#" -eq 1; cp "$1" /app/data/memespace.sqlite; chown node:node /app/data/memespace.sqlite'
start_app "$restored" "$restore_volume" 5191
node scripts/staging-durability-e2e.mjs verify http://127.0.0.1:5191 "$workdir/fixture.json"
echo "PASS: named Docker volume restart and independent SQLite online-backup restore both verified"
