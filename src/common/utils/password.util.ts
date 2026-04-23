import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, existingKey] = storedHash.split("$");

  if (algorithm !== "scrypt" || !salt || !existingKey) {
    return false;
  }

  const incomingKey = scryptSync(password, salt, KEY_LENGTH);
  const existingBuffer = Buffer.from(existingKey, "hex");

  if (incomingKey.byteLength !== existingBuffer.byteLength) {
    return false;
  }

  return timingSafeEqual(incomingKey, existingBuffer);
}
