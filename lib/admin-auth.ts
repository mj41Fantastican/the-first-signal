import crypto from "crypto";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";

export function getAdminToken(): string {
  return crypto.createHash("sha256").update(ADMIN_PASSWORD + "mj41-admin-salt").digest("hex");
}

export function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  return token === getAdminToken();
}
