#!/usr/bin/env bash
# OCI Ampere A1 staging host bootstrap. Run after reviewing on a fresh Ubuntu 24.04 ARM64 VM.
# No public services are started, no SSH/firewall settings are weakened, and no keys are stored.
set -Eeuo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as: sudo bash deploy/oracle/prepare-ubuntu.sh" >&2
  exit 2
fi

if [[ ! -r /etc/os-release ]]; then
  echo "Cannot identify the installed Linux distribution." >&2
  exit 2
fi
# shellcheck disable=SC1091
source /etc/os-release
if [[ "${ID:-}" != "ubuntu" || "${VERSION_ID:-}" != "24.04" ]]; then
  echo "This bootstrap supports Ubuntu 24.04 LTS only." >&2
  exit 2
fi
if [[ "$(dpkg --print-architecture)" != "arm64" || "$(uname -m)" != "aarch64" ]]; then
  echo "Select Oracle VM.Standard.A1.Flex (ARM64), not an AMD micro instance." >&2
  exit 2
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl git gnupg
install -m 0755 -d /etc/apt/keyrings

# Docker's signed Ubuntu repository, rather than piping a remote script to bash.
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<DOCKER_SOURCES
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: arm64
Signed-By: /etc/apt/keyrings/docker.asc
DOCKER_SOURCES
apt-get update
apt-get install -y --no-install-recommends docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable --now docker
docker --version
docker compose version

cat <<'COMPLETE'
DPN // ORACLE ARM64 BASE HOST READY.
Next: create a staging DNS A record, configure OCI inbound rules for SSH from YOUR IP and TCP 80/443,
generate Caddy basic-auth credentials, then use deploy/staging/compose.yml.
Docker runs with sudo. Do not grant the ubuntu account the privileged docker group by default.
No MemeSpace application, payment process, or public listener was started by this script.
COMPLETE
