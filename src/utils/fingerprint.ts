import { sha256 } from "./crypto";

export interface DeviceInfo {
  browser: string;
  browser_version: string;
  os: string;
  device_type: "mobile" | "tablet" | "desktop";
  screen_width: number;
  screen_height: number;
  language: string;
  timezone: string;
  platform: string;
  userAgent: string;
}

interface BrowserRule {
  name: string;
  test: RegExp;
  versionMatches: RegExp[];
}

const BROWSER_RULES: BrowserRule[] = [
  {
    name: "Opera",
    test: /OPR\/|Opera\//i,
    versionMatches: [/(?:OPR|Opera)\/([0-9.]+)/i],
  },
  {
    name: "Edge",
    test: /Edg\/|Edge\//i,
    versionMatches: [/(?:Edg|Edge)\/([0-9.]+)/i],
  },
  {
    name: "Chrome",
    test: /Chrome\//i,
    versionMatches: [/Chrome\/([0-9.]+)/i],
  },
  {
    name: "Firefox",
    test: /Firefox\//i,
    versionMatches: [/Firefox\/([0-9.]+)/i],
  },
  {
    name: "Safari",
    test: /Safari\//i,
    versionMatches: [/Version\/([0-9.]+)/i, /Safari\/([0-9.]+)/i],
  },
  {
    name: "IE",
    test: /MSIE |Trident\//i,
    versionMatches: [/(?:MSIE |rv:)([0-9.]+)/i],
  },
];

/**
 * Contract:
 * Parses a User-Agent string to identify the browser name and its specific version.
 * Evaluates the UA string against a series of regular expression rules in a predefined order 
 * (Opera, Edge, Chrome, Firefox, Safari, IE). Returns "Unknown" if no rules match.
 * 
 * @param {string} ua - The raw User-Agent string from the browser.
 * @returns {{ name: string; version: string }} An object containing the resolved browser name and version.
 */
export function detectBrowser(ua: string): { name: string; version: string } {
  for (const rule of BROWSER_RULES) {
    if (rule.test.test(ua)) {
      let version = "Unknown";
      for (const versionMatch of rule.versionMatches) {
        const match = versionMatch.exec(ua);
        if (match) {
          version = match[1];
          break;
        }
      }
      return { name: rule.name, version };
    }
  }
  return { name: "Unknown", version: "Unknown" };
}

/**
 * Contract:
 * Evaluates the User-Agent string to determine the underlying operating system.
 * Supports detection for Windows, Android, iOS, macOS, and Linux.
 * 
 * @param {string} ua - The raw User-Agent string.
 * @returns {string} The identified OS name, or "Unknown" if unidentifiable.
 */
export function detectOS(ua: string): string {
  if (/Windows NT/i.test(ua)) return "Windows";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown";
}

/**
 * Contract:
 * Uses heuristic matching on the User-Agent string to categorize the device's form factor.
 * Differentiates between "tablet" (e.g., iPads, non-mobile Androids), "mobile" (e.g., iPhones, mobile browsers), 
 * and defaults to "desktop" for everything else.
 * 
 * @param {string} ua - The raw User-Agent string.
 * @returns {"mobile" | "tablet" | "desktop"} The classified device category.
 */
export function detectDeviceType(ua: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|android(?!.*mobi)/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|blackberry|opera mini|opera mobi|iemobile|fennec/i.test(ua)) return "mobile";
  return "desktop";
}

/**
 * Contract:
 * Aggregates various browser properties and hardware capabilities to form a comprehensive 
 * device profile. It safely reads from `globalThis.navigator` and `globalThis.window` to 
 * ensure compatibility with SSR environments. Captures browser, OS, device type, screen dimensions,
 * language, and the user's local timezone.
 * 
 * @returns {DeviceInfo} A structured object detailing the user's device and browser environment.
 */
export function collectDeviceInfo(): DeviceInfo {
  const ua = globalThis.navigator?.userAgent || "";
  const platform = globalThis.navigator?.platform || "";
  const language = globalThis.navigator?.language || "en";
  let timezone = "UTC";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    // Fallback to UTC if timezone lookup fails
  }

  const { name: browser, version: browser_version } = detectBrowser(ua);
  const os = detectOS(ua);
  const device_type = detectDeviceType(ua);

  const screen_width = globalThis.window?.screen?.width || 0;
  const screen_height = globalThis.window?.screen?.height || 0;

  return {
    browser,
    browser_version,
    os,
    device_type,
    screen_width,
    screen_height,
    language,
    timezone,
    platform,
    userAgent: ua,
  };
}

/**
 * Contract:
 * Generates a stable cryptographic hash (SHA-256) of the device's core hardware and browser 
 * characteristics. This fingerprint acts as a highly probable unique identifier for the device,
 * allowing tracking systems to correlate anonymous sessions without relying exclusively on cookies.
 * 
 * @param {DeviceInfo} info - The aggregated device profile data.
 * @returns {Promise<string>} A hexadecimal string representation of the SHA-256 fingerprint hash.
 */
export async function generateFingerprintHash(info: DeviceInfo): Promise<string> {
  const rawString = `${info.userAgent}${info.language}${info.timezone}${info.screen_width}${info.screen_height}${info.platform}`;
  return sha256(rawString);
}
