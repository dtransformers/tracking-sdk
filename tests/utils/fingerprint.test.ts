import {
  detectBrowser,
  detectOS,
  detectDeviceType,
  collectDeviceInfo,
  generateFingerprintHash,
} from "../../src/utils/fingerprint";
import { sha256 } from "../../src/utils/crypto";

// Mock crypto module since fingerprint relies on it
jest.mock("../../src/utils/crypto", () => ({
  sha256: jest.fn().mockResolvedValue("mocked-hash-value"),
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
    it("should concatenate device string and call sha256", async () => {
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
  });
});
