import { create as createIPFS } from "ipfs-http-client";

export class IPFSService {
  private client: any;
  private useIPFS: boolean;

  constructor() {
    this.useIPFS = process.env.IPFS_ENABLED === "true";
    
    if (this.useIPFS) {
      try {
        // Configure IPFS client - update with your IPFS node/service
        this.client = createIPFS({
          host: process.env.IPFS_HOST || "localhost",
          port: parseInt(process.env.IPFS_PORT || "5001"),
          protocol: process.env.IPFS_PROTOCOL || "http",
          headers: process.env.IPFS_API_KEY ? {
            authorization: `Bearer ${process.env.IPFS_API_KEY}`
          } : undefined
        });
        console.log("📦 IPFS client initialized");
      } catch (error) {
        console.warn("⚠️  IPFS initialization failed, using mock storage:", error);
        this.useIPFS = false;
      }
    } else {
      console.log("📦 IPFS disabled, using mock storage");
    }
  }

  async pinJSON(data: any): Promise<string> {
    if (!this.useIPFS) {
      // Mock IPFS - return a fake CID for testing
      const mockCID = `bafkreic${Buffer.from(JSON.stringify(data)).toString('hex').slice(0, 50)}`;
      console.log(`📌 Mock IPFS pin: ${mockCID}`);
      
      // In a real app, you might store in a database or S3
      this.storeMockData(mockCID, data);
      return mockCID;
    }

    try {
      const jsonString = JSON.stringify(data, null, 2);
      const result = await this.client.add(Buffer.from(jsonString), {
        pin: true,
        cidVersion: 1
      });
      
      console.log(`📌 IPFS pinned: ${result.cid.toString()}`);
      return result.cid.toString();
    } catch (error) {
      console.error("IPFS pin failed:", error);
      throw new Error("Failed to pin data to IPFS");
    }
  }

  async getJSON(cid: string): Promise<any> {
    if (!this.useIPFS) {
      return this.getMockData(cid);
    }

    try {
      const chunks = [];
      for await (const chunk of this.client.cat(cid)) {
        chunks.push(chunk);
      }
      
      const data = Buffer.concat(chunks).toString();
      return JSON.parse(data);
    } catch (error) {
      console.error("IPFS get failed:", error);
      throw new Error("Failed to retrieve data from IPFS");
    }
  }

  async pinFile(buffer: Buffer, filename?: string): Promise<string> {
    if (!this.useIPFS) {
      const mockCID = `bafkreif${buffer.toString('hex').slice(0, 50)}`;
      console.log(`📌 Mock IPFS file pin: ${mockCID} (${filename || 'unnamed'})`);
      return mockCID;
    }

    try {
      const result = await this.client.add(buffer, {
        pin: true,
        cidVersion: 1,
        wrapWithDirectory: !!filename
      });
      
      console.log(`📌 IPFS file pinned: ${result.cid.toString()}`);
      return result.cid.toString();
    } catch (error) {
      console.error("IPFS file pin failed:", error);
      throw new Error("Failed to pin file to IPFS");
    }
  }

  // Mock storage for testing without IPFS
  private mockStorage = new Map<string, any>();

  private storeMockData(cid: string, data: any): void {
    this.mockStorage.set(cid, data);
  }

  private getMockData(cid: string): any {
    if (!this.mockStorage.has(cid)) {
      throw new Error(`Mock data not found for CID: ${cid}`);
    }
    return this.mockStorage.get(cid);
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    if (!this.useIPFS) {
      return true; // Mock storage is always "healthy"
    }

    try {
      await this.client.id();
      return true;
    } catch (error) {
      return false;
    }
  }
}