import { ConsentType, ConsentStatus, UpdateConsentRequest } from "../types/consent";
import { NetworkClient } from "../core/Network";
import { StorageService } from "../core/Storage";
import { STORAGE_KEYS } from "../constants";

export class ConsentManager {
  constructor(
    private readonly network: NetworkClient,
    private readonly storage: StorageService
  ) {}

  /**
   * Contract:
   * Generates a predictable local storage key based on the consent type.
   * This is used internally to persist and retrieve the user's consent decisions locally.
   * 
   * @private
   * @param {ConsentType} type - The specific category of consent (e.g. "analytics", "marketing").
   * @returns {string} The fully formed storage key.
   */
  private getStorageKey(type: ConsentType): string {
    return `${STORAGE_KEYS.CONSENT_PREFIX}${type}`;
  }

  /**
   * Contract:
   * Explicitly grants user consent for a given type.
   * It sends a POST request to the tracking server's consent endpoint with the status "granted".
   * Upon successful server acknowledgment, it updates the local storage cache to remember this choice.
   * 
   * @param {ConsentType} type - The type of consent being granted.
   * @returns {Promise<void>} Resolves when the network request succeeds and local cache is updated.
   */
  async grant(type: ConsentType): Promise<void> {
    const payload: UpdateConsentRequest = {
      consent_type: type,
      status: "granted",
    };
    await this.network.request<void>("POST", "/api/v1/consents/", payload);
    this.storage.setLocal(this.getStorageKey(type), "granted");
  }

  /**
   * Contract:
   * Explicitly denies user consent for a given type.
   * It sends a POST request to the tracking server's consent endpoint with the status "denied".
   * Upon successful server acknowledgment, it updates the local storage cache to remember this choice.
   * 
   * @param {ConsentType} type - The type of consent being denied.
   * @returns {Promise<void>} Resolves when the network request succeeds and local cache is updated.
   */
  async deny(type: ConsentType): Promise<void> {
    const payload: UpdateConsentRequest = {
      consent_type: type,
      status: "denied",
    };
    await this.network.request<void>("POST", "/api/v1/consents/", payload);
    this.storage.setLocal(this.getStorageKey(type), "denied");
  }

  /**
   * Contract:
   * Synchronously retrieves the current known status of a specific consent type from local storage.
   * Defaults to "pending" if the user has not yet made an explicit grant or deny decision.
   * This is commonly used to block or allow data collection client-side before dispatching payloads.
   * 
   * @param {ConsentType} type - The type of consent to check.
   * @returns {ConsentStatus} The current consent status ("granted", "denied", or "pending").
   */
  getStatus(type: ConsentType): ConsentStatus {
    const status = this.storage.getLocal<ConsentStatus>(this.getStorageKey(type));
    return status || "pending";
  }
}
