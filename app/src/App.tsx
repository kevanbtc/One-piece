import React, { useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, Eip1193Provider, JsonRpcSigner, parseUnits } from "ethers";

// === Fill these with your deployed addresses ===
const VAULT_ADDRESS = import.meta.env.VITE_VAULT_ADDR || "";      // ProofOfFundsVault
const REGISTRY_ADDRESS = import.meta.env.VITE_REGISTRY_ADDR || ""; // AttesterRegistry
const ERC20_DECIMALS = 6; // e.g., USDC on Polygon has 6

// New envs
const ATTEST_SERVICE_URL = import.meta.env.VITE_ATTEST_URL || "http://localhost:8787/attest";
const KYC_REQUIRED = (import.meta.env.VITE_KYC_REQUIRED || "true") === "true";
const SANCTIONS_DATE = import.meta.env.VITE_SANCTIONS_DATE || "2025-09-01";
const UNIQUE_POLICY = import.meta.env.VITE_UNIQUE_POLICY || "per-asset"; // or "per-bank-ref"

// Minimal ABI fragments
const VAULT_ABI = [
  "function mintEscrow(address,uint256,uint256,address,bytes32,bytes32,string,bytes32,bytes32) returns (uint256)",
  "function mintAttested(address,address,uint256,uint256,uint8,bytes32,bytes32,address,bytes32,bytes32,string,bytes32,bytes32) returns (uint256)",
  "function verify(uint256,address,uint256) view returns (bool,string)",
  "function tokenURI(uint256) view returns (string)",
  "function recordClientIp(uint256,bytes32)",
  "function nonces(address) view returns (uint256)"
];
const ERC20_ABI = [
  "function approve(address spender,uint256 amount) external returns (bool)",
  "function allowance(address owner,address spender) external view returns (uint256)",
];

declare global {
  interface Window { ethereum?: Eip1193Provider }
}

