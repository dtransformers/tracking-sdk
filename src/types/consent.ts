export type ConsentType = "tracking" | "marketing" | "functional" | "none";
export type ConsentStatus = "granted" | "denied" | "pending";

export interface UpdateConsentRequest {
  consent_type: ConsentType;
  status: ConsentStatus;
}
