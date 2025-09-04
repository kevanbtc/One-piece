import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const AttesterRegistry = await ethers.getContractFactory("AttesterRegistry");
  const registry = await AttesterRegistry.deploy(deployer.address);
  await registry.waitForDeployment();
  console.log("AttesterRegistry:", await registry.getAddress());

  const ProofOfFundsVault = await ethers.getContractFactory("ProofOfFundsVault");
  const vault = await ProofOfFundsVault.deploy(await registry.getAddress(), deployer.address);
  await vault.waitForDeployment();
  console.log("ProofOfFundsVault:", await vault.getAddress());

  // Example: make the deployer an allowed attester
  const tx = await registry.setAttester(deployer.address, true);
  await tx.wait();
  console.log("Whitelisted deployer as attester");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});