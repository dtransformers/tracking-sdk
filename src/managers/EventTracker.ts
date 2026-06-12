import { SDKConfig } from "../types/config";
import { Logger } from "../utils/logger";
import { NetworkClient } from "../core/Network";
import { VisitorManager } from "./VisitorManager";
import { CreatePageViewRequest, CreateCustomEventRequest } from "../types/events";
import { extractClickIds } from "../utils/attribution";

export class EventTracker {
  private eventSequence = 1;
  private originalPushState: any = null;
  private originalReplaceState: any = null;
  private popStateListener: any = null;
  private isAutoTracking = false;
  private lastUrl = globalThis.window === undefined ? "" : globalThis.window.location.href;

  constructor(
    private readonly network: NetworkClient,
    private readonly visitorManager: VisitorManager,
    private readonly config: SDKConfig
  ) { }

  /**
   * @function trackPageView
   * @description Tracks a page view event
   * Contract:
   * Captures a page view event and sends it to the tracking server.
   * If `data` is partially provided, it automatically fills in missing fields (url, referrer, title) 
   * by inspecting the global `window` and `document` objects.
   * Ensures that a valid session exists prior to tracking the event.
   * 
   * @param {Partial<CreatePageViewRequest>} [data] - Optional partial page view data overriding auto-collected values.
   * @returns {Promise<void>} Resolves when the page view request completes successfully.
   */
  async trackPageView(data?: Partial<CreatePageViewRequest>): Promise<void> {
    Logger.log("EventTracker", "Tracking page view...");
    await this.visitorManager.ensureSession();

    const payload: CreatePageViewRequest = {
      url: data?.url || (globalThis.window === undefined ? "" : globalThis.window.location.href),
      referrer:
        data?.referrer || (globalThis.document === undefined ? "" : globalThis.document.referrer),
      title: data?.title || (globalThis.document === undefined ? "" : globalThis.document.title),
    };

    await this.network.request<void>("POST", "/api/v1/events/pageviews", payload);
    Logger.log("EventTracker", "Page view tracked successfully", payload);
  }

  /**
   * @function trackCustomEvent
   * @description Tracks a custom user-defined event
   * Contract:
   * Tracks a custom user-defined event, attaching SDK metadata, timestamps, and an auto-incrementing sequence number.
   * If URL click IDs (e.g. gclid, fbclid) are not explicitly provided, it parses them from the current URL.
   * Ensures the visitor session is established before sending the payload.
   * 
   * @param {CreateCustomEventRequest} data - The custom event details including name, category, and specific properties.
   * @returns {Promise<void>} Resolves when the custom event is successfully tracked on the server.
   */
  async trackCustomEvent(data: CreateCustomEventRequest): Promise<void> {
    Logger.log("EventTracker", `Tracking custom event: ${data.name}...`);
    await this.visitorManager.ensureSession();

    // Auto-populate sequence number if not set
    const sequence = data.sequence ?? this.eventSequence++;

    // Extract click ids if none are provided
    const clickIds =
      data.click_ids ||
      (globalThis.window === undefined ? {} : extractClickIds(globalThis.window.location.search));

    const payload: CreateCustomEventRequest = {
      ...data,
      occurred_at: data.occurred_at || new Date().toISOString(),
      sdk_name: data.sdk_name || "tracking-sdk",
      sdk_version: data.sdk_version || "1.0.1",
      sequence,
      click_ids: clickIds,
    };

    await this.network.request<void>("POST", "/api/v1/events/custom", payload);
    Logger.log("EventTracker", "Custom event tracked successfully", payload);
  }

  /**
   * @function enableAutoTrack
   * @description Enables automatic page view tracking
   * Contract:
   * Enables automatic page view tracking for Single Page Applications (SPAs).
   * It tracks the initial page load, patches the History API (`pushState`, `replaceState`),
   * and listens to `popstate` events to automatically detect route changes and fire subsequent page views.
   * Idempotent; does nothing if auto tracking is already enabled.
   * 
   * @returns {void}
   */
  enableAutoTrack(): void {
    if (this.isAutoTracking) return;
    this.isAutoTracking = true;

    Logger.log("EventTracker", "Enabling auto tracking...");

    // Send the initial page view tracking
    this.trackPageView().catch((err) => {
      Logger.error("EventTracker", "Failed to track initial page view in autoTrack", err);
    });

    if (globalThis.window === undefined || globalThis.history === undefined) return;

    this.lastUrl = globalThis.window.location.href;

    // Patch pushState
    this.originalPushState = globalThis.history.pushState;
    globalThis.history.pushState = (state: any, ...args: any[]) => {
      const result = this.originalPushState.apply(globalThis.history, [state, ...args]);
      this.handleSpaNavigation();
      return result;
    };

    // Patch replaceState
    this.originalReplaceState = globalThis.history.replaceState;
    globalThis.history.replaceState = (state: any, ...args: any[]) => {
      const result = this.originalReplaceState.apply(globalThis.history, [state, ...args]);
      this.handleSpaNavigation();
      return result;
    };

    // Listen for back/forward navigation
    this.popStateListener = () => {
      this.handleSpaNavigation();
    };
    globalThis.window.addEventListener("popstate", this.popStateListener);
  }

  /**
   * @function disableAutoTrack
   * @description Disables automatic page view tracking
   * Contract:
   * Disables auto tracking by restoring the original History API methods (`pushState`, `replaceState`)
   * and removing the `popstate` event listener. This cleans up global modifications made by `enableAutoTrack`.
   * 
   * @returns {void}
   */
  disableAutoTrack(): void {
    if (!this.isAutoTracking) return;
    this.isAutoTracking = false;

    Logger.log("EventTracker", "Disabling auto tracking...");

    if (globalThis.window === undefined || globalThis.history === undefined) return;

    if (this.originalPushState) {
      globalThis.history.pushState = this.originalPushState;
      this.originalPushState = null;
    }
    if (this.originalReplaceState) {
      globalThis.history.replaceState = this.originalReplaceState;
      this.originalReplaceState = null;
    }
    if (this.popStateListener) {
      globalThis.window.removeEventListener("popstate", this.popStateListener);
      this.popStateListener = null;
    }
  }

  /**
   * @function handleSpaNavigation
   * @description Handles SPA navigation events
   * Contract:
   * Internal handler called upon detected SPA navigation events.
   * Compares the new URL to the last tracked URL to prevent duplicate tracking,
   * updates the last known URL, and fires a page view if a genuine route change occurred.
   * 
   * @private
   * @returns {void}
   */
  private handleSpaNavigation(): void {
    if (globalThis.window === undefined) return;
    const currentUrl = globalThis.window.location.href;
    if (currentUrl !== this.lastUrl) {
      Logger.log("EventTracker", `SPA route changed from ${this.lastUrl} to ${currentUrl}`);
      this.lastUrl = currentUrl;
      this.trackPageView().catch((err) => {
        Logger.error("EventTracker", "Failed to track SPA route change", err);
      });
    }
  }
}
