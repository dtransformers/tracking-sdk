import { sha256, hmacSHA256, generateNonce } from "../../src/utils/crypto";

describe("Crypto Utils", () => {
  let originalCrypto: Crypto;

  const setCrypto = (mockCrypto: any) => {
    Object.defineProperty(globalThis, "crypto", {
      value: mockCrypto,
      configurable: true,
      writable: true,
    });
  };

  beforeAll(() => {
    // Save original if any
    originalCrypto = globalThis.crypto;
  });

  afterAll(() => {
    setCrypto(originalCrypto);
  });

  describe("sha256", () => {
    it("should compute the correct sha256 hash", async () => {
      // Mock subtle.digest to return a fixed buffer for "test"
      const dummyBuffer = new Uint8Array([1, 2, 3, 4]).buffer;
      setCrypto({
        ...globalThis.crypto,
        subtle: {
          ...globalThis.crypto?.subtle,
          digest: jest.fn().mockResolvedValue(dummyBuffer),
        }
      });

      const result = await sha256("test");
      expect(globalThis.crypto.subtle.digest).toHaveBeenCalledWith(
        "SHA-256",
        expect.anything()
      );
      expect(result).toBe("01020304"); // Hex for 1, 2, 3, 4
    });
  });

  describe("hmacSHA256", () => {
    it("should compute HMAC correctly", async () => {
      const dummyKey = {} as CryptoKey;
      const dummySignature = new Uint8Array([10, 11, 12]).buffer;

      setCrypto({
        ...globalThis.crypto,
        subtle: {
          ...globalThis.crypto?.subtle,
          importKey: jest.fn().mockResolvedValue(dummyKey),
          sign: jest.fn().mockResolvedValue(dummySignature),
        }
      });

      const result = await hmacSHA256("message", "secret");

      expect(globalThis.crypto.subtle.importKey).toHaveBeenCalledWith(
        "raw",
        expect.anything(),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );

      expect(globalThis.crypto.subtle.sign).toHaveBeenCalledWith(
        "HMAC",
        dummyKey,
        expect.anything()
      );

      expect(result).toBe("0a0b0c"); // Hex for 10, 11, 12
    });
  });

  describe("generateNonce", () => {
    it("should use randomUUID if available", () => {
      setCrypto({
        randomUUID: jest.fn().mockReturnValue("fake-uuid-from-randomUUID")
      });

      expect(generateNonce()).toBe("fake-uuid-from-randomUUID");
    });

    it("should use getRandomValues if randomUUID is missing", () => {
      setCrypto({
        getRandomValues: jest.fn((arr: Uint8Array) => {
          for (let i = 0; i < arr.length; i++) {
            arr[i] = 1; // Fake random data
          }
          return arr;
        })
      });

      const nonce = generateNonce();
      // UUID format check with variant modifications
      expect(nonce).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it("should fallback to Math.random if Web Crypto is unavailable", () => {
      setCrypto(undefined); // Remove crypto
      
      const mockMath = Object.create(globalThis.Math);
      mockMath.random = () => 0.5; // Always return 0.5 (results in '8')
      globalThis.Math = mockMath;

      const nonce = generateNonce();
      // Based on the Math.random fallback logic, if r = 8
      // 'x' becomes '8', 'y' becomes (8 & 0x3 | 0x8) -> 8
      expect(nonce).toBe("88888888-8888-4888-8888-888888888888");
    });
  });
});
