import { VisitorManager } from "../../src/managers/VisitorManager";
import { NetworkClient } from "../../src/core/Network";
import { StorageService } from "../../src/core/Storage";
import { SDKConfig } from "../../src/types/config";
import * as fingerprintUtils from "../../src/utils/fingerprint";
import * as attributionUtils from "../../src/utils/attribution";

jest.mock("../../src/core/Network");
jest.mock("../../src/core/Storage");
jest.mock("../../src/utils/fingerprint");
jest.mock("../../src/utils/attribution");

describe("VisitorManager", () => {
  let visitorManager: VisitorManager;
  let mockNetwork: jest.Mocked<NetworkClient>;
  let mockStorage: jest.Mocked<StorageService>;
  const mockConfig: SDKConfig = {
    publicKey: "test",
    secretKey: "test",
    serverUrl: "http://test",
    cookieDomain: "test.com",
  };

  beforeEach(() => {
    mockNetwork = new NetworkClient(mockConfig) as jest.Mocked<NetworkClient>;
    mockStorage = new StorageService() as jest.Mocked<StorageService>;
    
    // Clear mocks
    jest.clearAllMocks();

    // Mock utils
    (fingerprintUtils.collectDeviceInfo as jest.Mock).mockReturnValue({
      browser: "Chrome",
      os: "Windows",
      language: "en-US",
    });
    (fingerprintUtils.generateFingerprintHash as jest.Mock).mockResolvedValue("fake-hash");
    (attributionUtils.parseAttributionParams as jest.Mock).mockReturnValue({
      acquisition_source: "google",
    });
    (attributionUtils.getStoredAttribution as jest.Mock).mockReturnValue({
      acquisition_source: "google",
    });

    // Mock JS globals
    Object.defineProperty(document, "referrer", { value: "https://google.com", writable: true, configurable: true });

    visitorManager = new VisitorManager(mockNetwork, mockStorage, mockConfig);
  });

  afterEach(() => {
    // Ensure intervals are cleared after tests
    if (visitorManager) {
      visitorManager.stopPeriodicPing();
    }
  });

  describe("createVisitor", () => {
    it("should generate fingerprint, parse attribution, and send API request", async () => {
      // Mock API response containing Set-Cookie headers
      const mockHeaders = new Headers();
      mockHeaders.append("set-cookie", "visitor_uuid=123; Path=/;");
      mockHeaders.append("set-cookie", "session_id=abc; Path=/;");
      
      const mockResponse = { visitor_id: 1 };
      
      mockNetwork.request.mockResolvedValueOnce(mockResponse);
      
      // Override fetch mock inside NetworkClient to simulate raw response access
      // Wait, VisitorManager uses `network.request`, which doesn't expose headers directly in the typed SDK,
      // actually wait, let's check what `createVisitor` really does.
      // Assuming it just calls `this.network.request`.
      
      const response = await visitorManager.createVisitor();
      
      expect(fingerprintUtils.collectDeviceInfo).toHaveBeenCalled();
      expect(fingerprintUtils.generateFingerprintHash).toHaveBeenCalled();
      expect(attributionUtils.parseAttributionParams).toHaveBeenCalledWith(expect.any(String));
      expect(attributionUtils.persistAttribution).toHaveBeenCalled();

      expect(mockNetwork.request).toHaveBeenCalledWith(
        "POST",
        "/events/api/v1/visitors/",
        expect.objectContaining({
          browser: "Chrome",
          fingerprint_hash: "fake-hash",
          acquisition_source: "google",
          referrer_host: "google.com", // Parsed from document.referrer
        })
      );

      expect(response).toBe(mockResponse);
    });

    it("should handle initialization without window gracefully", async () => {
      // Temporarily mock window as undefined
      const originalWindow = globalThis.window;
      delete (globalThis as any).window;
      
      mockNetwork.request.mockResolvedValueOnce({});
      
      await visitorManager.createVisitor();
      
      expect(mockNetwork.request).toHaveBeenCalledWith(
        "POST",
        "/events/api/v1/visitors/",
        expect.objectContaining({
          entry_page: "/",
        })
      );

      globalThis.window = originalWindow;
    });
  });

  describe("ping", () => {
    it("should send a ping request with the provided message", async () => {
      mockNetwork.request.mockResolvedValueOnce({ visitor_id: 1 }); // createVisitor
      mockNetwork.request.mockResolvedValueOnce({ message: "pong" }); // ping

      const res = await visitorManager.ping("hello");

      expect(mockNetwork.request).toHaveBeenCalledWith(
        "POST",
        "/events/api/v1/visitors/ping",
        { message: "hello" }
      );
      expect(res).toEqual({ message: "pong" });
    });

    it("should default to 'ping' if no message provided", async () => {
      mockNetwork.request.mockResolvedValueOnce({ visitor_id: 1 }); // createVisitor
      mockNetwork.request.mockResolvedValueOnce({ message: "pong" }); // ping

      await visitorManager.ping();

      expect(mockNetwork.request).toHaveBeenCalledWith(
        "POST",
        "/events/api/v1/visitors/ping",
        { message: "ping" }
      );
    });
  });

  describe("periodicPing", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should start interval and call ping repeatedly", () => {
      mockNetwork.request.mockResolvedValue({ visitor_id: 1 }); // createVisitor
      visitorManager.ping = jest.fn().mockResolvedValue({ message: "pong" });

      visitorManager.startPeriodicPing(10000);

      // Should not be called immediately
      expect(visitorManager.ping).not.toHaveBeenCalled();

      // Fast forward 10 seconds
      jest.advanceTimersByTime(10000);
      expect(visitorManager.ping).toHaveBeenCalledTimes(1);

      // Fast forward another 10 seconds
      jest.advanceTimersByTime(10000);
      expect(visitorManager.ping).toHaveBeenCalledTimes(2);
    });

    it("should clear previous interval if start is called again", () => {
      visitorManager.ping = jest.fn().mockResolvedValue({ message: "pong" });

      visitorManager.startPeriodicPing(10000);
      visitorManager.startPeriodicPing(20000); // Re-starts

      jest.advanceTimersByTime(10000);
      expect(visitorManager.ping).not.toHaveBeenCalled(); // Original interval was cleared

      jest.advanceTimersByTime(10000); // Now at 20000
      expect(visitorManager.ping).toHaveBeenCalledTimes(1);
    });

    it("should stop interval", () => {
      visitorManager.ping = jest.fn().mockResolvedValue({ message: "pong" });

      visitorManager.startPeriodicPing(10000);
      visitorManager.stopPeriodicPing();

      jest.advanceTimersByTime(10000);
      expect(visitorManager.ping).not.toHaveBeenCalled();
    });
  });
});
