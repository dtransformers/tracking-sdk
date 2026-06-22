import { NetworkClient } from "../../src/core/Network";
import { SDKConfig } from "../../src/types/config";

// Mock the crypto utils so we can test the network client deterministically
jest.mock("../../src/utils/crypto", () => ({
  hmacSHA256: jest.fn().mockResolvedValue("mocked-signature"),
  generateNonce: jest.fn().mockReturnValue("mocked-nonce"),
}));

describe("NetworkClient", () => {
  let network: NetworkClient;
  const mockConfig: SDKConfig = {
    publicKey: "test-pub-key",
    secretKey: "test-sec-key",
    serverUrl: "https://api.test.com",
  };

  beforeEach(() => {
    network = new NetworkClient(mockConfig);
    // Ensure fetch mock is fresh
    (globalThis.fetch as jest.Mock).mockClear();
  });

  describe("request", () => {
    it("should successfully make an authenticated request", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true }),
      });

      const response = await network.request("POST", "/test", { data: "test" });

      expect(response).toEqual({ success: true });
      
      // Verify fetch was called with correct URL
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.test.com/test",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-API-Key": "test-pub-key",
            "X-Timestamp": expect.any(String),
            "X-Nonce": "mocked-nonce",
            "X-Signature": "mocked-signature",
          }),
          body: JSON.stringify({ data: "test" }),
        })
      );
    });

    it("should retry on 500 error", async () => {
      // First call fails with 500, second succeeds
      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => "Internal Server Error",
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ success: "retried" }),
        });

      // Using a short timeout mock to speed up test
      jest.spyOn(globalThis, "setTimeout").mockImplementation((cb: any) => {
        cb();
        return 0 as any;
      });

      const response = await network.request("GET", "/retry", undefined, undefined, 1);
      
      expect(response).toEqual({ success: "retried" });
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      
      (globalThis.setTimeout as any).mockRestore();
    });

    it("should throw an error if all retries fail", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "Internal Server Error",
      });

      jest.spyOn(globalThis, "setTimeout").mockImplementation((cb: any) => {
        cb();
        return 0 as any;
      });

      await expect(network.request("GET", "/fail", undefined, undefined, 2))
        .rejects
        .toThrow("Request failed with status 500: Internal Server Error");

      expect(globalThis.fetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
      
      (globalThis.setTimeout as any).mockRestore();
    });

    it("should handle 401 Unauthorized via callbacks", async () => {
      // Mock fetch to return 401
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => "Unauthorized",
      });

      const callbackMock = jest.fn().mockResolvedValue(undefined);
      network.setUnauthorizedHandler(callbackMock);

      await expect(network.request("GET", "/auth")).rejects.toThrow("Unauthorized: Unauthorized");

      expect(callbackMock).toHaveBeenCalledTimes(1);
    });
  });
});
