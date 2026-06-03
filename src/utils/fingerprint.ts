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

export function detectOS(ua: string): string {
  if (/Windows NT/i.test(ua)) return "Windows";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown";
}

export function detectDeviceType(ua: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|android(?!.*mobi)/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|blackberry|opera mini|opera mobi|iemobile|fennec/i.test(ua)) return "mobile";
  return "desktop";
}

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

export async function generateFingerprintHash(info: DeviceInfo): Promise<string> {
  const rawString = `${info.userAgent}${info.language}${info.timezone}${info.screen_width}${info.screen_height}${info.platform}`;
  return sha256(rawString);
}
