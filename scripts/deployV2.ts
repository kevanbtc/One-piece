// scripts/deployV2.ts
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // 1) AttesterRegistry
  const AttesterRegistry = await ethers.getContractFactory("AttesterRegistry");
  const attesterRegistry = await AttesterRegistry.deploy(deployer.address);
  await attesterRegistry.waitForDeployment();
  const ATTESTERS = await attesterRegistry.getAddress();
  console.log("AttesterRegistry:", ATTESTERS);

  // whitelist self as an attester (demo)
  await (await attesterRegistry.setAttester(deployer.address, true)).wait();
  console.log("Whitelisted deployer as attester");

  // 2) ComplianceRegistry
  const ComplianceRegistry = await ethers.getContractFactory("ComplianceRegistry");
  const complianceRegistry = await ComplianceRegistry.deploy(deployer.address);
  await complianceRegistry.waitForDeployment();
  const COMPLIANCE = await complianceRegistry.getAddress();
  console.log("ComplianceRegistry:", COMPLIANCE);

  // Register an example KYC provider (use your real provider address later)
  const KYC_PROVIDER_ADDR = deployer.address; // demo only
  await (await complianceRegistry.setKYCProvider(
    KYC_PROVIDER_ADDR,
    true,
    "DemoKYC",
    "https://example.com/kyc"
  )).wait();
  console.log("KYC provider registered:", KYC_PROVIDER_ADDR);

  // Register a sanctions dataset version (e.g., OFAC YYYY-MM-DD)
  const sanctionsLabel = "OFAC:2025-09-01";
  const sanctionsHash = ethers.keccak256(ethers.toUtf8Bytes(sanctionsLabel));
  await (await complianceRegistry.setSanctionsVersion(sanctionsHash, true)).wait();
  console.log("Sanctions version added:", sanctionsLabel, sanctionsHash);

  // 3) ProofOfFundsVault V2
  const ProofOfFundsVault = await ethers.getContractFactory("ProofOfFundsVaultV2");
  const vault = await ProofOfFundsVault.deploy(ATTESTERS, COMPLIANCE, deployer.address);
  await vault.waitForDeployment();
  const VAULT = await vault.getAddress();
  console.log("ProofOfFundsVault:", VAULT);

  // Optional: enable soulbound for strict demos (off by default)
  // await (await vault.setSoulbound(true)).wait();

  console.log("\n=== Addresses ===");
  console.log("ATTESTER_REGISTRY=", ATTESTERS);
  console.log("COMPLIANCE_REGISTRY=", COMPLIANCE);
  console.log("POF_VAULT=", VAULT);
  console.log("KYC_PROVIDER=", KYC_PROVIDER_ADDR);
  console.log("SANCTIONS_HASH=", sanctionsHash);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});