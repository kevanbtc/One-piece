# Universal Proof-of-Funds Vault (UPoF) V2 🚀

> **Enterprise-grade, one-screen solution that kills fake PoF letters**
> 
> Now with **KYC/AML compliance**, **uniqueness guarantees**, and **IP audit trails**

## 🎯 What it does (in 30 seconds)

**UPoF V2** creates **tamper-proof Proof-of-Funds NFTs** with enterprise compliance:

### 🔐 **Two Minting Modes**
1. **Escrow Mode**: Lock ERC-20 tokens → mint PoF NFT → cryptographic proof of locked funds
2. **Attested Mode**: Bank/custody signs EIP-712 → mint PoF NFT → no funds locked, just verified

### 🏛️ **Enterprise Compliance** (NEW!)
- **KYC/AML Integration**: Whitelisted providers, sanctions screening
- **Uniqueness Guarantees**: Prevent duplicate/forged PoFs per policy
- **Audit Trails**: Privacy-safe IP logging, compliance pack storage
- **Soulbound Mode**: Non-transferable tokens for strict compliance

### ⚡ **Instant Verification**
- **One call**: `verify(tokenId, asset, minAmount)` → boolean + reason
- **QR-ready**: On-chain SVG + JSON metadata (no IPFS needed)
- **Composable**: Any dApp/exchange can integrate verification

---

## 🌐 **Public Demo** (30 seconds)

