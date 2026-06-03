import { PlatformClickIds } from "../types/events";

export interface AttributionData extends PlatformClickIds {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;

  acquisition_source?: string;
  acquisition_medium?: string;
  acquisition_campaign?: string;
  campaign_id?: string;
  campaign_content?: string;
  campaign_term?: string;
}

export function parseAttributionParams(search: string): AttributionData {
  if (typeof URLSearchParams === "undefined") {
    return {};
  }
  const params = new URLSearchParams(search);
  const data: AttributionData = {};

  const get = (key: string) => params.get(key) || undefined;

  // Standard UTMs
  data.utm_source = get("utm_source");
  data.utm_medium = get("utm_medium");
  data.utm_campaign = get("utm_campaign");
  data.utm_term = get("utm_term");
  data.utm_content = get("utm_content");

  // Click IDs
  data.gclid = get("gclid");
  data.gbraid = get("gbraid");
  data.wbraid = get("wbraid");
  data.fbclid = get("fbclid");
  data.fbc = get("fbc");
  data.fbp = get("fbp");
  data.ttclid = get("ttclid");
  data.ttp = get("ttp");
  data.twclid = get("twclid");
  data.msclkid = get("msclkid");
  data.li_fat_id = get("li_fat_id");
  data.epik = get("epik");
  data.dclid = get("dclid");
  data.ScCid = get("ScCid");
  data.liveramp_ats_id = get("liveramp_ats_id");

  // Campaign mapping (supports both direct query parameters and UTM fallback)
  data.acquisition_source = get("acquisition_source") || data.utm_source;
  data.acquisition_medium = get("acquisition_medium") || data.utm_medium;
  data.acquisition_campaign = get("acquisition_campaign") || data.utm_campaign;
  data.campaign_id = get("campaign_id") || get("utm_id");
  data.campaign_content = get("campaign_content") || data.utm_content;
  data.campaign_term = get("campaign_term") || data.utm_term;

  return data;
}

export interface CampaignData {
  acquisition_source?: string;
  acquisition_medium?: string;
  acquisition_campaign?: string;
  campaign_id?: string;
  campaign_content?: string;
  campaign_term?: string;
}

/**
 * Extracts only the campaign-related fields from a query string.
 */
export function extractCampaignData(search: string): CampaignData {
  const parsed = parseAttributionParams(search);
  return {
    acquisition_source: parsed.acquisition_source,
    acquisition_medium: parsed.acquisition_medium,
    acquisition_campaign: parsed.acquisition_campaign,
    campaign_id: parsed.campaign_id,
    campaign_content: parsed.campaign_content,
    campaign_term: parsed.campaign_term,
  };
}

/**
 * Extracts click IDs from the parsed attribution data.
 */
export function extractClickIds(search: string): PlatformClickIds {
  const parsed = parseAttributionParams(search);
  const clickIds: PlatformClickIds = {};

  const keys: (keyof PlatformClickIds)[] = [
    "gclid",
    "gbraid",
    "wbraid",
    "fbclid",
    "fbc",
    "fbp",
    "ttclid",
    "ttp",
    "twclid",
    "msclkid",
    "li_fat_id",
    "epik",
    "dclid",
    "ScCid",
    "liveramp_ats_id",
  ];

  for (const key of keys) {
    if (parsed[key]) {
      clickIds[key] = parsed[key];
    }
  }

  return clickIds;
}

const STORAGE_KEY = "__tk_attribution";

export interface StorageAdapter {
  setLocal(key: string, value: unknown): void;
  getLocal<T>(key: string): T | null;
  setSession(key: string, value: unknown): void;
  getSession<T>(key: string): T | null;
}

export function persistAttribution(data: AttributionData, storage: StorageAdapter): void {
  // Only persist if we actually have some attribution data
  const hasData = Object.values(data).some((val) => val !== undefined);
  if (!hasData) return;

  storage.setLocal(STORAGE_KEY, data);
  storage.setSession(STORAGE_KEY, data);
}

export function getStoredAttribution(storage: StorageAdapter): AttributionData {
  const localData = storage.getLocal<AttributionData>(STORAGE_KEY);
  if (localData) return localData;

  const sessionData = storage.getSession<AttributionData>(STORAGE_KEY);
  return sessionData || {};
}
