import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { AttesterRegistry, ComplianceRegistry, ProofOfFundsVaultV2 } from "../typechain-types";

describe("ProofOfFundsVaultV2", function () {
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let attester: HardhatEthersSigner;
  let attesterRegistry: AttesterRegistry;
  let complianceRegistry: ComplianceRegistry;
  let vault: ProofOfFundsVaultV2;

  beforeEach(async function () {
    [owner, user, attester] = await ethers.getSigners();

    // Deploy AttesterRegistry
    const AttesterRegistry = await ethers.getContractFactory("AttesterRegistry");
    attesterRegistry = await AttesterRegistry.deploy(owner.address);
    await attesterRegistry.waitForDeployment();

    // Deploy ComplianceRegistry
    const ComplianceRegistry = await ethers.getContractFactory("ComplianceRegistry");
    complianceRegistry = await ComplianceRegistry.deploy(owner.address);
    await complianceRegistry.waitForDeployment();

    // Deploy ProofOfFundsVaultV2
    const ProofOfFundsVaultV2 = await ethers.getContractFactory("ProofOfFundsVaultV2");
    vault = await ProofOfFundsVaultV2.deploy(
      await attesterRegistry.getAddress(),
      await complianceRegistry.getAddress(),
      owner.address
    );
    await vault.waitForDeployment();

    // Setup attesters
    await attesterRegistry.setAttester(attester.address, true);
  });

  describe("Uniqueness Enforcement", function () {
    it("should prevent duplicate uniqueKey usage", async function () {
      const uniqueKey = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "address"],
          [user.address, owner.address]
        )
      );

      // First mint should succeed (but will revert due to no ERC20 approval)
      // This tests that uniqueness logic executes before ERC20 transfer
      await expect(
        vault.connect(user).mintEscrow(
          owner.address, // mock asset
          1,
          0,
          ethers.ZeroAddress,
          ethers.ZeroHash,
          ethers.ZeroHash,
          "",
          ethers.ZeroHash,
          uniqueKey
        )
      ).to.be.reverted; // Expected: ERC20 transfer fails, but uniqueness is reserved

      // Try to use same uniqueKey should fail with UNIQUE_KEY_ACTIVE
      await expect(
        vault.connect(user).mintEscrow(
          owner.address,
          1,
          0,
          ethers.ZeroAddress,
          ethers.ZeroHash,
          ethers.ZeroHash,
          "",
          ethers.ZeroHash,
          uniqueKey
        )
      ).to.be.revertedWith("UNIQUE_KEY_ACTIVE");
    });

    it("should allow zero uniqueKey (no uniqueness constraint)", async function () {
      const zeroKey = ethers.ZeroHash;

      // Both calls should reach the ERC20 transfer (and fail there)
      await expect(
        vault.connect(user).mintEscrow(
          owner.address,
          1,
          0,
          ethers.ZeroAddress,
          ethers.ZeroHash,
          ethers.ZeroHash,
          "",
          ethers.ZeroHash,
          zeroKey
        )
      ).to.be.reverted;

      await expect(
        vault.connect(user).mintEscrow(
          owner.address,
          1,
          0,
          ethers.ZeroAddress,
          ethers.ZeroHash,
          ethers.ZeroHash,
          "",
          ethers.ZeroHash,
          zeroKey
        )
      ).to.be.reverted;
    });
  });

  describe("Verification", function () {
    it("should return TOKEN_NOT_FOUND for non-existent token", async function () {
      const [valid, reason] = await vault.verify(999, ethers.ZeroAddress, 0);
      expect(valid).to.be.false;
      expect(reason).to.equal("TOKEN_NOT_FOUND");
    });
  });

  describe("Soulbound Mode", function () {
    it("should toggle soulbound mode", async function () {
      expect(await vault.soulbound()).to.be.false;
      
      await vault.setSoulbound(true);
      expect(await vault.soulbound()).to.be.true;
      
      await vault.setSoulbound(false);
      expect(await vault.soulbound()).to.be.false;
    });
  });

  describe("Compliance Integration", function () {
    it("should validate KYC providers from ComplianceRegistry", async function () {
      const mockKYCProvider = user.address;
      
      // Should revert with unregistered KYC provider
      await expect(
        vault.connect(user).mintEscrow(
          owner.address,
          1,
          0,
          mockKYCProvider, // unregistered KYC provider
          ethers.ZeroHash,
          ethers.ZeroHash,
          "",
          ethers.ZeroHash,
          ethers.ZeroHash
        )
      ).to.be.revertedWith("KYC_PROVIDER_NOT_ALLOWED");

      // Register KYC provider
      await complianceRegistry.setKYCProvider(mockKYCProvider, true, "Test KYC", "https://test.kyc");

      // Should now proceed to ERC20 transfer (and fail there)
      await expect(
        vault.connect(user).mintEscrow(
          owner.address,
          1,
          0,
          mockKYCProvider,
          ethers.ZeroHash,
          ethers.ZeroHash,
          "",
          ethers.ZeroHash,
          ethers.ZeroHash
        )
      ).to.be.reverted; // ERC20 transfer failure
    });
  });

  describe("EIP-712 Attestation", function () {
    it("should validate EIP-712 signature structure", async function () {
      const domain = {
        name: "ProofOfFundsVault",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await vault.getAddress(),
      };

      const types = {
        Attestation: [
          { name: "account", type: "address" },
          { name: "asset", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "expiry", type: "uint256" },
          { name: "nonce", type: "uint256" },
        ],
      };

      const value = {
        account: user.address,
        asset: owner.address,
        amount: 1000,
        expiry: 0,
        nonce: 0,
      };

      // Sign with non-attester (should fail)
      const invalidSignature = await user.signTypedData(domain, types, value);
      const invalidSig = ethers.Signature.from(invalidSignature);

      await expect(
        vault.connect(user).mintAttested(
          user.address,
          owner.address,
          1000,
          0,
          invalidSig.v,
          invalidSig.r,
          invalidSig.s,
          ethers.ZeroAddress,
          ethers.ZeroHash,
          ethers.ZeroHash,
          "",
          ethers.ZeroHash,
          ethers.ZeroHash
        )
      ).to.be.revertedWith("invalid attester");

      // Sign with valid attester
      const validSignature = await attester.signTypedData(domain, types, value);
      const validSig = ethers.Signature.from(validSignature);

      // Should succeed (creates token)
      await expect(
        vault.connect(user).mintAttested(
          user.address,
          owner.address,
          1000,
          0,
          validSig.v,
          validSig.r,
          validSig.s,
          ethers.ZeroAddress,
          ethers.ZeroHash,
          ethers.ZeroHash,
          "",
          ethers.ZeroHash,
          ethers.ZeroHash
        )
      ).to.emit(vault, "Minted");
    });
  });
});