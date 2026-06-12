import type { SDKConfig } from "./types/config";
import type { CreatePageViewRequest, CreateCustomEventRequest } from "./types/events";

import { StorageService } from "./core/Storage";
import { NetworkClient } from "./core/Network";
import { VisitorManager } from "./managers/VisitorManager";
import { ConsentManager } from "./managers/ConsentManager";
import { EventTracker } from "./managers/EventTracker";

export class TrackingSDK {
  private static _instance: TrackingSDK | null = null;

  readonly consent: ConsentManager;

  private constructor(
    private readonly eventTracker: EventTracker,
    consentManager: ConsentManager,
    private readonly visitorManager: VisitorManager
  ) {
    this.consent = consentManager;
  }

  /**
   * Initializes the Tracking SDK with the given configuration.
   * If already initialized, returns the existing instance.
   */
  static async init(config: SDKConfig): Promise<TrackingSDK> {
    if (TrackingSDK._instance) {
      if (config.debug) {
        console.log("[Tracking SDK] Already initialized, returning existing instance.");
      }
      return TrackingSDK._instance;
    }

    if (config.debug) {
      console.log("[Tracking SDK] Initializing tracking SDK...", config);
    }

    const storage = new StorageService();
    const network = new NetworkClient(config);
    const visitorManager = new VisitorManager(network, storage, config);
    const consentManager = new ConsentManager(network, storage);
    const eventTracker = new EventTracker(network, visitorManager, config);

    // Initial handshake to create visitor and session
    await visitorManager.createVisitor();

    // Enable auto tracking if configured
    if (config.autoTrack) {
      eventTracker.enableAutoTrack();
    }

    const instance = new TrackingSDK(eventTracker, consentManager, visitorManager);
    TrackingSDK._instance = instance;
    return instance;
  }

  /**
   * Tracks a custom user event.
   */
  async track(event: CreateCustomEventRequest): Promise<void> {
    await this.eventTracker.trackCustomEvent(event);
  }

  /**
   * Pings the tracking server to verify connection.
   */
  async ping(message?: string): Promise<{ message: string }> {
    return this.visitorManager.ping(message);
  }

  /**
   * Manually tracks a page view event.
   */
  async trackPageView(data?: Partial<CreatePageViewRequest>): Promise<void> {
    await this.eventTracker.trackPageView(data);
  }

  /**
   * Disables auto pageview tracking if it was enabled.
   */
  disableAutoTrack(): void {
    this.eventTracker.disableAutoTrack();
  }

  /**
   * Enables auto pageview and SPA navigation tracking.
   */
  enableAutoTrack(): void {
    this.eventTracker.enableAutoTrack();
  }
}

// Export Types
export type { SDKConfig } from "./types/config";
export type { ConsentType, ConsentStatus, UpdateConsentRequest } from "./types/consent";
export type {
  CreatePageViewRequest,
  CreateCustomEventRequest,
  EventCategory,
  EventType,
  PlatformClickIds,
  TargetProps,
  CommerceItem,
} from "./types/events";
export type { VisitorResponse, CreateVisitorRequest } from "./types/visitor";
