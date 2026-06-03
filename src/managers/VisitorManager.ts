import { SDKConfig } from "../types/config";
import { NetworkClient } from "../core/Network";
import { StorageService } from "../core/Storage";
import { VisitorResponse, CreateVisitorRequest } from "../types/visitor";
import { collectDeviceInfo, generateFingerprintHash } from "../utils/fingerprint";
import { parseAttributionParams, persistAttribution, getStoredAttribution } from "../utils/attribution";

type VisitorNullable = VisitorResponse | null;

export class VisitorManager {
  private currentVisitor: VisitorNullable = null;

  constructor(
    private readonly network: NetworkClient,
    private readonly storage: StorageService,
    private readonly config: SDKConfig
  ) {
    // Register unauthorized handler for 401 auto-recovery
    this.network.setUnauthorizedHandler(() => this.ensureSession(true));
  }

  private log(message: string, ...args: any[]): void {
    if (this.config.debug) {
      console.log(`[Tracking SDK] [VisitorManager] ${message}`, ...args);
    }
  }

  async createVisitor(): Promise<VisitorResponse> {
    this.log("Collecting device info and fingerprint...");
    const deviceInfo = collectDeviceInfo();
    const fingerprintHash = await generateFingerprintHash(deviceInfo);

    // Parse and persist current attribution parameters from URL
    const search = globalThis.window === undefined ? "" : globalThis.window.location.search;
    const currentAttr = parseAttributionParams(search);
    persistAttribution(currentAttr, this.storage);

    // Get all stored attribution context (URL params + stored history)
    const attribution = getStoredAttribution(this.storage);

    // Compute entry page
    const entryPage = globalThis.window === undefined
      ? "/"
      : globalThis.window.location.pathname + globalThis.window.location.search;

    // Compute referrer host and previous site
    let referrerHost = "";
    let previousSite = "";
    const referrer = globalThis.document?.referrer;
    if (referrer) {
      previousSite = referrer;
      try {
        const refUrl = new URL(referrer);
        referrerHost = refUrl.hostname;
      } catch (e) {
        if (this.config.debug) {
          console.warn("[Tracking SDK] Failed to parse referrer URL", e);
        }
        referrerHost = referrer;
      }
    }

    const payload: CreateVisitorRequest = {
      browser: deviceInfo.browser,
      browser_version: deviceInfo.browser_version,
      os: deviceInfo.os,
      device_type: deviceInfo.device_type,
      fingerprint_hash: fingerprintHash,
      screen_width: deviceInfo.screen_width,
      screen_height: deviceInfo.screen_height,
      language: deviceInfo.language,
      timezone: deviceInfo.timezone,
      entry_page: entryPage,
      referrer_host: referrerHost,
      previous_site: previousSite,

      // Campaign details
      acquisition_source: attribution.acquisition_source,
      acquisition_medium: attribution.acquisition_medium,
      acquisition_campaign: attribution.acquisition_campaign,
      campaign_id: attribution.campaign_id,
      campaign_content: attribution.campaign_content,
      campaign_term: attribution.campaign_term,
    };

    this.log("Sending create visitor request", payload);
    const response = await this.network.request<VisitorResponse>(
      "POST",
      "/api/v1/visitors/", // Trailing slash is required by Postman
      payload
    );

    this.log("Visitor session created/verified", response);
    this.currentVisitor = response;
    return response;
  }

  async ensureSession(force = false): Promise<void> {
    const sessionId = this.storage.getCookie("session_id");
    const visitorUuid = this.storage.getCookie("visitor_uuid");

    this.log(
      `ensureSession: session_id=${sessionId}, visitor_uuid=${visitorUuid}, force=${force}`
    );

    if (force || !sessionId) {
      this.log("Session not found or force refresh requested. Creating session...");
      await this.createVisitor();
    }
  }

  getCurrentVisitor(): VisitorNullable {
    return this.currentVisitor;
  }
}
