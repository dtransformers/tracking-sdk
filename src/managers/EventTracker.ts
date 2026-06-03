import { SDKConfig } from "../types/config";
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
  ) {}

  private log(message: string, ...args: any[]): void {
    if (this.config.debug) {
      console.log(`[Tracking SDK] [EventTracker] ${message}`, ...args);
    }
  }

  private logError(message: string, ...args: any[]): void {
    if (this.config.debug) {
      console.error(`[Tracking SDK] [EventTracker] ${message}`, ...args);
    }
  }

  async trackPageView(data?: Partial<CreatePageViewRequest>): Promise<void> {
    this.log("Tracking page view...");
    await this.visitorManager.ensureSession();

    const payload: CreatePageViewRequest = {
      url: data?.url || (globalThis.window === undefined ? "" : globalThis.window.location.href),
      referrer:
        data?.referrer || (globalThis.document === undefined ? "" : globalThis.document.referrer),
      title: data?.title || (globalThis.document === undefined ? "" : globalThis.document.title),
    };

    await this.network.request<void>("POST", "/api/v1/events/pageviews", payload);
    this.log("Page view tracked successfully", payload);
  }

  async trackCustomEvent(data: CreateCustomEventRequest): Promise<void> {
    this.log(`Tracking custom event: ${data.name}...`);
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
    this.log("Custom event tracked successfully", payload);
  }

  enableAutoTrack(): void {
    if (this.isAutoTracking) return;
    this.isAutoTracking = true;

    this.log("Enabling auto tracking...");

    // Send the initial page view tracking
    this.trackPageView().catch((err) => {
      this.logError("Failed to track initial page view in autoTrack", err);
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

  disableAutoTrack(): void {
    if (!this.isAutoTracking) return;
    this.isAutoTracking = false;

    this.log("Disabling auto tracking...");

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

  private handleSpaNavigation(): void {
    if (globalThis.window === undefined) return;
    const currentUrl = globalThis.window.location.href;
    if (currentUrl !== this.lastUrl) {
      this.log(`SPA route changed from ${this.lastUrl} to ${currentUrl}`);
      this.lastUrl = currentUrl;
      this.trackPageView().catch((err) => {
        this.logError("Failed to track SPA route change", err);
      });
    }
  }
}
