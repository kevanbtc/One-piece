#!/bin/bash

# Universal Proof-of-Funds (UPoF) V2 - Quick Setup Script
# This script sets up the complete UPoF system in under 10 minutes

set -e  # Exit on any error

echo "🚀 Universal Proof-of-Funds (UPoF) V2 Setup"
echo "============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "contracts" ]; then
    echo -e "${RED}❌ Error: Run this script from the UPoF root directory${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Step 1: Installing contract dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Contract dependencies installed${NC}"
echo ""

echo -e "${BLUE}🔨 Step 2: Compiling contracts...${NC}"
npm run build
echo -e "${GREEN}✅ Contracts compiled${NC}"
echo ""

# Check for environment file
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating from template...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}📝 Please edit .env file with your settings before deployment${NC}"
    echo -e "${YELLOW}   Required: RPC_URL, PRIVATE_KEY${NC}"
    echo ""
else
    echo -e "${GREEN}✅ Environment file found${NC}"
fi

echo -e "${BLUE}📱 Step 3: Setting up frontend...${NC}"
cd app
npm install
echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
cd ..
echo ""

echo -e "${BLUE}🔐 Step 4: Setting up attestation service...${NC}"
cd attestation-service
npm install
npm run build
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${YELLOW}📝 Please edit attestation-service/.env with your settings${NC}"
fi
cd ..
echo -e "${GREEN}✅ Attestation service ready${NC}"
echo ""

echo -e "${BLUE}🚀 Step 5: Deployment options${NC}"
echo ""
echo "Choose your deployment method:"
echo "1) Deploy to testnet (requires .env configuration)"
echo "2) Skip deployment for now"
echo ""
read -p "Enter your choice (1-2): " choice

case $choice in
    1)
        echo -e "${BLUE}🌐 Deploying to testnet...${NC}"
        if [ -f ".env" ] && grep -q "RPC_URL=" ".env" && grep -q "PRIVATE_KEY=" ".env"; then
            npm run deploy:v2
            echo -e "${GREEN}✅ Deployment completed!${NC}"
        else
            echo -e "${RED}❌ Please configure your .env file first${NC}"
            echo "Required variables: RPC_URL, PRIVATE_KEY"
        fi
        ;;
    2)
        echo -e "${YELLOW}⏭️  Skipping deployment${NC}"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        ;;
esac

echo ""
echo -e "${GREEN}🎉 UPoF V2 Setup Complete!${NC}"
echo "=================================="
echo ""
echo -e "${BLUE}📚 Next Steps:${NC}"
echo ""
echo "1. 📝 Configure environment files:"
echo "   - Edit .env (contracts)"
echo "   - Edit attestation-service/.env (attestation service)"
echo ""
echo "2. 🚀 Deploy contracts (if not done):"
echo "   npm run deploy:v2"
echo ""
echo "3. 🏃 Start the services:"
echo "   # Terminal 1: Attestation service"
echo "   cd attestation-service && npm run dev"
echo ""
echo "   # Terminal 2: Frontend"
echo "   cd app && npm run dev"
echo ""
echo "4. 🌐 Access the app:"
echo "   http://localhost:5173"
echo ""
echo -e "${BLUE}📖 Documentation:${NC}"
echo "   - README.md - Complete setup guide"
echo "   - GitHub: https://github.com/kevanbtc/One-piece"
echo ""
echo -e "${GREEN}💡 Pro Tips:${NC}"
echo "   - Use Polygon Amoy testnet for testing"
echo "   - Get test USDC from faucets for escrow mode"
echo "   - Check attestation service logs for KYC/AML details"
echo ""
echo -e "${YELLOW}⚠️  Security Reminders:${NC}"
echo "   - Never commit private keys to git"
echo "   - Use HSM or secure key management in production"
echo "   - Regularly rotate attestation service keys"
echo ""

# Check if git is initialized and suggest GitHub setup
if [ -d ".git" ]; then
    echo -e "${BLUE}📦 Git repository initialized${NC}"
    echo "   - Already connected to GitHub: kevanbtc/One-piece"
else
    echo -e "${YELLOW}💡 Initialize git repository:${NC}"
    echo "   git init && git add . && git commit -m 'Initial commit'"
fi

echo ""
echo -e "${GREEN}🚀 Ready to revolutionize Proof of Funds!${NC}"