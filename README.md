# Universal Proof-of-Funds Vault (UPoF)

> One-screen, one-contract demo that kills fake PoF letters

## What it does (in 20 seconds)

* **User mints a Proof-of-Funds NFT** in one of two ways:
  1. **Escrow mode (on-chain)**: lock USDC (or any ERC-20) in a vault → mint PoF NFT → QR shows live, tamper-proof proof.
  2. **Attested mode (off-chain bank balance)**: mint PoF NFT from a **whitelisted attester's EIP-712 signature** (e.g., custodian/bank/KYB service) — **no funds locked**, but cryptographically signed.
* Anyone can **scan/lookup the NFT** and see: asset, amount, expiry, issuance, attester, and validity in one call.
* **Burn to release** (escrow) or **revoke** (owner/admin) if needed.
* On-chain **SVG** artwork + JSON metadata are generated dynamically (no IPFS required) — so the QR/NFT itself is the proof.

## Quick Start

### 1. Deploy Contracts

```bash
cd upof
npm install
cp .env.example .env   # fill RPC_URL, PRIVATE_KEY
npm run build
npm run deploy
```

### 2. Run Frontend

```bash
cd app
npm install
echo "VITE_VAULT_ADDR=0xYourVault" > .env
echo "VITE_REGISTRY_ADDR=0xYourRegistry" >> .env
npm run dev
# open http://localhost:5173
```

## Architecture

```
upof/
├─ contracts/
│  ├─ ProofOfFundsVault.sol      # Main NFT contract with escrow & attested modes
│  └─ AttesterRegistry.sol       # Manages whitelisted attesters
├─ scripts/
│  └─ deploy.ts                  # Deployment script
├─ hardhat.config.ts
├─ package.json
└─ app/                          # React frontend
   ├─ src/App.tsx
   └─ package.json
```

## Features

### Escrow Mode
- Lock ERC-20 tokens on-chain
- Mint tamper-proof PoF NFT
- Burn NFT to release funds
- Perfect for crypto holdings

### Attested Mode
- Bank/custody signs EIP-712 message
- No funds locked on-chain
- Cryptographically verifiable
- Perfect for fiat/traditional assets

### Verification
- One function call: `verify(tokenId, requiredAsset, minAmount)`
- Returns boolean + reason string
- Checks expiry, revocation, asset type, amount

### On-Chain Metadata
- Dynamic SVG generation
- No IPFS dependencies
- QR-ready data URLs
- Fully composable

## Why This Matters

* **One click. One QR. Zero back-and-forth.** Instant, *verifiable* PoF instead of PDFs & SWIFT letters.
* **Works for crypto *and* fiat.** Crypto via **escrow mode**; fiat via **attested mode** (bank/custody signer).
* **Composable**: any dApp, exchange, or OTC desk can call `verify()` with a minimum amount + asset.
* **No reliance on IPFS**: on-chain JSON & SVG keeps it portable and tamper-proof.

## Next Steps

- Add attestation microservice with HSM signing
- Oracle integration for automated bank balance checks
- Soulbound mode for compliance contexts
- Multi-chain deployment