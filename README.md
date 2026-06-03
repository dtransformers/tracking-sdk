# Tracking SDK

The Tracking SDK is a lightweight JavaScript package embedded into customer websites to collect visitor activity, manage visitor sessions, handle consent, and communicate securely with the Tracking Server through REST APIs.
The SDK must support:

- Visitor identification
- Session management
- Page tracking
- User interaction tracking
- Custom event tracking
- Consent management
- Attribution tracking
- Secure API communication

## SDK Initialization

```typescript
import { TrackingSDK } from '@dtransformers/tracking-kit';

TrackingSDK.init({
  publicKey: string;
  secretKey: string;
  serverUrl: string;
  autoTrack?: boolean;
cookieDomain?: string;
debug?: boolean;
});
```

## SDK Initialization Configuration

| Field        | Required | Description                                     |
| ------------ | -------- | ----------------------------------------------- |
| publicKey    | Yes      | Public API key                                  |
| secretKey    | Yes      | Secret key used for request signing             |
| serverUrl    | Yes      | Tracking server base URL                        |
| autoTrack    | No       | Automatically track page views and interactions |
| cookieDomain | No       | Cookie scope                                    |
| debug        | No       | Enable SDK logging                              |

## Authentication

Every request sent to the tracking server must contain:

- X-API-Key
- X-Signature
- X-Timestamp
- X-Nonce

## Signature Generation

- METHOD
- PATH
- QUERY_STRING
- TIMESTAMP
- NONCE
- BODY

signature = Hmac_Sha256(canonicalRequest, SECRET_KEY)

## LifeCycle:

### Visitors

Automatic Visitor Creation
During initialization the SDK must:

1. Generate device fingerprint
2. Collect browser metadata
3. Detect OS
4. Detect device type
5. Detect language
6. Detect timezone
7. Detect attribution data
8. Create visitor

Create Visitor API:

POST /api/v1/visitors

Request:

```typescript
{
  browser: string;
  browser_version: string;

  os: string;
  device_type: string;

  fingerprint_hash: string;

  screen_width: number;
  screen_height: number;

  language: string;
  timezone: string;

  entry_page: string;

  referrer_host: string;
  previous_site: string;

  acquisition_source?: string;
  acquisition_medium?: string;
  acquisition_campaign?: string;

  campaign_id?: string;
  campaign_content?: string;
  campaign_term?: string;
}
```

### Device Fingerprinting

The SDK must generate a stable fingerprint using:

```typescript
const fingerprintHash = SHA256(
  userAgent + language + timezone + screenWidth + screenHeight + platform,
);
```

### Session Management

After visitor creation the server returns:

```http
Set-Cookie: visitor_uuid=xxx; Path=/; Domain=yourdomain.com; SameSite=Lax; Secure;
Set-Cookie: session_id=yyy; Path=/; Domain=yourdomain.com; SameSite=Lax; Secure;
```

The SDK must:

- Store cookies
- Attach cookies to every request
- Detect session expiration
- Create a new session when needed

### Attribution Tracking

The SDK must automatically capture attribution parameters from URL query strings.

```typescript
{
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;

  gclid?: string;
  gbraid?: string;
  wbraid?: string;

  fbclid?: string;
  fbc?: string;
  fbp?: string;

  ttclid?: string;
  ttp?: string;

  twclid?: string;

  msclkid?: string;

  li_fat_id?: string;

  epik?: string;

  dclid?: string;

  ScCid?: string;

  liveramp_ats_id?: string;
}
```

The SDK should persist attribution data in:

- sessionStorage
- local storage

### Consent Management

The SDK must provide APIs for managing visitor consent.
endpoint: POST /api/v1/consents
payload:

```typescript
{
  consent_type: "tracking" | "marketing" | "functional" | "none";

  status: "granted" | "denied" | "pending";
}
```

sdk.consent.grant(type);

sdk.consent.deny(type);

sdk.consent.getStatus(type);

## Page View Tracking

The SDK must automatically track:

- Initial page load
- SPA route changes
- Browser navigation

Endpoint: POST /api/v1/events/pageviews
payload:

```typescript
{
  url: string;
  referrer: string;
  title: string;
}
```

## Custom Event Tracking

endpoint: POST /api/v1/events/custom
payload:

```
{
  category: string;
  type: string;
  name: string;

  occurred_at: string;

  page_id: number;

  schema_version: string;

  sdk_name: string;
  sdk_version: string;

  sequence: number;

  click_ids: AttributionContext;

  target: EventTarget;
}
```

sdk.track(event);
