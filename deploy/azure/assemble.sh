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
  rm -f "${dir}/.gitignore"
}

pnpm_store_prefix() {
  local name="$1"
  if [[ "${name}" == @*/* ]]; then
    echo "${name/\//+}"
  else
    echo "${name}"
  fi
}

copy_real_pkg() {
  local name="$1"
  local dest_parent="$2"
  local optional="${3:-}"
  local pkg_json
  local prefix
  prefix="$(pnpm_store_prefix "${name}")"
  # Prefer the package's own .pnpm folder so a nested v2 copy (e.g. under
  # @exodus/bytes) does not overwrite pdfkit's @noble/hashes v1 ./utils export.
  pkg_json="$(find "${ROOT}/node_modules/.pnpm" -path "*/.pnpm/${prefix}@*/node_modules/${name}/package.json" | sort -V | head -1 || true)"
  if [[ -z "${pkg_json}" ]]; then
    pkg_json="$(find "${ROOT}/node_modules/.pnpm" -path "*/node_modules/${name}/package.json" | head -1 || true)"
  fi
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

declare -A COPIED_PKGS=()

copy_pkg_tree() {
  local name="$1"
  if [[ -n "${COPIED_PKGS[$name]:-}" ]]; then
    return 0
  fi
  COPIED_PKGS[$name]=1
  copy_real_pkg "$name" "${OUT}/node_modules" optional
  local pkg="${OUT}/node_modules/${name}/package.json"
  if [[ ! -f "${pkg}" ]]; then
    return 0
  fi
  local dep
  while IFS= read -r dep; do
    [[ -z "${dep}" ]] && continue
    case "${dep}" in
      @cmp/*) continue ;;
    esac
    copy_pkg_tree "${dep}"
  done < <(node -e 'const p=require(process.argv[1]); Object.keys(p.dependencies||{}).forEach((k)=>console.log(k));' "${pkg}")
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

while IFS= read -r dep; do
  [[ -z "${dep}" ]] && continue
  copy_pkg_tree "${dep}"
done < <(node -e 'const p=require(process.argv[1]); Object.keys(p.dependencies||{}).forEach((k)=>{ if(!k.startsWith("@cmp/") && k!=="playwright") console.log(k); });' "${ROOT}/package.json")

copy_pkg_tree uid
copy_pkg_tree tslib
copy_pkg_tree @prisma/client
copy_pkg_tree @prisma/adapter-mssql
copy_pkg_tree mssql
copy_real_pkg "@noble/hashes" "${OUT}/node_modules"
rm -rf "${OUT}/node_modules/playwright" "${OUT}/node_modules/playwright-core" "${OUT}/node_modules/@playwright"

SRC_CLIENT="$(find "${ROOT}/node_modules/.pnpm" -type d -path '*@prisma+client@*/node_modules/.prisma/client' | head -1 || true)"
if [[ -n "${SRC_CLIENT}" ]]; then
  mkdir -p "${OUT}/node_modules/.prisma"
  rm -rf "${OUT}/node_modules/.prisma/client"
  cp -R "${SRC_CLIENT}" "${OUT}/node_modules/.prisma/client"
fi

cp -a "${ROOT}/host.js" "${OUT}/host.js"
cat > "${OUT}/package.json" <<'EOF'
{
  "name": "consent_api",
  "private": true,
  "author": "saibrandingarc",
  "scripts": { "start": "node host.js" },
  "engines": { "node": "22.x" }
}
EOF

write_deploy_meta "${OUT}"

# Azure Linux Oryx extracts wwwroot/node_modules.tar.gz to /node_modules and
# moves wwwroot/node_modules aside. Zip deploy does not delete an old tar, so
# we must overwrite it with a complete tree (including uid for Nest ESM).
rm -f "${OUT}/node_modules.tar.gz"
tar -C "${OUT}/node_modules" -czf "${OUT}/node_modules.tar.gz" .
cat > "${OUT}/oryx-manifest.toml" <<'EOF'
PlatformName="nodejs"
NodeVersion="22"
CompressDestinationDir="true"
EOF

test -f "${OUT}/host.js"
test -f "${OUT}/dist/main.js"
test -f "${OUT}/node_modules/@nestjs/core/package.json"
test -d "${OUT}/node_modules/uid"
test -f "${OUT}/node_modules/@prisma/adapter-mssql/package.json"
NODE_PATH="${OUT}/node_modules" node -e 'require("@noble/hashes/utils")'
test -f "${OUT}/node_modules.tar.gz"
echo "assembled ${OUT}"
