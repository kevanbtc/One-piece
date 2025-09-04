import { ethers } from "ethers";

export interface AttestationParams {
  chainId: number;
  vaultAddress: string;
  account: string;
  asset: string;
  amount: bigint;
  expiry: bigint;
  nonce: number;
}

export class AttestationService {
  private signer: ethers.Wallet;

  constructor() {
    const privateKey = process.env.ATTESTER_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("ATTESTER_PRIVATE_KEY environment variable is required");
    }

    this.signer = new ethers.Wallet(privateKey);
    console.log(`🔑 Attester initialized: ${this.signer.address}`);
  }

  async signAttestation(params: AttestationParams): Promise<{
    v: number;
    r: string;
    s: string;
    signature: string;
  }> {
    // EIP-712 domain
    const domain = {
      name: "ProofOfFundsVault",
      version: "1",
      chainId: params.chainId,
      verifyingContract: params.vaultAddress,
    };

    // EIP-712 types
    const types = {
      Attestation: [
        { name: "account", type: "address" },
        { name: "asset", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "expiry", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    };

    // EIP-712 value
    const value = {
      account: params.account,
      asset: params.asset,
      amount: params.amount,
      expiry: params.expiry,
      nonce: params.nonce,
    };

    try {
      // Sign the typed data
      const signature = await this.signer.signTypedData(domain, types, value);

      // Parse signature into v, r, s components
      const sig = ethers.Signature.from(signature);

      return {
        v: sig.v,
        r: sig.r,
        s: sig.s,
        signature,
      };
    } catch (error) {
      console.error("Error signing attestation:", error);
      throw new Error("Failed to sign attestation");
    }
  }

  getAttesterAddress(): string {
    return this.signer.address;
  }

  // Verify a signature (for testing/debugging)
  async verifyAttestation(params: AttestationParams, signature: string): Promise<boolean> {
    try {
      const domain = {
        name: "ProofOfFundsVault",
        version: "1",
        chainId: params.chainId,
        verifyingContract: params.vaultAddress,
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
        account: params.account,
        asset: params.asset,
        amount: params.amount,
        expiry: params.expiry,
        nonce: params.nonce,
      };

      const recoveredAddress = ethers.verifyTypedData(domain, types, value, signature);
      return recoveredAddress.toLowerCase() === this.signer.address.toLowerCase();
    } catch (error) {
      console.error("Error verifying attestation:", error);
      return false;
    }
  }
}