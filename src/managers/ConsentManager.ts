import { ConsentType, ConsentStatus, UpdateConsentRequest } from "../types/consent";
import { NetworkClient } from "../core/Network";
import { StorageService } from "../core/Storage";

export class ConsentManager {
  constructor(
    private readonly network: NetworkClient,
    private readonly storage: StorageService
  ) {}

  private getStorageKey(type: ConsentType): string {
    return `consent_${type}`;
  }

  async grant(type: ConsentType): Promise<void> {
    const payload: UpdateConsentRequest = {
      consent_type: type,
      status: "granted",
    };
    await this.network.request<void>("POST", "/api/v1/consents/", payload);
    this.storage.setLocal(this.getStorageKey(type), "granted");
  }

  async deny(type: ConsentType): Promise<void> {
    const payload: UpdateConsentRequest = {
      consent_type: type,
      status: "denied",
    };
    await this.network.request<void>("POST", "/api/v1/consents/", payload);
    this.storage.setLocal(this.getStorageKey(type), "denied");
  }

  getStatus(type: ConsentType): ConsentStatus {
    const status = this.storage.getLocal<ConsentStatus>(this.getStorageKey(type));
    return status || "pending";
  }
}
