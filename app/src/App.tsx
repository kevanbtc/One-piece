import React, { useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, Eip1193Provider, JsonRpcSigner, parseUnits } from "ethers";

// === Fill these with your deployed addresses ===
const VAULT_ADDRESS = import.meta.env.VITE_VAULT_ADDR || "";      // ProofOfFundsVault
const REGISTRY_ADDRESS = import.meta.env.VITE_REGISTRY_ADDR || ""; // AttesterRegistry
const ERC20_DECIMALS = 6; // e.g., USDC on Polygon has 6

// Minimal ABI fragments
const VAULT_ABI = [
  "function mintEscrow(address asset,uint256 amount,uint256 expiry) external returns (uint256)",
  "function mintAttested(address account,address asset,uint256 amount,uint256 expiry,uint8 v,bytes32 r,bytes32 s) external returns (uint256)",
  "function verify(uint256 tokenId,address requiredAsset,uint256 minAmount) external view returns (bool,string)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
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
    const tx = await vault.connect(signer).mintEscrow(asset, amt, exp);
    const rec = await tx.wait();
    const evt = rec?.logs?.find((l: any) => l.fragment?.name === "Minted");
    // @ts-ignore
    const id = evt?.args?.tokenId?.toString?.() ?? "";
    setTokenId(id);
  };

  // Attested mint: show how to produce digest to be signed by an attester (demo: self-sign if whitelisted)
  const mintAttested = async () => {
    if (!vault || !signer) return alert("Connect wallet.");
    if (!asset) return alert("Enter asset.");
    const amt = parseUnits(amount, ERC20_DECIMALS);
    const exp = expiry ? BigInt(Math.floor(new Date(expiry).getTime() / 1000)) : 0n;

    // DEMO: we assume the connected wallet IS a whitelisted attester for quick demo
    // In production: call your attestation server to produce v,r,s
    const domain = {
      name: "ProofOfFundsVault",
      version: "1",
      chainId: await signer.provider!.getNetwork().then(n => Number(n.chainId)),
      verifyingContract: VAULT_ADDRESS
    };
    const types = {
      Attestation: [
        { name: "account", type: "address" },
        { name: "asset", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "expiry", type: "uint256" },
        { name: "nonce", type: "uint256" }
      ]
    };
    // Simplification: we use nonce=0 for demo; real impl should query nonces(account) from the contract via a view (not exposed in ABI snippet here)
    const value = {
      account: await signer.getAddress(),
      asset, amount: amt, expiry: exp, nonce: 0
    };
    // @ts-ignore
    const sig = await (signer as any)._signTypedData(domain, types, value);
    // parse sig
    const bytes = sig.substring(2);
    const r = "0x" + bytes.slice(0, 64);
    const s = "0x" + bytes.slice(64, 128);
    const v = parseInt(bytes.slice(128, 130), 16);

    const tx = await vault.connect(signer).mintAttested(await signer.getAddress(), asset, amt, exp, v, r as any, s as any);
    const rec = await tx.wait();
    const evt = rec?.logs?.find((l: any) => l.fragment?.name === "Minted");
    // @ts-ignore
    const id = evt?.args?.tokenId?.toString?.() ?? "";
    setTokenId(id);
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
      <div className="title">Universal Proof-of-Funds (UPoF)</div>
      <p className="muted">Mint a tamper-proof PoF NFT by locking ERC-20 funds (escrow) or using an attester signature (bank/custody). Share the NFT/QR as instant proof.</p>

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