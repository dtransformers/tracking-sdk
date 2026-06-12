import { ConsentManager } from "../../src/managers/ConsentManager";
import { NetworkClient } from "../../src/core/Network";
import { StorageService } from "../../src/core/Storage";
import { SDKConfig } from "../../src/types/config";

// Mock NetworkClient and StorageService
jest.mock("../../src/core/Network");
jest.mock("../../src/core/Storage");

describe("ConsentManager", () => {
  let consentManager: ConsentManager;
  let mockNetwork: jest.Mocked<NetworkClient>;
  let mockStorage: jest.Mocked<StorageService>;
  const mockConfig: SDKConfig = {
    publicKey: "test",
    secretKey: "test",
    serverUrl: "http://test",
  };

  let storageState: Record<string, any>;

  beforeEach(() => {
    mockNetwork = new NetworkClient(mockConfig) as jest.Mocked<NetworkClient>;
    mockStorage = new StorageService() as jest.Mocked<StorageService>;
    storageState = {};

    (mockStorage as any).getLocal.mockImplementation((key: string) => storageState[key] || null);
    (mockStorage as any).setLocal.mockImplementation((key: string, val: any) => {
      storageState[key] = val;
    });

    consentManager = new ConsentManager(mockNetwork, mockStorage);
  });

  describe("getStatus", () => {
    it("should return 'pending' by default", () => {
      expect(consentManager.getStatus("tracking")).toBe("pending");
      expect(consentManager.getStatus("marketing")).toBe("pending");
    });

    it("should load status from storage on initialization", () => {
      storageState = {
        consent_tracking: "granted",
        consent_marketing: "denied",
      };

      const newManager = new ConsentManager(mockNetwork, mockStorage);

      expect(newManager.getStatus("tracking")).toBe("granted");
      expect(newManager.getStatus("marketing")).toBe("denied");
      expect(newManager.getStatus("functional")).toBe("pending"); // Default if missing
    });
  });

  describe("grant", () => {
    it("should update status, save to storage, and send API request", async () => {
      mockNetwork.request.mockResolvedValueOnce({});

      mockNetwork.request.mockResolvedValue({});
      await consentManager.grant("tracking");

      expect(consentManager.getStatus("tracking")).toBe("granted");

      // Verify it was saved to storage
      expect((mockStorage as any).setLocal).toHaveBeenCalledWith(
        "consent_tracking",
        "granted"
      );

      // Verify network request
      expect(mockNetwork.request).toHaveBeenCalledWith(
        "POST",
        "/api/v1/consents/",
        {
          consent_type: "tracking",
          status: "granted",
        }
      );
    });

    it("should log error if API request fails but keep local state updated", async () => {
      mockNetwork.request.mockRejectedValueOnce(new Error("Network Error"));

      // Should not throw, should handle internally (with Logger, though we mock Logger)
      await consentManager.grant("marketing");

      expect(consentManager.getStatus("marketing")).toBe("granted");
    });
  });

  describe("deny", () => {
    it("should update status to denied, save to storage, and send API request", async () => {
      mockNetwork.request.mockResolvedValueOnce({});

      mockNetwork.request.mockResolvedValue({});
      await consentManager.deny("functional");

      expect(consentManager.getStatus("functional")).toBe("denied");

      expect((mockStorage as any).setLocal).toHaveBeenCalledWith(
        "consent_functional",
        "denied"
      );

      expect(mockNetwork.request).toHaveBeenCalledWith(
        "POST",
        "/api/v1/consents/",
        {
          consent_type: "functional",
          status: "denied",
        }
      );
    });
  });
});
