import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀 Deploying UPoF V2 contracts...");
  console.log("Deployer:", deployer.address);

  // Deploy AttesterRegistry
  console.log("\n📋 Deploying AttesterRegistry...");
  const AttesterRegistry = await ethers.getContractFactory("AttesterRegistry");
  const attesterRegistry = await AttesterRegistry.deploy(deployer.address);
  await attesterRegistry.waitForDeployment();
  const attesterAddress = await attesterRegistry.getAddress();
  console.log("✅ AttesterRegistry deployed:", attesterAddress);

  // Deploy ComplianceRegistry
  console.log("\n🔒 Deploying ComplianceRegistry...");
  const ComplianceRegistry = await ethers.getContractFactory("ComplianceRegistry");
  const complianceRegistry = await ComplianceRegistry.deploy(deployer.address);
  await complianceRegistry.waitForDeployment();
  const complianceAddress = await complianceRegistry.getAddress();
  console.log("✅ ComplianceRegistry deployed:", complianceAddress);

  // Deploy ProofOfFundsVaultV2
  console.log("\n💰 Deploying ProofOfFundsVaultV2...");
  const ProofOfFundsVaultV2 = await ethers.getContractFactory("ProofOfFundsVaultV2");
  const vault = await ProofOfFundsVaultV2.deploy(
    attesterAddress,
    complianceAddress, 
    deployer.address
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("✅ ProofOfFundsVaultV2 deployed:", vaultAddress);

  // Setup initial configurations
  console.log("\n⚙️  Setting up initial configurations...");
  
  // Whitelist deployer as attester
  const tx1 = await attesterRegistry.setAttester(deployer.address, true);
  await tx1.wait();
  console.log("✅ Deployer whitelisted as attester");

  // Set up example KYC provider (using deployer for demo)
  const tx2 = await complianceRegistry.setKYCProvider(
    deployer.address, 
    true, 
    "Demo KYC Provider", 
    "https://demo-kyc.example.com"
  );
  await tx2.wait();
  console.log("✅ Demo KYC provider configured");

  // Set up example sanctions version
  const sanctionsVersion = ethers.keccak256(ethers.toUtf8Bytes("OFAC:2025-09-04"));
  const tx3 = await complianceRegistry.setSanctionsVersion(sanctionsVersion, true);
  await tx3.wait();
  console.log("✅ OFAC:2025-09-04 sanctions version enabled");

  // Summary
  console.log("\n🎉 Deployment Complete!");
  console.log("=" .repeat(50));
  console.log(`AttesterRegistry:     ${attesterAddress}`);
  console.log(`ComplianceRegistry:   ${complianceAddress}`);
  console.log(`ProofOfFundsVaultV2:  ${vaultAddress}`);
  console.log("=" .repeat(50));
  
  console.log("\n📝 Environment Variables for Frontend:");
  console.log(`VITE_VAULT_ADDR=${vaultAddress}`);
  console.log(`VITE_REGISTRY_ADDR=${attesterAddress}`);
  console.log(`VITE_COMPLIANCE_ADDR=${complianceAddress}`);
  
  console.log("\n📝 Environment Variables for Attestation Service:");
  console.log(`KYC_PROVIDER_ADDRESS=${deployer.address}`);
  console.log("ATTESTER_PRIVATE_KEY=<your-deployer-private-key>");

  // Verification commands
  console.log("\n🔍 Verification Commands:");
  console.log(`npx hardhat verify --network <network> ${attesterAddress} "${deployer.address}"`);
  console.log(`npx hardhat verify --network <network> ${complianceAddress} "${deployer.address}"`);
  console.log(`npx hardhat verify --network <network> ${vaultAddress} "${attesterAddress}" "${complianceAddress}" "${deployer.address}"`);
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});