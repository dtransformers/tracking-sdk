import {
  detectBrowser,
  detectOS,
  detectDeviceType,
  collectDeviceInfo,
  generateFingerprintHash,
  resetFingerprintAgent,
} from "../../src/utils/fingerprint";
import { sha256 } from "../../src/utils/crypto";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

// Mock crypto module since fingerprint relies on it
jest.mock("../../src/utils/crypto", () => ({
  sha256: jest.fn().mockResolvedValue("mocked-hash-value"),
}));

// Mock @fingerprintjs/fingerprintjs
jest.mock("@fingerprintjs/fingerprintjs", () => ({
  __esModule: true,
  default: {
    load: jest.fn(),
  },
  load: jest.fn(),
}));

describe("Fingerprint Utils", () => {
  describe("detectBrowser", () => {
    it("should detect Chrome", () => {
      const result = detectBrowser("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0 Safari/537.36");
      expect(result).toEqual({ name: "Chrome", version: "114.0.0" });
    });

    it("should detect Firefox", () => {
      const result = detectBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/113.0");
      expect(result).toEqual({ name: "Firefox", version: "113.0" });
    });

    it("should detect Safari", () => {
      const result = detectBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15");
      expect(result).toEqual({ name: "Safari", version: "16.4" });
    });

    it("should return Unknown for unidentifiable UA", () => {
      const result = detectBrowser("Some weird browser string");
      expect(result).toEqual({ name: "Unknown", version: "Unknown" });
    });
  });

  describe("detectOS", () => {
    it("should detect Windows", () => {
      expect(detectOS("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("Windows");
    });

    it("should detect macOS", () => {
      expect(detectOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("macOS");
    });

    it("should detect iOS", () => {
      expect(detectOS("Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)")).toBe("iOS");
    });

    it("should detect Android", () => {
      expect(detectOS("Mozilla/5.0 (Linux; Android 13; SM-S918B)")).toBe("Android");
    });
  });

  describe("detectDeviceType", () => {
    it("should detect mobile devices", () => {
      expect(detectDeviceType("Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)")).toBe("mobile");
      expect(detectDeviceType("Mozilla/5.0 (Linux; Android 10; Mobile Safari/537.36)")).toBe("mobile");
    });

    it("should detect tablet devices", () => {
      expect(detectDeviceType("Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X)")).toBe("tablet");
      expect(detectDeviceType("Mozilla/5.0 (Linux; Android 10; SM-T860)")).toBe("tablet");
    });

    it("should fallback to desktop", () => {
      expect(detectDeviceType("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
    });
  });

  describe("collectDeviceInfo", () => {
    let originalNavigator: any;
    let originalWindow: any;

    beforeAll(() => {
      // no-op, will use spyOn
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it("should collect all properties safely", () => {
      jest.spyOn(globalThis.navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0");
      jest.spyOn(globalThis.navigator as any, "platform", "get").mockReturnValue("Win32");
      jest.spyOn(globalThis.navigator, "language", "get").mockReturnValue("en-US");

      jest.spyOn(globalThis.window, "screen", "get").mockReturnValue({ width: 1920, height: 1080 } as any);

      const info = collectDeviceInfo();
      expect(info.browser).toBe("Chrome");
      expect(info.os).toBe("Windows");
      expect(info.device_type).toBe("desktop");
      expect(info.screen_width).toBe(1920);
      expect(info.screen_height).toBe(1080);
      expect(info.language).toBe("en-US");
      expect(info.platform).toBe("Win32");
    });
  });

  describe("generateFingerprintHash", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      resetFingerprintAgent();
    });

    it("should return visitorId from FingerprintJS when available", async () => {
      const mockGet = jest.fn().mockResolvedValue({ visitorId: "fpjs-unique-visitor-id" });
      (FingerprintJS.load as jest.Mock).mockResolvedValue({ get: mockGet });

      const result = await generateFingerprintHash();

      expect(FingerprintJS.load).toHaveBeenCalledTimes(1);
      expect(mockGet).toHaveBeenCalled();
      expect(result).toBe("fpjs-unique-visitor-id");

      // Verify agent promise is cached on subsequent call
      const result2 = await generateFingerprintHash();
      expect(FingerprintJS.load).toHaveBeenCalledTimes(1);
      expect(result2).toBe("fpjs-unique-visitor-id");
    });

    it("should fallback to sha256 hash when FingerprintJS load throws an error", async () => {
      (FingerprintJS.load as jest.Mock).mockRejectedValue(new Error("FPJS error"));

      const mockInfo = {
        userAgent: "fake-ua",
        language: "en-US",
        timezone: "UTC",
        screen_width: 1024,
        screen_height: 768,
        platform: "MacIntel",
        browser: "Chrome",
        browser_version: "100",
        os: "macOS",
        device_type: "desktop" as const,
      };

      const result = await generateFingerprintHash(mockInfo);

      expect(sha256).toHaveBeenCalledWith("fake-uaen-USUTC1024768MacIntel");
      expect(result).toBe("mocked-hash-value");
    });

    it("should fallback to sha256 hash when fp.get() throws an error", async () => {
      const mockGet = jest.fn().mockRejectedValue(new Error("get failed"));
      (FingerprintJS.load as jest.Mock).mockResolvedValue({ get: mockGet });

      const mockInfo = {
        userAgent: "fake-ua",
        language: "en-US",
        timezone: "UTC",
        screen_width: 1024,
        screen_height: 768,
        platform: "MacIntel",
        browser: "Chrome",
        browser_version: "100",
        os: "macOS",
        device_type: "desktop" as const,
      };

      const result = await generateFingerprintHash(mockInfo);

      expect(sha256).toHaveBeenCalledWith("fake-uaen-USUTC1024768MacIntel");
      expect(result).toBe("mocked-hash-value");
    });

    it("should fallback when window is undefined", async () => {
      const originalWindow = globalThis.window;
      delete (globalThis as any).window;

      try {
        const mockInfo = {
          userAgent: "node-ua",
          language: "en",
          timezone: "UTC",
          screen_width: 0,
          screen_height: 0,
          platform: "linux",
          browser: "Unknown",
          browser_version: "Unknown",
          os: "Linux",
          device_type: "desktop" as const,
        };

        const result = await generateFingerprintHash(mockInfo);
        expect(sha256).toHaveBeenCalledWith("node-uaenUTC00linux");
        expect(result).toBe("mocked-hash-value");
      } finally {
        globalThis.window = originalWindow;
      }
    });

    it("should automatically collect device info if info argument is omitted on fallback", async () => {
      (FingerprintJS.load as jest.Mock).mockRejectedValue(new Error("FPJS error"));

      jest.spyOn(globalThis.navigator, "userAgent", "get").mockReturnValue("fallback-ua");
      jest.spyOn(globalThis.navigator as any, "platform", "get").mockReturnValue("MacIntel");
      jest.spyOn(globalThis.navigator, "language", "get").mockReturnValue("en");
      jest.spyOn(globalThis.window, "screen", "get").mockReturnValue({ width: 800, height: 600 } as any);

      const result = await generateFingerprintHash();
      expect(sha256).toHaveBeenCalled();
      expect(result).toBe("mocked-hash-value");
    });
  });
});
