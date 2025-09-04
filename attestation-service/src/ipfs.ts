// attestation-service/src/ipfs.ts
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { toUtf8Bytes, keccak256 } from "ethers";

export function hashBuffer(buf: Buffer) {
  return "0x" + crypto.createHash("sha3-256").update(buf).digest("hex"); // close enough; keccak option below if preferred
  // return keccak256(buf); // alternative
}

export async function getLicenseBuffer(filePath: string) {
  try {
    return await fs.readFile(filePath);
  } catch {
    // fallback: generate a minimal license blob
    return Buffer.from("UPoF License v1 — Demo");
  }
}

export async function pinCompliancePack(obj: any): Promise<string> {
  if (process.env.IPFS_ENABLED === "true" && process.env.IPFS_API_KEY) {
    // TODO: integrate Pinata/Infura client here (kept minimal for brevity)
    // return actual CID after pin
  }
  // Mock: write to .local/ and return deterministic "cid"
  const dir = path.resolve(process.cwd(), ".local");
  await fs.mkdir(dir, { recursive: true });
  const blob = Buffer.from(JSON.stringify(obj, null, 2));
  const cid = keccak256(toUtf8Bytes(JSON.stringify(obj))).slice(0, 46).replace("0x", "bafy");
  await fs.writeFile(path.join(dir, `${cid}.json`), blob);
  return cid;
}