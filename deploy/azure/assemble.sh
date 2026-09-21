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
  rm -f "${dir}/oryx-manifest.toml" "${dir}/node_modules.tar.gz" "${dir}/.gitignore"
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

deref_node_modules() {
  local dir="$1"
  if [[ ! -d "${dir}/node_modules" ]]; then
    return 0
  fi
  find "${dir}/node_modules" -xtype l -print -delete || true
  local tmp
  tmp="$(mktemp -d)"
  set +e
  rsync -a --copy-links --exclude '.bin/' "${dir}/node_modules/" "${tmp}/"
  local rc=$?
  set -e
  if [[ "${rc}" -ne 0 && "${rc}" -ne 23 && "${rc}" -ne 24 ]]; then
    echo "rsync failed in ${dir} with ${rc}" >&2
    exit "${rc}"
  fi
  rm -rf "${dir}/node_modules"
  mv "${tmp}" "${dir}/node_modules"
}

rm -rf "${OUT}"
mkdir -p "${OUT}"
test -d "${ROOT}/azure-api"
cp -a "${ROOT}/azure-api/." "${OUT}/"
rm -rf "${OUT}/dist"
cp -a "${ROOT}/dist" "${OUT}/dist"
deref_node_modules "${OUT}"
copy_real_pkg tslib "${OUT}/node_modules"
copy_real_pkg @nestjs/core "${OUT}/node_modules"
copy_real_pkg @prisma/client "${OUT}/node_modules"
SRC_CLIENT="$(find "${ROOT}/node_modules/.pnpm" -type d -path '*@prisma+client@*/node_modules/.prisma/client' | head -1 || true)"
if [[ -n "${SRC_CLIENT}" ]]; then
  mkdir -p "${OUT}/node_modules/.prisma"
  rm -rf "${OUT}/node_modules/.prisma/client"
  cp -R "${SRC_CLIENT}" "${OUT}/node_modules/.prisma/client"
fi
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
test -f "${OUT}/node_modules/@nestjs/core/package.json"
test -f "${OUT}/node_modules/tslib/package.json"
echo "assembled ${OUT}"
