# @dtransformers/tracking-kit

A lightweight, secure, and fully-featured JavaScript Tracking SDK. It embeds into customer websites to collect visitor activity, manage secure sessions, handle user consent, track attributions, and communicate robustly with the backend tracking server.

## Features

- **Visitor Identification**: Automatic device fingerprinting and identity resolution.
- **Session Management**: Secure cookie-based tracking with background keep-alive pings.
- **Page Tracking**: Automatic tracking of initial page loads and SPA (Single Page Application) routing.
- **Custom Event Tracking**: Track detailed user interactions with deeply typed payloads.
- **Consent Management**: Granular control over tracking, marketing, and functional cookies.
- **Attribution**: Automatically extracts UTMs and platform click IDs (gclid, fbclid, etc.).
- **Robust Networking**: Built-in HMAC-SHA256 payload signing, 401 recovery, and automatic retries with exponential backoff.

## Installation

```bash
npm install @dtransformers/tracking-kit
# or
pnpm add @dtransformers/tracking-kit
# or
yarn add @dtransformers/tracking-kit
```

## Quick Start & Initialization

Initialize the `TrackingSDK` singleton at the root of your application.

```typescript
import { TrackingSDK } from "@dtransformers/tracking-kit";

const sdk = await TrackingSDK.init({
  publicKey: "YOUR_PUBLIC_KEY",
  secretKey: "YOUR_SECRET_KEY",
  serverUrl: "https://api.yourtracking.com",
  autoTrack: true, // Automatically tracks page views and SPA navigation
  debug: true, // Enables detailed console logging
  pingInterval: 30000, // Keep-alive ping interval in milliseconds
});
```

### Configuration Options

| Option         | Type      | Required | Description                                                  |
| -------------- | --------- | -------- | ------------------------------------------------------------ |
| `publicKey`    | `string`  | Yes      | Public API key.                                              |
| `secretKey`    | `string`  | Yes      | Secret key used for secure HMAC-SHA256 request signing.      |
| `serverUrl`    | `string`  | Yes      | The base URL of the Tracking Server.                         |
| `autoTrack`    | `boolean` | No       | If true, automatically tracks page views and SPA routes.     |
| `cookieDomain` | `string`  | No       | Scope cookies to a specific domain.                          |
| `debug`        | `boolean` | No       | If true, enables internal logging to the console.            |
| `pingInterval` | `number`  | No       | Interval (ms) for background keep-alive pings to the server. |

## SDK Usage

Once initialized, the `TrackingSDK` instance provides access to the core managers and APIs.

### 1. Page Views & Auto Tracking

If `autoTrack: true` is passed during initialization, the SDK automatically tracks page loads and hooks into the History API for SPA navigation. You can also trigger tracking manually:

```typescript
// Manually track a page view
await sdk.trackPageView({
  url: window.location.href,
  title: document.title,
  referrer: document.referrer,
});

// Toggle auto-tracking dynamically
sdk.disableAutoTrack();
sdk.enableAutoTrack();
```

### 2. Custom Event Tracking

Track custom user interactions and commerce events using the highly structured `track` method.

```typescript
await sdk.track({
  category: "commerce",
  type: "purchase",
  name: "Premium Subscription",
  page_id: 123,
  // Detailed attribution and DOM context are automatically captured internally
});
```

### 3. Commerce Event Tracking

`sdk.commerce` provides typed helpers for the seven semantic commerce events. Each one
maps to a fixed `name`/`type`/`category` triple and shapes your input into a consistent
payload: the product always lands in `target.items[]` as a `CommerceItem`.

| Method | `name` | `type` | `category` |
| --- | --- | --- | --- |
| `viewMenu()` | `VIEW_MENU` | `commerce` | `commerce.view_item_list` |
| `navigateGalery()` | `NAVIGATE_GALERY` | `navigation` | `navigation.route_change` |
| `viewProduct()` | `VIEW_PRODUCT` | `commerce` | `commerce.view_item` |
| `hoverOnProduct()` | `HOVER_ON_PRODUCT` | `interaction` | `interaction.hover` |
| `viewProductDetails()` | `VIEW_PRODUCT_DETAILS` | `commerce` | `commerce.select_item` |
| `orderProduct()` | `ORDER_PRODUCT` | `commerce` | `commerce.purchase` |
| `hesitateOrdering()` | `HESITATE_ORDERING` | `engagement` | `engagement.hesitation` |

