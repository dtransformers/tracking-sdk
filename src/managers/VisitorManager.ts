import { SDKConfig } from "../types/config";
import { Logger } from "../utils/logger";
import { NetworkClient } from "../core/Network";
import { StorageService } from "../core/Storage";
import { VisitorResponse, CreateVisitorRequest } from "../types/visitor";
import { collectDeviceInfo, generateFingerprintHash } from "../utils/fingerprint";
import { parseAttributionParams, persistAttribution, getStoredAttribution } from "../utils/attribution";
import { COOKIE_NAMES } from "../constants";

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

  /**
   * @function createVisitor
   * @description Creates a new visitor session
   * @description Contract:
   * Collects device fingerprinting information and current attribution parameters from the URL.
   * Computes the entry page, referrer host, and previous site based on the browser context.
   * Sends a POST request to the tracking server to create a new visitor session and persists the
   * returned session in local storage/cookies automatically.
   * 
   * @returns {Promise<VisitorResponse>} The created visitor response object from the server.
   */
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
      "/events/api/v1/visitors/",
      payload
    );

    Logger.log("VisitorManager", "Visitor session created/verified", response);
    this.currentVisitor = response;
    return response;
  }

  /**
   * @function ensureSession
   * @description Ensures a valid visitor session exists
   * Contract:
   * Verifies if a valid session and visitor UUID exist in the storage. 
   * If either is missing, or if a force refresh is requested, it automatically invokes `createVisitor` 
   * to establish a new session. This ensures that subsequent tracking events have a valid session context.
   * 
   * @param {boolean} [force=false] - If true, forces the creation of a new session even if one exists.
   * @returns {Promise<void>} Resolves when the session is confirmed or newly created.
   */
  async ensureSession(force: boolean = false): Promise<void> {
    const sessionId = this.storage.getCookie(COOKIE_NAMES.SESSION_ID);
    const visitorUuid = this.storage.getCookie(COOKIE_NAMES.VISITOR_UUID);

    Logger.log("VisitorManager",
      `ensureSession: session_id=${sessionId}, visitor_uuid=${visitorUuid}, force=${force}`
    );

    if (force || !sessionId) {
      Logger.log("VisitorManager", "Session not found or force refresh requested. Creating session...");
      await this.createVisitor();
    }
  }

  /**
   * @function getCurrentVisitor
   * @description Gets the current visitor
   * Contract:
   * Returns the currently tracked visitor data from the in-memory cache, which was populated
   * during the last `createVisitor` call.
   * 
   * @returns {VisitorNullable} The current visitor object or null if no session has been initialized.
   */
  getCurrentVisitor(): VisitorNullable {
    return this.currentVisitor;
  }

  /**
   * @function ping
   * @description Sends a ping request to the server
   * Contract:
   * Sends a ping request to the server to verify the connection and keep the current session active.
   * Automatically calls `ensureSession` before executing to guarantee session integrity.
   * 
   * @param {string} [message="pong"] - An optional message payload to send to the server.
   * @returns {Promise<{ message: string }>} Resolves with the server's response message.
   */
  async ping(message: string = "ping"): Promise<{ message: string }> {
    Logger.log("VisitorManager", "Sending ping request...", { message });
    await this.ensureSession();

    const response = await this.network.request<{ message: string }>(
      "POST",
      "/events/api/v1/visitors/ping",
      { message }
    );

    Logger.log("VisitorManager", "Ping response received", response);
    return response;
  }

  /**
   * @function startPeriodicPing
   * @description Starts periodic pings
   * Contract:
   * Initializes a background interval that repeatedly calls the `ping` method.
   * If an interval is already running, it stops the existing one before starting the new one.
   * Any errors thrown by the periodic ping are caught and logged to prevent unhandled promise rejections.
   * 
   * @param {number} [intervalMs=30000] - The interval duration in milliseconds between consecutive pings.
   * @returns {void}
   */
  startPeriodicPing(intervalMs: number = 30000): void {
    this.stopPeriodicPing();
    Logger.log("VisitorManager", `Starting periodic ping every ${intervalMs}ms`);

    this.pingIntervalId = setInterval(() => {
      this.ping().catch((err) => {
        Logger.error("VisitorManager", `Periodic ping failed:`, err);
      });
    }, intervalMs);
  }

  /**
   * @function stopPeriodicPing
   * @description Stops periodic pings
   * Contract:
   * Clears the currently running periodic ping interval, if one exists, preventing further background pings.
   * 
   * @returns {void}
   */
  stopPeriodicPing(): void {
    if (this.pingIntervalId !== undefined) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = undefined;
      Logger.log("VisitorManager", "Stopped periodic ping");
    }
  }
}
