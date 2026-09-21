#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${ROOT}/azure-site-api"

write_deploy_meta() {
  local dir="$1"
  cat > "${dir}/.deployment" <<'EOF'
[config]
SCM_DO_BUILD_DURING_DEPLOYMENT=false
EOF
  rm -f "${dir}/oryx-manifest.toml" "${dir}/node_modules.tar.gz"
}

copy_real_pkg() {
  local name="$1"
  local dest_parent="$2"
  local optional="${3:-}"
  local pkg_json
  pkg_json="$(find "${ROOT}/node_modules/.pnpm" -path "*/node_modules/${name}/package.json" | head -1 || true)"
  if [[ -z "${pkg_json}" ]]; then
    if [[ -n "${optional}" ]]; then
      echo "skip missing optional ${name}"
      return 0
    fi
    echo "missing ${name} in pnpm store" >&2
    exit 1
  fi
  mkdir -p "${dest_parent}"
  rm -rf "${dest_parent}/${name}"
  mkdir -p "$(dirname "${dest_parent}/${name}")"
  cp -aL "$(dirname "${pkg_json}")" "${dest_parent}/${name}"
  echo "real copy ${name} -> ${dest_parent}/${name}"
}

rm -rf "${OUT}"
mkdir -p "${OUT}"
test -d "${ROOT}/azure-api"
cp -a "${ROOT}/azure-api/." "${OUT}/"
copy_real_pkg tslib "${OUT}/node_modules"
cat > "${OUT}/package.json" <<'EOF'
{
  "name": "consent_api",
  "private": true,
  "author": "saibrandingarc",
  "scripts": { "start": "node dist/main.js" },
  "engines": { "node": "22.x" }
}
EOF
write_deploy_meta "${OUT}"
test -f "${OUT}/dist/main.js"
test -f "${OUT}/node_modules/tslib/package.json"
echo "assembled ${OUT}"