```typescript
// A list of products
await sdk.commerce.viewMenu({ item_list_id: "menu_lunch", item_list_name: "Lunch Menu" });

// Moving through a gallery
await sdk.commerce.navigateGalery({ item_list_name: "Galery", index: 3 });

// A product scrolled into view
await sdk.commerce.viewProduct({
  item_id: "p_123",
  item_name: "Tajine",
  price: 89,
  currency: "MAD",
  item_list_name: "Galery",
});
// -> target: { items: [{ item_id: "p_123", ... }], value: 89, currency: "MAD" }

// Dwell time you measured yourself
await sdk.commerce.hoverOnProduct({ item_id: "p_123", duration_ms: 900 });

// Detail view, and where it was opened from
await sdk.commerce.viewProductDetails({ item_id: "p_123", component: "product_card" });

// A completed order (pass `items` instead for a multi-product order)
await sdk.commerce.orderProduct({
  item_id: "p_123",
  price: 89,
  currency: "MAD",
  transaction_id: "t_42",
  value: 99,
  shipping: 10,
});

// Hesitation is yours to define - the SDK records it, it never infers it
await sdk.commerce.hesitateOrdering({
  item_id: "p_123",
  duration_ms: 12400,
  reason: "abandoned_form",
});
```

`target.value` is derived from `price x quantity` when you do not pass it explicitly, and
every method takes an optional second argument to override event-level fields
(`page_id`, `sequence`, `occurred_at`, `click_ids`):

```typescript
await sdk.commerce.viewProduct({ item_id: "p_123" }, { page_id: 7 });
```

> `NAVIGATE_GALERY` is spelled with a single "r" on purpose - it is the agreed wire name.

### 4. Consent Management

The SDK provides granular APIs to manage visitor consent for different data processing categories (`tracking`, `marketing`, `functional`).

```typescript
// Grant consent for tracking
await sdk.consent.grant("tracking");

// Deny marketing cookies
await sdk.consent.deny("marketing");

// Check current consent status
const status = await sdk.consent.getStatus("tracking"); // "granted" | "denied" | "pending"
```

### 5. Session & Connection Management

The SDK automatically establishes sessions and device fingerprints upon initialization. You can verify network health using the ping APIs.

```typescript
// Send a one-off ping to the server
const response = await sdk.ping("hello");
console.log(response.message); // "pong"

// Start or stop background keep-alive pings manually
sdk.startPeriodicPing();
sdk.stopPeriodicPing();
```

### 6. Internal Logger

The SDK uses a centralized internal logger that can be utilized by developers when debugging is enabled.

```typescript
sdk.logger.log("CustomApp", "Hello from app");
sdk.logger.warn("CustomApp", "Watch out");
sdk.logger.error("CustomApp", "Failure", new Error("Oops"));
```

## Advanced: Network & Security Architecture

The SDK handles complex security and persistence automatically:

- **Request Signing**: Every request is signed using HMAC-SHA256 based on the HTTP method, path, query strings, body, timestamp, and a nonce.
- **Resilience**: Features automatic retries with exponential backoff for 5xx errors or transient network failures.
- **Token Recovery**: Handles 401 Unauthorized responses by automatically fetching a new token and replaying the failed request.
- **Device Fingerprinting**: Generates stable SHA-256 fingerprints based on browser heuristics.

## API Reference & Documentation

This SDK includes comprehensive JSDoc comments across all core managers and utilities. To generate and view the full HTML API reference locally:

1. Install development dependencies:
   ```bash
   pnpm install
   ```
2. Run the documentation generator:
   ```bash
   pnpm run docs
   ```
3. Open `docs/index.html` in your browser to view detailed types, inputs, outputs, and behavioral contracts for the entire SDK.
