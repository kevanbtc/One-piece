import express from "express";
import cors from "cors";
import helmet from "helmet";
import { ethers } from "ethers";
import { createHash } from "crypto";
import dotenv from "dotenv";
import { AttestationService } from "./attestation";
import { ComplianceService } from "./compliance";
import { IPFSService } from "./ipfs";

dotenv.config();

const app = express();
const port = process.env.PORT || 8787;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:5173", "http://localhost:3000"],
  credentials: true
}));
app.use(express.json({ limit: "10mb" }));

// Services
const attestationService = new AttestationService();
const complianceService = new ComplianceService();
const ipfsService = new IPFSService();

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Main attestation endpoint
app.post("/attest", async (req, res) => {
  try {
    const startTime = Date.now();
    const clientIp = req.headers["x-forwarded-for"]?.toString().split(",")[0] || 
                    req.socket.remoteAddress || "0.0.0.0";
    
    console.log(`[${new Date().toISOString()}] Attestation request from ${clientIp}`);

    const { chainId, vaultAddress, account, asset, amount, expiry, policy = {} } = req.body;

    // Input validation
    if (!chainId || !vaultAddress || !account || !asset || !amount) {
      return res.status(400).json({ error: "missing_required_fields" });
    }

    // 1) Run KYC/KYB + sanctions checks
    const kycResult = await complianceService.performKYC(account, policy);
    const sanctionsResult = await complianceService.checkSanctions(account, policy);

    if (!kycResult.passed || !sanctionsResult.passed) {
      return res.status(403).json({ 
        error: "compliance_failed",
        kyc: kycResult.passed,
        sanctions: sanctionsResult.passed,
        details: {
          kycReason: kycResult.reason,
          sanctionsReason: sanctionsResult.reason
        }
      });
    }

    // 2) Generate compliance identifiers
    const kycProviderAddr = process.env.KYC_PROVIDER_ADDRESS || ethers.ZeroAddress;
    const kycRef = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({
      account,
      ticketId: kycResult.ticketId,
      timestamp: Date.now()
    })));

    const sanctionsLabel = `OFAC:${policy.sanctionsDate || "2025-09-04"}`;
    const sanctionsVersion = ethers.keccak256(ethers.toUtf8Bytes(sanctionsLabel));

    // 3) Create and pin compliance pack to IPFS
    const compliancePack = {
      account,
      asset,
      amount: amount.toString(),
      expiry,
      kyc: {
        provider: kycProviderAddr,
        ticketId: kycResult.ticketId,
        passed: kycResult.passed,
        timestamp: kycResult.timestamp
      },
      sanctions: {
        version: sanctionsLabel,
        passed: sanctionsResult.passed,
        timestamp: sanctionsResult.timestamp
      },
      metadata: {
        service: "UPoF Attestation Service v1.0",
        timestamp: Date.now(),
        clientIpHash: createKeccakHash(clientIp + process.env.IP_SALT)
      }
    };

    const compliancePackCID = await ipfsService.pinJSON(compliancePack);

    // 4) License hash (load from your license document)
    const licenseHash = process.env.LICENSE_HASH || 
      ethers.keccak256(ethers.toUtf8Bytes("UPoF-Standard-License-v1.0"));

    // 5) Uniqueness key (policy-based)
    const uniqueKey = policy.uniquePolicy === "per-asset" 
      ? ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address", "address"], [account, asset]))
      : policy.uniquePolicy === "per-bank-ref"
      ? ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address", "string"], [account, policy.bankRef || ""]))
      : ethers.ZeroHash; // no uniqueness constraint

    // 6) Client IP hash for audit trail
    const clientIpHash = createKeccakHash(clientIp + (process.env.IP_SALT || "default-salt"));

    // 7) Generate EIP-712 signature
    const signature = await attestationService.signAttestation({
      chainId: Number(chainId),
      vaultAddress,
      account,
      asset,
      amount: BigInt(amount),
      expiry: BigInt(expiry),
      nonce: 0 // In production, fetch from contract
    });

    const response = {
      signature,
      compliance: {
        kycProvider: kycProviderAddr,
        kycRef,
        sanctionsVersion,
        compliancePackCID,
        licenseHash,
        uniqueKey,
        clientIpHash
      },
      metadata: {
        processingTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    };

    console.log(`[${new Date().toISOString()}] Attestation completed in ${response.metadata.processingTimeMs}ms`);
    res.json(response);

  } catch (error) {
    console.error("Attestation error:", error);
    res.status(500).json({ 
      error: "attestation_failed",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Compliance verification endpoint
app.post("/verify-compliance", async (req, res) => {
  try {
    const { compliancePackCID } = req.body;
    
    if (!compliancePackCID) {
      return res.status(400).json({ error: "missing_compliance_pack_cid" });
    }

    const compliancePack = await ipfsService.getJSON(compliancePackCID);
    const isValid = await complianceService.verifyCompliancePack(compliancePack);

    res.json({
      valid: isValid,
      compliancePack,
      verifiedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error("Compliance verification error:", error);
    res.status(500).json({ error: "verification_failed" });
  }
});

function createKeccakHash(data: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(data));
}

// Start server
app.listen(port, () => {
  console.log(`🚀 UPoF Attestation Service running on port ${port}`);
  console.log(`📋 Health check: http://localhost:${port}/health`);
  console.log(`🔐 Attest endpoint: http://localhost:${port}/attest`);
});

export default app;