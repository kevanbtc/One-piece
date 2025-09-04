#!/bin/bash

# UPoF V2 Smoke Test Script
# Tests the attestation service and basic functionality

set -e

echo "🧪 UPoF V2 Smoke Test"
echo "===================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
fi

if ! command -v curl &> /dev/null; then
    echo -e "${RED}❌ curl not found${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️  jq not found - JSON responses won't be formatted${NC}"
    JQ_AVAILABLE=false
else
    JQ_AVAILABLE=true
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Start attestation service
echo ""
echo "🔐 Starting attestation service..."

cd attestation-service

# Install deps if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing attestation service dependencies..."
    npm install
fi

# Create minimal .env if missing
if [ ! -f ".env" ]; then
    echo "📝 Creating minimal attestation service .env..."
    cat > .env << EOF
PORT=8787
ATTESTER_PRIVATE_KEY=0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
KYC_PROVIDER_ADDRESS=0x0000000000000000000000000000000000000001
IP_SALT=test-salt
RPC_URL=
LICENSE_PATH=
IPFS_ENABLED=false
EOF
fi

# Start service in background
echo "🚀 Launching attestation service..."
npm run dev &
SERVICE_PID=$!

# Wait for service to start
echo "⏳ Waiting for service to start..."
sleep 3

cd ..

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🧹 Cleaning up..."
    if [ -n "$SERVICE_PID" ]; then
        kill $SERVICE_PID 2>/dev/null || true
    fi
}
trap cleanup EXIT

# Test service health
echo ""
echo "🩺 Testing attestation service..."

SERVICE_URL="http://localhost:8787/attest"
TEST_PAYLOAD='{
  "chainId": 80002,
  "vaultAddress": "0x1234567890123456789012345678901234567890",
  "account": "0x0000000000000000000000000000000000000001",
  "asset": "0x0000000000000000000000000000000000000002",
  "amount": "1000000",
  "expiry": 0,
  "policy": {
    "uniquePolicy": "per-asset"
  }
}'

echo "📡 Sending test attestation request..."

if $JQ_AVAILABLE; then
    RESPONSE=$(curl -s -X POST -H 'Content-Type: application/json' -d "$TEST_PAYLOAD" "$SERVICE_URL")
    echo "📦 Response received:"
    echo "$RESPONSE" | jq .
else
    RESPONSE=$(curl -s -X POST -H 'Content-Type: application/json' -d "$TEST_PAYLOAD" "$SERVICE_URL")
    echo "📦 Response received:"
    echo "$RESPONSE"
fi

# Check if response contains expected fields
if echo "$RESPONSE" | grep -q "signature" && echo "$RESPONSE" | grep -q "kycProvider"; then
    echo -e "${GREEN}✅ Attestation service responding correctly${NC}"
else
    echo -e "${RED}❌ Attestation service not responding as expected${NC}"
    echo "Response: $RESPONSE"
    exit 1
fi

# Test contract compilation
echo ""
echo "🔨 Testing contract compilation..."

if [ ! -d "node_modules" ]; then
    echo "📦 Installing contract dependencies..."
    npm install
fi

npm run build
echo -e "${GREEN}✅ Contracts compiled successfully${NC}"

# Test frontend build
echo ""
echo "🎨 Testing frontend build..."

cd app

if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

npm run build
echo -e "${GREEN}✅ Frontend built successfully${NC}"

cd ..

# Summary
echo ""
echo "🎉 Smoke Test Complete!"
echo "======================"
echo -e "${GREEN}✅ Attestation service: Working${NC}"
echo -e "${GREEN}✅ Contract compilation: Working${NC}"
echo -e "${GREEN}✅ Frontend build: Working${NC}"
echo ""
echo "🚀 Ready for demo! Run:"
echo "   bash ./init_upof.sh"
echo "   cd app && npm run dev"