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

# Kudu's default node is 18. Prisma 7 needs 20.19+, 22.12+, or 24+.
node_is_new_enough() {
  local raw maj min
  raw="$(node -v 2>/dev/null || echo v0.0.0)"
  raw="${raw#v}"
  maj="${raw%%.*}"
  min="${raw#*.}"
  min="${min%%.*}"
  if [[ "${maj}" -gt 22 ]]; then
    return 0
  fi
  if [[ "${maj}" -eq 22 && "${min}" -ge 12 ]]; then
    return 0
  fi
  if [[ "${maj}" -eq 20 && "${min}" -ge 19 ]]; then
    return 0
  fi
  return 1
}

use_node22() {
  local dir
  shopt -s nullglob
  for dir in /opt/nodejs/22*/bin /usr/local/n/versions/node/22*/bin "${HOME}/.node22/bin"; do
    if [[ -x "${dir}/node" ]]; then
      export PATH="${dir}:${PATH}"
      echo "using ${dir}/node ($("${dir}/node" -v))"
      shopt -u nullglob
      return 0
    fi
  done
  shopt -u nullglob

  if node_is_new_enough; then
    echo "using PATH node $(node -v)"
    return 0
  fi

  local ver="22.16.0"
  local prefix="${HOME}/.node22"
  if [[ -x "${prefix}/bin/node" ]]; then
    export PATH="${prefix}/bin:${PATH}"
    echo "using cached ${prefix}/bin/node ($(node -v))"
    return 0
  fi
  echo "Kudu node is $(node -v); downloading Node ${ver} into ${prefix}"
  mkdir -p "${prefix}"
  curl -fsSL "https://nodejs.org/dist/v${ver}/node-v${ver}-linux-x64.tar.gz" \
    | tar -xz -C "${prefix}" --strip-components=1
  export PATH="${prefix}/bin:${PATH}"
  echo "using ${prefix}/bin/node ($(node -v))"
}
use_node22

if ! node_is_new_enough; then
  echo "Node $(node -v) is too old for Prisma 7" >&2
  exit 1
fi

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
