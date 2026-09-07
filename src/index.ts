import type { SDKConfig } from "./types/config";
import type {
  CreatePageViewRequest,
  CreateCustomEventRequest,
} from "./types/events";

import { Logger } from "./utils/logger";
import { StorageService } from "./core/Storage";
import { NetworkClient } from "./core/Network";
import { VisitorManager } from "./managers/VisitorManager";
import { ConsentManager } from "./managers/ConsentManager";
import { EventTracker } from "./managers/EventTracker";
import { CommerceTracker } from "./managers/CommerceTracker";

export class TrackingSDK {
  private static _instance: TrackingSDK | null = null;

  readonly consent: ConsentManager;
  readonly commerce: CommerceTracker;
  readonly logger = Logger;

  private constructor(
    private readonly eventTracker: EventTracker,
    consentManager: ConsentManager,
    private readonly visitorManager: VisitorManager,
    commerceTracker: CommerceTracker,
  ) {
    this.consent = consentManager;
    this.commerce = commerceTracker;
  }

  /**
   * Initializes the Tracking SDK with the given configuration.
   * If already initialized, returns the existing instance.
   */
  static async init(config: SDKConfig): Promise<TrackingSDK> {
    Logger.init(config.debug);

    if (TrackingSDK._instance) {
      Logger.log("Core", "Already initialized, returning existing instance.");
      return TrackingSDK._instance;
    }

    Logger.log("Core", "Initializing tracking SDK...", config);

    const storage = new StorageService();
    const network = new NetworkClient(config);
    const visitorManager = new VisitorManager(network, storage, config);
    const consentManager = new ConsentManager(network, storage);
    const eventTracker = new EventTracker(network, visitorManager, config);
    const commerceTracker = new CommerceTracker(eventTracker);

    await visitorManager.createVisitor();

    if (config.autoTrack) {
      eventTracker.enableAutoTrack();
    }

    if (config.pingInterval !== undefined) {
      visitorManager.startPeriodicPing(config.pingInterval);
    }

    const instance = new TrackingSDK(
      eventTracker,
      consentManager,
      visitorManager,
      commerceTracker,
    );
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
   * Starts periodic pings to keep the visitor session active.
   */
  startPeriodicPing(intervalMs?: number): void {
    this.visitorManager.startPeriodicPing(intervalMs);
  }

  /**
   * Stops periodic pings.
   */
  stopPeriodicPing(): void {
    this.visitorManager.stopPeriodicPing();
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
export type {
  ConsentType,
  ConsentStatus,
  UpdateConsentRequest,
} from "./types/consent";
export type {
  CreatePageViewRequest,
  CreateCustomEventRequest,
  EventCategory,
  EventType,
  PlatformClickIds,
  TargetProps,
  CommerceItem,
  CommerceEventOverrides,
  ProductEventInput,
  HoverProductInput,
  ViewProductDetailsInput,
  OrderProductInput,
  HesitateOrderingInput,
  ItemListEventInput,
  GalleryNavigationInput,
} from "./types/events";
export { CommerceTracker } from "./managers/CommerceTracker";
export { COMMERCE_EVENTS } from "./constants";
export type { CommerceEventName } from "./constants";
export type { VisitorResponse, CreateVisitorRequest } from "./types/visitor";
