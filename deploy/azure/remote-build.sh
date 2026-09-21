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
export CM_DATABASE_URL="${CM_DATABASE_URL:-sqlserver://localhost:1433;database=cmp;user=sa;password=Placeholder_1;encrypt=true;trustServerCertificate=true}"

# Kudu's default node is 18; the app requires 22.
use_node22() {
  local dir
  shopt -s nullglob
  for dir in /opt/nodejs/22*/bin /usr/local/n/versions/node/22*/bin; do
    if [[ -x "${dir}/node" ]]; then
      export PATH="${dir}:${PATH}"
      echo "using ${dir}/node ($("${dir}/node" -v))"
      return 0
    fi
  done
  shopt -u nullglob
  echo "warning: Node 22 not found on PATH, using $(node -v)" >&2
}
use_node22

# Do not use Corepack: Kudu cannot write /usr/local/bin and the HOME shim
# is left without pnpm.cjs. Install a real pnpm under HOME.
rm -f "${HOME}/.local/bin/pnpm" "${HOME}/.local/bin/pnpx" || true
PNPM_PREFIX="${HOME}/.cmp-pnpm"
mkdir -p "${PNPM_PREFIX}"
npm install --prefix "${PNPM_PREFIX}" pnpm@12.5.1
export PATH="${PNPM_PREFIX}/node_modules/.bin:${PATH}"
hash -r

echo "pnpm $(pnpm --version) node $(node --version) in ${PWD}"
pnpm install --frozen-lockfile
pnpm build

test -f dist/main.js
echo "Azure remote build finished"
