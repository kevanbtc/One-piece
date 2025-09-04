# UPoF V2 Demo Script for Lael (90 seconds)

## Setup (10 seconds)
1. **Terminal 1**: `node attestation-service/src/attestation.ts` (Compliance service running on :8787)
2. **Terminal 2**: `cd app && npm run dev` (Frontend on :5173)
3. **Browser**: Open http://localhost:5173

---

## Demo Flow (80 seconds)

### **Minute 1: "The Problem"** (20s)
> **Say**: "Today, proving you have $10M takes weeks of PDF exchanges, phone calls, and manual verification. Banks hate it, traders hate it, everyone fakes it."
> 
> **Show**: Point to the clean interface - "This kills fake PoF letters with cryptography."

### **Minute 1: "Escrow Mode Demo"** (30s)
1. **Connect Wallet**: Click "Connect Wallet"
2. **Enter USDC**: Paste Polygon Amoy USDC address: `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582`
3. **Amount**: Enter `10000` ($10,000)  
4. **Click**: "Mint — Escrow Mode"
5. **Say**: "Funds are locked on-chain, NFT is minted, completely tamper-proof"
6. **Show**: Token ID appears → Click "Open NFT Metadata" → Show on-chain SVG + JSON

### **Minute 2: "Attested Mode Demo"** (30s)
1. **Asset**: Same USDC address
2. **Amount**: `50000` ($50,000)
3. **Click**: "Mint — Attested Mode" 
4. **Say**: "Watch the magic - our service does KYC check, sanctions screening, generates compliance pack"
5. **Show**: 
   - Network request to attestation service
   - Service returns signed attestation + compliance fields
   - NFT minted with KYC provider, sanctions version, license hash, uniqueness key
   - IP address logged (privacy-safe)

### **Final 30s: "Instant Verification"**
1. **Copy Token ID** from previous mint
2. **Scroll down** to "Verify a PoF" 
3. **Enter Token ID**, **Min Amount**: `25000`
4. **Click Verify** → Shows "✔ Valid: OK" 
5. **Say**: "Any exchange, any bank, any DeFi protocol can call this one function. Real-time verification in milliseconds."

---

## **Key Messages**

### **For Banks**:
- ✅ **Eliminates fraud**: Cryptographically impossible to fake
- ✅ **Regulatory compliant**: KYC/AML built-in, audit trails
- ✅ **Instant verification**: No more phone calls or document chains
- ✅ **Privacy-safe**: No PII on-chain, just hashes

### **For DeFi/Exchanges**:
- ✅ **One function call**: `verify(tokenId, asset, minAmount)` 
- ✅ **Composable**: Standard ERC-721, works with any protocol
- ✅ **Gas efficient**: All metadata on-chain, no IPFS lookups
- ✅ **Enterprise ready**: Soulbound mode, revocation controls

### **For Regulators**:
- ✅ **Audit trails**: Every action logged with timestamps
- ✅ **Compliance packs**: IPFS-stored reports for each PoF
- ✅ **Sanctions screening**: OFAC integration with version tracking
- ✅ **IP logging**: Privacy-safe client identification

---

## **Technical Highlights**

1. **Uniqueness Guarantees**: Smart contract prevents duplicate PoFs per policy
2. **IP & IP**: Intellectual Property licensing + Internet Protocol audit trails  
3. **Soulbound Ready**: Non-transferable tokens for strict compliance
4. **Multi-chain**: Deploy on Polygon, Ethereum, Base, Arbitrum
5. **HSM Compatible**: Attestation service ready for hardware security modules

---

## **"So What?" Moment**

> **"This turns a 2-week document circus into a 20-second API call. Banks save millions in operational costs. Traders get instant liquidity access. Regulators get complete audit trails. And fraud becomes mathematically impossible."**

**Total addressable market**: Every high-value financial transaction that requires proof of funds.