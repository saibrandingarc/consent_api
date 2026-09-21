#!/usr/bin/env bash
# Runs on Azure App Service (Kudu/Oryx) after the source zip is extracted.
set -euo pipefail

SOURCE="${DEPLOYMENT_SOURCE:-.}"
TARGET="${DEPLOYMENT_TARGET:-${SOURCE}}"

if [[ "${SOURCE}" != "${TARGET}" && -d "${SOURCE}" ]]; then
  mkdir -p "${TARGET}"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete --exclude node_modules --exclude dist "${SOURCE}/" "${TARGET}/"
  else
    cp -a "${SOURCE}/." "${TARGET}/"
  fi
fi

cd "${TARGET}"

export CI=true
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export NODE_ENV="${NODE_ENV:-production}"
# prisma generate needs a URL; App Service injects CM_DATABASE_URL when set.
export CM_DATABASE_URL="${CM_DATABASE_URL:-sqlserver://localhost:1433;database=cmp;user=sa;password=Placeholder_1;encrypt=true;trustServerCertificate=true}"

# Kudu cannot symlink into /usr/local/bin (EACCES). Put Corepack shims in HOME.
PNPM_BIN="${HOME}/.local/bin"
mkdir -p "${PNPM_BIN}"
export PATH="${PNPM_BIN}:${PATH}"
export COREPACK_HOME="${HOME}/.cache/corepack"
mkdir -p "${COREPACK_HOME}"
set +e
corepack enable --install-directory "${PNPM_BIN}"
corepack prepare pnpm@12.5.1 --activate
set -e

if ! command -v pnpm >/dev/null 2>&1; then
  npm install --prefix "${HOME}/.cmp-pnpm" pnpm@12.5.1
  export PATH="${HOME}/.cmp-pnpm/node_modules/.bin:${PATH}"
fi

echo "pnpm $(pnpm --version) node $(node --version) in ${PWD}"
pnpm install --frozen-lockfile
pnpm build

test -f dist/main.js
echo "Azure remote build finished"
