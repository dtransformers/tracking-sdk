/**
 * Computes the SHA-256 hash of a given string.
 *
 * @param {string} message - The input string to hash.
 * @returns {Promise<string>} A promise that resolves to the hexadecimal string representation of the hash.
 */
export async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Computes an HMAC with the SHA-256 hash function using a secret key.
 *
 * @param {string} message - The input string to sign.
 * @param {string} key - The secret key used for computing the HMAC.
 * @returns {Promise<string>} A promise that resolves to the hexadecimal string representation of the HMAC signature.
 */
export async function hmacSHA256(message: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    messageData
  );

  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generates a unique, random string (UUID v4) to be used as a cryptographic nonce.
 *
 * It prefers `crypto.randomUUID()`, falls back to `crypto.getRandomValues()`, 
 * and uses a `Math.random()`-based fallback if Web Crypto API is unavailable.
 *
 * @returns {string} A randomly generated UUID v4 string.
 */
export function generateNonce(): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto) {
    if (typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    if (typeof globalThis.crypto.getRandomValues === "function") {
      const Uint8 = new Uint8Array(16);
      globalThis.crypto.getRandomValues(Uint8);
      // Set version 4 and variant RFC4122
      Uint8[6] = (Uint8[6] & 0x0f) | 0x40;
      Uint8[8] = (Uint8[8] & 0x3f) | 0x80;
      const hex = Array.from(Uint8).map((b) => b.toString(16).padStart(2, "0"));
      return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
    }
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.trunc(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
