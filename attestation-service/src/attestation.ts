// attestation-service/src/attestation.ts
import express from "express";
import { AddressLike, AbiCoder, JsonRpcProvider, Wallet, keccak256, toUtf8Bytes } from "ethers";
import { runKycFor, getSanctionsLabelHash } from "./compliance";
import { pinCompliancePack, hashBuffer, getLicenseBuffer } from "./ipfs";

const PORT = Number(process.env.PORT || 8787);
const ATTESTER_PRIVATE_KEY = process.env.ATTESTER_PRIVATE_KEY!;
const KYC_PROVIDER_ADDRESS = (process.env.KYC_PROVIDER_ADDRESS || "").toLowerCase();
const IP_SALT = process.env.IP_SALT || "change-me";
const RPC_URL = process.env.RPC_URL || "";
const provider = RPC_URL ? new JsonRpcProvider(RPC_URL) : undefined;

if (!ATTESTER_PRIVATE_KEY) throw new Error("Missing ATTESTER_PRIVATE_KEY");

const signer = provider ? new Wallet(ATTESTER_PRIVATE_KEY, provider) : new Wallet(ATTESTER_PRIVATE_KEY);

const app = express();
app.use(express.json());

app.post("/attest", async (req, res) => {
  try {
    const {
      chainId,
      vaultAddress,
      account,
      asset,
      amount,      // string (wei)
      expiry,      // number (unix seconds) or 0
      policy = {}  // { sanctionsDate?: "YYYY-MM-DD", uniquePolicy?: "per-asset"|"per-bank-ref", bankRef?: string }
    } = req.body;

    // 1) KYC / KYB (no PII leaves your infra)
    const kycTicket = await runKycFor(account);
    const kycRef = keccak256(toUtf8Bytes(JSON.stringify(kycTicket)));

    // 2) Sanctions version hash
    const sanctionsDate: string = policy.sanctionsDate || "2025-09-01";
    const sanctionsVersion = getSanctionsLabelHash(`OFAC:${sanctionsDate}`);

    // 3) Compliance pack → IPFS (or local mock)
    const pack = { account, asset, amount, expiry, kycTicket, sanctionsLabel: `OFAC:${sanctionsDate}`, issuedAt: Date.now() };
    const compliancePackCID = await pinCompliancePack(pack);

    // 4) License hash (bind your license/IP terms to the proof)
    const licenseBuf = await getLicenseBuffer(process.env.LICENSE_PATH || "PoF-License-v1.pdf");
    const licenseHash = hashBuffer(licenseBuf);

    // 5) Uniqueness key
    //    Default: one active PoF per (account, asset)
    const uniquePolicy = policy.uniquePolicy || "per-asset";
    let uniqueKey: string;
    if (uniquePolicy === "per-bank-ref" && policy.bankRef) {
      uniqueKey = keccak256(AbiCoder.defaultAbiCoder().encode(["address", "bytes32"], [account as AddressLike, keccak256(toUtf8Bytes(policy.bankRef))]));
    } else {
      uniqueKey = keccak256(AbiCoder.defaultAbiCoder().encode(["address", "address"], [account as AddressLike, asset as AddressLike]));
    }

    // 6) Client IP (privacy-safe)
    const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "0.0.0.0";
    const clientIpHash = keccak256(toUtf8Bytes(`${rawIp}:${IP_SALT}`));

    // 7) EIP-712 signature
    const domain = { name: "ProofOfFundsVault", version: "1", chainId, verifyingContract: vaultAddress };
    const types = {
      Attestation: [
        { name: "account", type: "address" },
        { name: "asset", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "expiry", type: "uint256" },
        { name: "nonce", type: "uint256" }
      ]
    };

    // Read current nonce from contract if available (V2 should expose it)
    let nonce = 0;
    try {
      if (provider) {
        const abi = ["function nonces(address) view returns (uint256)"];
        const c = new (await import("ethers")).Contract(vaultAddress, abi, provider);
        nonce = Number(await c.nonces(account));
      }
    } catch { /* fallback to 0 for demo */ }

    // @ts-ignore _signTypedData is present on Wallet
    const signature: string = await (signer as any)._signTypedData(domain, types, { account, asset, amount, expiry, nonce });

    return res.json({
      signature,
      kycProvider: KYC_PROVIDER_ADDRESS,
      kycRef,
      sanctionsVersion,
      compliancePackCID,
      licenseHash,
      uniqueKey,
      clientIpHash
    });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: "attestation_failed", detail: e.message });
  }
});

app.listen(PORT, () => console.log(`[attestation] listening on :${PORT}`));