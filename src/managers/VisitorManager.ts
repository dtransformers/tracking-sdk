import { SDKConfig } from "../types/config";
import { Logger } from "../utils/logger";
import { NetworkClient } from "../core/Network";
import { StorageService } from "../core/Storage";
import { VisitorResponse, CreateVisitorRequest } from "../types/visitor";
import { collectDeviceInfo, generateFingerprintHash } from "../utils/fingerprint";
import { parseAttributionParams, persistAttribution, getStoredAttribution } from "../utils/attribution";

type VisitorNullable = VisitorResponse | null;

export class VisitorManager {
  private currentVisitor: VisitorNullable = null;
  private pingIntervalId?: ReturnType<typeof setInterval>;

  constructor(
    private readonly network: NetworkClient,
    private readonly storage: StorageService,
    private readonly config: SDKConfig
  ) {
    // Register unauthorized handler for 401 auto-recovery
    this.network.setUnauthorizedHandler(() => this.ensureSession(true));
  }

  async createVisitor(): Promise<VisitorResponse> {
    Logger.log("VisitorManager", "Collecting device info and fingerprint...");
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

    Logger.log("VisitorManager", "Sending create visitor request", payload);
    const response = await this.network.request<VisitorResponse>(
      "POST",
      "/api/v1/visitors/", // Trailing slash is required by Postman
      payload
    );

    Logger.log("VisitorManager", "Visitor session created/verified", response);
    this.currentVisitor = response;
    return response;
  }

  async ensureSession(force = false): Promise<void> {
    const sessionId = this.storage.getCookie("session_id");
    const visitorUuid = this.storage.getCookie("visitor_uuid");

    Logger.log("VisitorManager", 
      `ensureSession: session_id=${sessionId}, visitor_uuid=${visitorUuid}, force=${force}`
    );

    if (force || !sessionId) {
      Logger.log("VisitorManager", "Session not found or force refresh requested. Creating session...");
      await this.createVisitor();
    }
  }

  getCurrentVisitor(): VisitorNullable {
    return this.currentVisitor;
  }

  async ping(message: string = "pong"): Promise<{ message: string }> {
    Logger.log("VisitorManager", "Sending ping request...", { message });
    await this.ensureSession();
    
    const response = await this.network.request<{ message: string }>(
      "POST",
      "/api/v1/visitors/ping",
      { message }
    );
    
    Logger.log("VisitorManager", "Ping response received", response);
    return response;
  }

  startPeriodicPing(intervalMs: number = 30000): void {
    this.stopPeriodicPing();
    Logger.log("VisitorManager", `Starting periodic ping every ${intervalMs}ms`);
    
    this.pingIntervalId = setInterval(() => {
      this.ping().catch((err) => {
        Logger.error("VisitorManager", `Periodic ping failed:`, err);
      });
    }, intervalMs);
  }

  stopPeriodicPing(): void {
    if (this.pingIntervalId !== undefined) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = undefined;
      Logger.log("VisitorManager", "Stopped periodic ping");
    }
  }
}
