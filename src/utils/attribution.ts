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

/**
 * @function parseAttributionParams
 * @description Parses URL query string into attribution data
 * Contract:
 * Parses a raw URL query string into a structured `AttributionData` object.
 * It systematically extracts standard UTM parameters (e.g., `utm_source`), known platform click IDs
 * (e.g., `gclid`, `fbclid`), and resolves explicit campaign mappings. If standard UTMs are present,
 * they automatically fall back to populate the `acquisition_*` fields.
 * 
 * @param {string} search - The raw URL query string (e.g., `?utm_source=google&gclid=123`).
 * @returns {AttributionData} An object containing all successfully parsed attribution metadata.
 */
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

  for (const key of Object.keys(data) as Array<keyof AttributionData>) {
    if (data[key] === undefined) {
      delete data[key];
    }
  }

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
 * @function extractCampaignData
 * @description Extracts campaign data from URL query string
 * Contract:
 * Filters the full parsed attribution data down to strictly the campaign-related metadata fields.
 * This is useful when sending event payloads where deep click-IDs or raw UTMs are not necessary,
 * but the normalized `acquisition_*` and `campaign_*` fields are required.
 * 
 * @param {string} search - The raw URL query string.
 * @returns {CampaignData} A narrowed object containing only campaign tracking fields.
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
 * @function extractClickIds
 * @description Extracts click IDs from URL query string
 * Contract:
 * Filters the full parsed attribution data down to strictly the known platform click IDs 
 * (e.g., Google's `gclid`, Facebook's `fbclid`). This isolates identifier parameters from general 
 * campaign information, often required for server-to-server conversion syncing.
 * 
 * @param {string} search - The raw URL query string.
 * @returns {PlatformClickIds} An object mapping known platform ID keys to their found string values.
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

import { STORAGE_KEYS } from "../constants";

const STORAGE_KEY = STORAGE_KEYS.ATTRIBUTION;

export interface StorageAdapter {
  setLocal(key: string, value: unknown): void;
  getLocal<T>(key: string): T | null;
  setSession(key: string, value: unknown): void;
  getSession<T>(key: string): T | null;
}

/**
 * @function persistAttribution
 * @description Persists attribution data to storage
 * Contract:
 * Writes newly parsed attribution data into both `localStorage` and `sessionStorage`.
 * It first verifies that the parsed object contains at least one defined value to avoid 
 * overwriting existing stored attribution data with empty sessions.
 * 
 * @param {AttributionData} data - The newly parsed attribution metadata object.
 * @param {StorageAdapter} storage - The storage service adapter handling the actual IO.
 * @returns {void}
 */
export function persistAttribution(data: AttributionData, storage: StorageAdapter): void {
  // Only persist if we actually have some attribution data
  const hasData = Object.values(data).some((val) => val !== undefined);
  if (!hasData) return;

  storage.setLocal(STORAGE_KEY, data);
  storage.setSession(STORAGE_KEY, data);
}

/**
 * @function getStoredAttribution
 * @description Gets attribution data from storage
 * Contract:
 * Retrieves previously saved attribution data from local or session storage.
 * It prefers `localStorage` for long-term persistence across sessions but falls back to 
 * `sessionStorage` if necessary. If no data exists, it returns an empty object.
 * 
 * @param {StorageAdapter} storage - The storage service adapter to read from.
 * @returns {AttributionData} The restored attribution metadata, or an empty object.
 */
export function getStoredAttribution(storage: StorageAdapter): AttributionData {
  const localData = storage.getLocal<AttributionData>(STORAGE_KEY);
  if (localData) return localData;

  const sessionData = storage.getSession<AttributionData>(STORAGE_KEY);
  return sessionData || {};
}
