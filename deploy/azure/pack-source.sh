#!/usr/bin/env bash
# Zip-sized source tree for App Service to install and compile (no node_modules).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${ROOT}/azure-source"

rm -rf "${OUT}"
mkdir -p "${OUT}"

copy_tree() {
  local src="$1"
  local dest="$2"
  mkdir -p "${dest}"
  rsync -a --delete \
    --exclude node_modules \
    --exclude dist \
    --exclude '*.tsbuildinfo' \
    "${src}/" "${dest}/"
}

cp -a "${ROOT}/pnpm-lock.yaml" "${OUT}/pnpm-lock.yaml"
cp -a "${ROOT}/pnpm-workspace.yaml" "${OUT}/pnpm-workspace.yaml"
cp -a "${ROOT}/nest-cli.json" "${OUT}/nest-cli.json"
cp -a "${ROOT}/tsconfig.json" "${OUT}/tsconfig.json"
cp -a "${ROOT}/tsconfig.base.json" "${OUT}/tsconfig.base.json"
cp -a "${ROOT}/host.js" "${OUT}/host.js"
cp -a "${ROOT}/.nvmrc" "${OUT}/.nvmrc"
cp -a "${ROOT}/.deployment" "${OUT}/.deployment"
copy_tree "${ROOT}/src" "${OUT}/src"
copy_tree "${ROOT}/packages" "${OUT}/packages"
mkdir -p "${OUT}/deploy/azure"
cp -a "${ROOT}/deploy/azure/remote-build.sh" "${OUT}/deploy/azure/remote-build.sh"
chmod +x "${OUT}/deploy/azure/remote-build.sh"

# Hoisted node_modules so Oryx/Kudu copies do not break pnpm symlinks.
cat > "${OUT}/.npmrc" <<'EOF'
node-linker=hoisted
EOF

cat > "${OUT}/package.json" <<EOF
$(node -e '
const p = require(process.argv[1]);
p.scripts = p.scripts || {};
p.scripts.start = "node host.js";
console.log(JSON.stringify(p, null, 2));
' "${ROOT}/package.json")
EOF

# Do not let Oryx extract a stale node_modules tarball from an older zip.
rm -f "${OUT}/node_modules.tar.gz"

test -f "${OUT}/pnpm-lock.yaml"
test -f "${OUT}/deploy/azure/remote-build.sh"
test -f "${OUT}/src/main.ts"
echo "packed ${OUT}"