export default function App() {
  const [provider, setProvider] = useState<BrowserProvider>();
  const [signer, setSigner] = useState<JsonRpcSigner>();
  const [address, setAddress] = useState<string>();
  const [asset, setAsset] = useState<string>("");
  const [amount, setAmount] = useState<string>("1000"); // $1,000 default
  const [expiry, setExpiry] = useState<string>("");
  const [tokenId, setTokenId] = useState<string>("");
  const [verifyId, setVerifyId] = useState<string>("");
  const [verifyMin, setVerifyMin] = useState<string>("1000");
  const [verifyAsset, setVerifyAsset] = useState<string>("");

  const vault = useMemo(() => {
    return provider && VAULT_ADDRESS ? new Contract(VAULT_ADDRESS, VAULT_ABI, signer ?? provider) : undefined;
  }, [provider, signer]);

  useEffect(() => {
    if (window.ethereum) {
      const p = new BrowserProvider(window.ethereum);
      setProvider(p);
    }
  }, []);

  const connect = async () => {
    if (!provider) return;
    await provider.send("eth_requestAccounts", []);
    const s = await provider.getSigner();
    setSigner(s);
    setAddress(await s.getAddress());
  };

  const mintEscrow = async () => {
    if (!vault || !signer) return alert("Connect wallet.");
    if (!asset) return alert("Enter ERC20 asset address (e.g., USDC).");
    const amt = parseUnits(amount, ERC20_DECIMALS);

    // approve
    const erc20 = new Contract(asset, ERC20_ABI, signer);
    const allowance = await erc20.allowance(await signer.getAddress(), VAULT_ADDRESS);
    if (allowance < amt) {
      const txA = await erc20.approve(VAULT_ADDRESS, amt);
      await txA.wait();
    }

    const exp = expiry ? BigInt(Math.floor(new Date(expiry).getTime() / 1000)) : 0n;
    // Use legacy escrow mode (V2 supports both legacy and compliance versions)
    const tx = await vault.connect(signer).mintEscrow(
      asset, amt, exp,
      "0x0000000000000000000000000000000000000000", // kycProvider
      "0x0000000000000000000000000000000000000000000000000000000000000000", // kycRef
      "0x0000000000000000000000000000000000000000000000000000000000000000", // sanctionsVersion
      "", // compliancePackCID
      "0x0000000000000000000000000000000000000000000000000000000000000000", // licenseHash
      "0x0000000000000000000000000000000000000000000000000000000000000000"  // uniqueKey
    );
    const rec = await tx.wait();
    const evt = rec?.logs?.find((l: any) => l.fragment?.name === "Minted");
    // @ts-ignore
    const id = evt?.args?.tokenId?.toString?.() ?? "";
    setTokenId(id);
  };

  // Attested mint with V2 compliance integration
  const mintAttested = async () => {
    if (!vault || !signer) return alert("Connect wallet.");
    if (!asset) return alert("Enter asset.");
    const amt = parseUnits(amount, ERC20_DECIMALS);
    const exp = expiry ? BigInt(Math.floor(new Date(expiry).getTime() / 1000)) : 0n;

    // 1) Ask attestation-service for signature + compliance fields
    const body = {
      chainId: await signer.provider!.getNetwork().then(n => Number(n.chainId)),
      vaultAddress: VAULT_ADDRESS,
      account: await signer.getAddress(),
      asset,
      amount: amt.toString(),
      expiry: Number(exp),
      policy: { kycRequired: KYC_REQUIRED, sanctionsDate: SANCTIONS_DATE, uniquePolicy: UNIQUE_POLICY }
    };

    const resp = await fetch(ATTEST_SERVICE_URL, { 
      method: "POST", 
      headers: { "content-type": "application/json" }, 
      body: JSON.stringify(body) 
    });
    if (!resp.ok) return alert("Attestation failed");
    const { signature, kycProvider, kycRef, sanctionsVersion, compliancePackCID, licenseHash, uniqueKey, clientIpHash } = await resp.json();

    const bytes = signature.slice(2);
    const r = "0x" + bytes.slice(0, 64);
    const s = "0x" + bytes.slice(64, 128);
    const v = parseInt(bytes.slice(128, 130), 16);

    // 2) mintAttested with compliance args (new V2 signature)
    const tx = await vault.connect(signer).mintAttested(
      await signer.getAddress(), asset, amt, exp, v, r as any, s as any,
      kycProvider, kycRef, sanctionsVersion, compliancePackCID, licenseHash, uniqueKey
    );
    const rec = await tx.wait();
    const evt = rec?.logs?.find((l: any) => l.fragment?.name === "Minted");
    // @ts-ignore
    const id = evt?.args?.tokenId?.toString?.() ?? "";
    setTokenId(id);

    // 3) Record salted IP hash on-chain (optional)
    try {
      await (await (vault as any).recordClientIp(BigInt(id), clientIpHash)).wait();
    } catch { /* non-fatal */ }
  };

  const doVerify = async () => {
    if (!vault) return;
    const min = parseUnits(verifyMin || "0", ERC20_DECIMALS);
    const [ok, reason] = await vault.verify(BigInt(verifyId), verifyAsset || "0x0000000000000000000000000000000000000000", min);
    alert(ok ? `✔ Valid: ${reason}` : `✖ Not valid: ${reason}`);
  };

  const fetchTokenUri = async () => {
    if (!vault || !tokenId) return;
    const uri = await vault.tokenURI(BigInt(tokenId));
    window.open(uri, "_blank");
  };

  return (
    <div className="card">
      <div className="title">Universal Proof-of-Funds (UPoF) V2</div>
      <p className="muted">Enterprise-grade PoF with KYC/AML compliance. Mint by locking ERC-20 funds (escrow) or using compliant attestation (bank/custody). Features uniqueness guarantees, IP audit trails, and regulatory compliance.</p>

      {!address ? <button onClick={connect}>Connect Wallet</button> : <p className="muted">Connected: {address}</p>}

      <div className="hr"></div>

      <div className="row">
        <div>
          <label>ERC-20 Asset (e.g., USDC)</label>
          <input placeholder="0x..." value={asset} onChange={e=>setAsset(e.target.value)} />
        </div>
        <div>
          <label>Amount (whole units, respects token decimals)</label>
          <input placeholder="1000" value={amount} onChange={e=>setAmount(e.target.value)} />
        </div>
      </div>
      <div style={{marginTop:12}}>
        <label>Expiry (optional)</label>
        <input type="datetime-local" value={expiry} onChange={e=>setExpiry(e.target.value)} />
      </div>

      <div style={{display:"flex", gap:12, marginTop:16}}>
        <button onClick={mintEscrow} disabled={!address || !asset}>Mint — Escrow Mode</button>
        <button onClick={mintAttested} disabled={!address || !asset}>Mint — Attested Mode</button>
      </div>

      {tokenId && (
        <>
          <div className="hr"></div>
          <div>
            <div className="title">Your PoF NFT</div>
            <p className="muted">Token ID: {tokenId}</p>
            <button onClick={fetchTokenUri}>Open NFT Metadata (on-chain)</button>
          </div>
        </>
      )}

      <div className="hr"></div>

      <div className="title">Verify a PoF</div>
      <div className="row">
        <div>
          <label>Token ID</label>
          <input value={verifyId} onChange={e=>setVerifyId(e.target.value)} />
        </div>
        <div>
          <label>Required Asset (optional)</label>
          <input placeholder="0x... or empty" value={verifyAsset} onChange={e=>setVerifyAsset(e.target.value)} />
        </div>
      </div>
      <div style={{marginTop:12}}>
        <label>Minimum Amount</label>
        <input value={verifyMin} onChange={e=>setVerifyMin(e.target.value)} />
      </div>
      <div style={{marginTop:12}}>
        <button onClick={doVerify}>Verify</button>
      </div>
    </div>
  );
}