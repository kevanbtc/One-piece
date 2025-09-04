import axios from "axios";

export interface KYCResult {
  passed: boolean;
  ticketId: string;
  reason?: string;
  timestamp: number;
  provider: string;
}

export interface SanctionsResult {
  passed: boolean;
  reason?: string;
  timestamp: number;
  version: string;
}

export interface CompliancePolicy {
  kycRequired?: boolean;
  sanctionsRequired?: boolean;
  sanctionsDate?: string;
  kycProvider?: string;
  skipChecks?: boolean; // for testing
}

export class ComplianceService {
  private kycApiKey: string;
  private sanctionsApiKey: string;

  constructor() {
    this.kycApiKey = process.env.KYC_API_KEY || "";
    this.sanctionsApiKey = process.env.SANCTIONS_API_KEY || "";
  }

  async performKYC(account: string, policy: CompliancePolicy = {}): Promise<KYCResult> {
    // Skip KYC if not required or in test mode
    if (!policy.kycRequired || policy.skipChecks) {
      return {
        passed: true,
        ticketId: `TEST_${Date.now()}`,
        timestamp: Date.now(),
        provider: "test-provider",
        reason: "Test mode - KYC bypassed"
      };
    }

    try {
      // Mock KYC implementation - replace with real KYC provider
      // Examples: Jumio, Onfido, Persona, etc.
      const kycResponse = await this.mockKYCCheck(account);
      
      return {
        passed: kycResponse.status === "approved",
        ticketId: kycResponse.ticketId,
        timestamp: Date.now(),
        provider: policy.kycProvider || "mock-kyc-provider",
        reason: kycResponse.reason
      };

    } catch (error) {
      console.error("KYC check failed:", error);
      return {
        passed: false,
        ticketId: `FAILED_${Date.now()}`,
        timestamp: Date.now(),
        provider: policy.kycProvider || "mock-kyc-provider",
        reason: "KYC service unavailable"
      };
    }
  }

  async checkSanctions(account: string, policy: CompliancePolicy = {}): Promise<SanctionsResult> {
    // Skip sanctions if not required or in test mode
    if (!policy.sanctionsRequired || policy.skipChecks) {
      return {
        passed: true,
        timestamp: Date.now(),
        version: `OFAC:${policy.sanctionsDate || "2025-09-04"}`,
        reason: "Test mode - sanctions check bypassed"
      };
    }

    try {
      // Mock sanctions screening - replace with real sanctions provider
      // Examples: Chainalysis, Elliptic, ComplyAdvantage, etc.
      const sanctionsResponse = await this.mockSanctionsCheck(account);
      
      return {
        passed: !sanctionsResponse.isMatch,
        timestamp: Date.now(),
        version: `OFAC:${policy.sanctionsDate || "2025-09-04"}`,
        reason: sanctionsResponse.reason
      };

    } catch (error) {
      console.error("Sanctions check failed:", error);
      return {
        passed: false,
        timestamp: Date.now(),
        version: `OFAC:${policy.sanctionsDate || "2025-09-04"}`,
        reason: "Sanctions service unavailable"
      };
    }
  }

  async verifyCompliancePack(compliancePack: any): Promise<boolean> {
    try {
      // Verify the compliance pack structure and integrity
      const requiredFields = ["account", "asset", "amount", "kyc", "sanctions", "metadata"];
      const hasAllFields = requiredFields.every(field => field in compliancePack);
      
      if (!hasAllFields) {
        return false;
      }

      // Verify timestamps are reasonable (within last 24 hours for fresh attestations)
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (compliancePack.metadata.timestamp && (now - compliancePack.metadata.timestamp) > maxAge) {
        console.warn("Compliance pack is older than 24 hours");
        // Don't fail, but log for audit
      }

      // In production, you might verify signatures, check against databases, etc.
      return true;

    } catch (error) {
      console.error("Error verifying compliance pack:", error);
      return false;
    }
  }

  // Mock implementations - replace with real integrations
  private async mockKYCCheck(account: string): Promise<{
    status: "approved" | "rejected" | "pending";
    ticketId: string;
    reason?: string;
  }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Mock logic: reject accounts ending in certain digits
    const lastChar = account.slice(-1).toLowerCase();
    const rejectedChars = ["0", "1", "f"]; // mock rejection criteria
    
    if (rejectedChars.includes(lastChar)) {
      return {
        status: "rejected",
        ticketId: `KYC_${Date.now()}`,
        reason: "Document verification failed"
      };
    }

    return {
      status: "approved",
      ticketId: `KYC_${Date.now()}`,
      reason: "Identity verified successfully"
    };
  }

  private async mockSanctionsCheck(account: string): Promise<{
    isMatch: boolean;
    reason?: string;
  }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Mock logic: flag accounts with specific patterns
    const suspiciousPatterns = ["dead", "beef", "1337"];
    const isSuspicious = suspiciousPatterns.some(pattern => 
      account.toLowerCase().includes(pattern)
    );

    if (isSuspicious) {
      return {
        isMatch: true,
        reason: "Address matches sanctions screening criteria"
      };
    }

    return {
      isMatch: false,
      reason: "No sanctions matches found"
    };
  }
}