**→ [🎯 **LIVE DEMO PAGE**](https://kevanbtc.github.io/One-piece/) ←**

Perfect for sharing with banks, investors, and partners:

```bash
# Serve locally
npm run demo
# Open http://localhost:3333
```

---

## 🚀 Quick Start (10 minutes)

### Option 1: Automated Setup
```bash
git clone https://github.com/kevanbtc/One-piece.git upof
cd upof
./init_upof.sh
```

### Option 2: Manual Setup

#### 1. Deploy Contracts
```bash
npm install
cp .env.example .env   # Configure RPC_URL, PRIVATE_KEY
npm run build
npm run deploy:v2      # Deploys V2 with compliance features
```

#### 2. Start Attestation Service
```bash
cd attestation-service
npm install
cp .env.example .env   # Configure attestation service
npm run dev            # Runs on :8787
```

#### 3. Launch Frontend
```bash
cd app
npm install
# Update .env with deployed contract addresses
npm run dev            # Runs on :5173
```

---

## 🏗️ Architecture

```
upof/
├─ contracts/                          # Smart contracts
│  ├─ ProofOfFundsVaultV2.sol         # Main NFT with compliance
│  ├─ ComplianceRegistry.sol           # KYC/sanctions management
│  └─ AttesterRegistry.sol             # Attester whitelist
├─ attestation-service/                # Compliance microservice
│  ├─ src/attestation.ts               # EIP-712 signing
│  ├─ src/compliance.ts                # KYC/AML checks
│  └─ src/ipfs.ts                      # Compliance pack storage
├─ scripts/
│  └─ deployV2.ts                      # V2 deployment
├─ app/                                # React frontend
│  └─ src/App.tsx                      # One-screen interface
└─ init_upof.sh                        # Quick setup script
```

---

## ✨ Features

### 🔐 **Escrow Mode**
- Lock ERC-20 tokens on-chain
- Mint tamper-proof PoF NFT
- Burn NFT to release funds
- Perfect for crypto holdings

### 🏦 **Attested Mode** 
- Bank/custody signs EIP-712 message
- No funds locked on-chain  
- Cryptographically verifiable
- Perfect for fiat/traditional assets

### 🛡️ **Enterprise Compliance (NEW!)**
- **KYC Provider Registry**: Whitelist trusted KYC/KYB services
- **Sanctions Screening**: OFAC/AML database integration
- **Compliance Packs**: IPFS-stored compliance reports
- **IP Audit Trails**: Privacy-safe IP address logging
- **License Binding**: Intellectual property terms on-chain

### 🔒 **Uniqueness System (NEW!)**
- **Policy-Based**: Prevent duplicates per user+asset or user+bank-ref
- **Active Tracking**: Smart contract enforces uniqueness constraints
- **Revocation Cleanup**: Burned/revoked NFTs release uniqueness keys

### 🎨 **On-Chain Metadata**
- **Dynamic SVG**: Real-time visual generation
- **No IPFS Dependency**: Fully self-contained
- **QR-Ready**: Data URLs for instant sharing
- **Rich Attributes**: Mode, compliance, licensing info

### ⚡ **Instant Verification**
```solidity
vault.verify(tokenId, requiredAsset, minAmount)
// Returns: (bool valid, string reason)
```

---

## 🌐 **Integration Examples**

### DeFi Protocol Integration
```javascript
const [isValid, reason] = await vault.verify(pofTokenId, USDC_ADDRESS, parseUnits("10000", 6));
if (isValid) {
    // Proceed with high-value transaction
} else {
    // Reject: reason contains details
}
```

### Exchange KYC Flow
```javascript
// Check PoF + compliance
const pof = await vault.proofs(tokenId);
if (pof.kycProvider !== ZERO_ADDRESS && pof.sanctionsVersion !== ZERO_HASH) {
    // User has compliant PoF, reduce KYC friction
}
```

---

## 🎯 **Why Banks & Exchanges Love This**

### ✅ **Eliminates Fake PoFs**
- **Cryptographically impossible** to forge
- **Real-time verification** in seconds vs. days
- **No more phone calls** or document exchanges

### ✅ **Regulatory Compliance** 
- **KYC/AML integration** with major providers
- **Sanctions screening** with version tracking
- **Audit trails** for regulatory reporting
- **Privacy-safe** (no PII on-chain)

### ✅ **Enterprise Security**
- **HSM support** for attestation signing
- **Soulbound tokens** for compliance contexts
- **IP licensing** for commercial use
- **Revocation controls** for admin oversight

### ✅ **Developer Friendly**
- **One function** verification API
- **Standard ERC-721** NFT interface
- **Composable** with any DeFi protocol
- **Multi-chain** deployment ready

---

## 🔧 **Configuration**

### Contract Environment (`.env`)
```bash
RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0x...your_deployer_private_key
POLYGONSCAN_KEY=your_polygonscan_api_key
```

### Attestation Service (`attestation-service/.env`)
```bash
PORT=8787
ATTESTER_PRIVATE_KEY=0x...your_attester_private_key
KYC_PROVIDER_ADDRESS=0x...your_kyc_provider_address
KYC_API_KEY=your_kyc_service_api_key
SANCTIONS_API_KEY=your_sanctions_api_key
IPFS_ENABLED=true
IPFS_API_KEY=your_pinata_or_infura_key
```

---

## 🚀 **Deployment Networks**

### Testnets (Recommended for Demo)
- **Polygon Amoy** (configured by default)
- **Ethereum Sepolia**
- **Base Sepolia** 

### Mainnets (Production)
- **Polygon** (low fees, fast)
- **Ethereum** (maximum security)
- **Base** (Coinbase ecosystem)
- **Arbitrum** (L2 scaling)

---

## 📚 **API Reference**

### Core Functions
```solidity
// Mint with escrow
function mintEscrow(
    address asset, uint256 amount, uint256 expiry,
    address kycProvider, bytes32 kycRef, bytes32 sanctionsVersion,
    string calldata compliancePackCID, bytes32 licenseHash, bytes32 uniqueKey
) external returns (uint256 tokenId)

// Mint with attestation  
function mintAttested(
    address account, address asset, uint256 amount, uint256 expiry,
    uint8 v, bytes32 r, bytes32 s,
    address kycProvider, bytes32 kycRef, bytes32 sanctionsVersion,
    string calldata compliancePackCID, bytes32 licenseHash, bytes32 uniqueKey
) external returns (uint256 tokenId)

// Verify PoF
function verify(uint256 tokenId, address requiredAsset, uint256 minAmount) 
    external view returns (bool valid, string memory reason)
```

### Attestation Service API
```bash
POST /attest
{
  "chainId": 80002,
  "vaultAddress": "0x...",
  "account": "0x...",
  "asset": "0x...", 
  "amount": "1000000000",
  "expiry": 1756924800,
  "policy": {
    "kycRequired": true,
    "sanctionsRequired": true,
    "uniquePolicy": "per-asset"
  }
}
```

---

## 🔮 **Future Roadmap**

### Phase 2: Advanced Features
- [ ] **Multi-asset PoFs**: Single NFT for portfolio proof
- [ ] **Time-locked escrows**: Funds release on schedule  
- [ ] **Oracle integration**: Automated bank balance refresh
- [ ] **Cross-chain bridges**: Multi-chain PoF verification

### Phase 3: Enterprise Tools
- [ ] **Admin dashboard**: PoF management interface
- [ ] **Compliance reporting**: Automated regulatory reports  
- [ ] **White-label SDK**: Easy integration for banks
- [ ] **Mobile apps**: Native iOS/Android verification

### Phase 4: DeFi Integration
- [ ] **Lending protocols**: PoF as collateral reference
- [ ] **DEX integrations**: Reduced slippage for verified users
- [ ] **Insurance protocols**: PoF-based coverage
- [ ] **DAO governance**: PoF-weighted voting

---

## 🤝 **Contributing**

1. **Fork** the repository
2. **Create** feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** changes: `git commit -m 'Add amazing feature'`
4. **Push** to branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

---

## 📄 **License**

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙋 **Support**

- **GitHub Issues**: [Report bugs or request features](https://github.com/kevanbtc/One-piece/issues)
- **Discussions**: [Community forum](https://github.com/kevanbtc/One-piece/discussions)
- **Documentation**: [Full API docs](https://github.com/kevanbtc/One-piece/wiki)

---

## 🌟 **Star History**

[![Star History Chart](https://api.star-history.com/svg?repos=kevanbtc/One-piece&type=Timeline)](https://star-history.com/#kevanbtc/One-piece&Timeline)

---

<div align="center">

**Built with ❤️ for the future of finance**

[🚀 **Deploy Now**](https://github.com/kevanbtc/One-piece) • [📖 **Read Docs**](https://github.com/kevanbtc/One-piece/wiki) • [💬 **Join Community**](https://github.com/kevanbtc/One-piece/discussions)

</div>