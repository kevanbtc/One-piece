#!/usr/bin/env bash
set -euo pipefail

echo "== UPoF V2 bootstrap =="

# 0) sanity
command -v node >/dev/null || { echo "Node is required"; exit 1; }
command -v npm  >/dev/null || { echo "npm is required"; exit 1; }

# 1) root deps
echo "[1/6] Installing root deps..."
npm i

# 2) envs
echo "[2/6] Writing .env if missing..."
if [ ! -f ".env" ]; then
  cat > .env <<EOF
RPC_URL=${RPC_URL:-https://polygon-amoy.g.alchemy.com/v2/REPLACE_ME}
PRIVATE_KEY=${PRIVATE_KEY:-0xYOUR_PRIVATE_KEY}
POLYGONSCAN_KEY=${POLYGONSCAN_KEY:-REPLACE_ME}
EOF
fi
echo " .env → ok"

# 3) compile & deploy
echo "[3/6] Building & deploying V2 (Amoy testnet by default)..."
npm run build
npx hardhat run scripts/deployV2.ts --network amoy | tee .deploy.out

ATTESTERS=$(grep '^AttesterRegistry:' .deploy.out | awk '{print $2}')
COMPLIANCE=$(grep '^ComplianceRegistry:' .deploy.out | awk '{print $2}')
VAULT=$(grep '^ProofOfFundsVault:' .deploy.out | awk '{print $2}')
echo "Deployed:"
echo "  ATTESTERS=$ATTESTERS"
echo "  COMPLIANCE=$COMPLIANCE"
echo "  VAULT=$VAULT"

# 4) attestation service
echo "[4/6] Installing attestation service deps..."
pushd attestation-service >/dev/null
npm init -y >/dev/null 2>&1 || true
npm i express ethers
cat > .env <<EOF
PORT=8787
ATTESTER_PRIVATE_KEY=${ATTESTER_PRIVATE_KEY:-0xYOUR_ATTESTER_KEY}
KYC_PROVIDER_ADDRESS=${KYC_PROVIDER_ADDRESS:-$ATTESTERS}
IP_SALT=${IP_SALT:-change-me}
RPC_URL=${RPC_URL:-}
LICENSE_PATH=${LICENSE_PATH:-PoF-License-v1.pdf}
IPFS_ENABLED=false
EOF
popd >/dev/null

# 5) app envs
echo "[5/6] Configuring frontend..."
pushd app >/dev/null
npm i
cat > .env <<EOF
VITE_VAULT_ADDR=${VAULT}
VITE_REGISTRY_ADDR=${ATTESTERS}
VITE_ATTEST_URL=http://localhost:8787/attest
VITE_KYC_REQUIRED=true
VITE_SANCTIONS_DATE=2025-09-01
VITE_UNIQUE_POLICY=per-asset
EOF
popd >/dev/null

# 6) run stack
echo "[6/6] Starting services..."
# start attestation service
(node ./attestation-service/src/attestation.ts &) >/dev/null 2>&1 || true
echo "Attestation service on :8787"
echo "Run manually in another terminal if needed: node attestation-service/src/attestation.ts"

echo "Start the app with:"
echo "  cd app && npm run dev"
echo "Open http://localhost:5173"