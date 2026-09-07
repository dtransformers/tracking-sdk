import type { EventCategory, EventType } from "./types/events";

export const STORAGE_KEYS = {
  PREFIX: "__tk_",
  ATTRIBUTION: "attribution",
  CONSENT_PREFIX: "consent_",
} as const;

export const COOKIE_NAMES = {
  SESSION_ID: "session_id",
  VISITOR_UUID: "visitor_uuid",
} as const;

/**
 * The semantic commerce events the SDK ships with.
 * Each entry pins the wire `name` to the `type`/`category` pair it is reported under,
 * so every caller and every consumer agrees on one taxonomy.
 *
 * Note: `NAVIGATE_GALERY` is spelled with a single "r" on purpose - it is the
 * agreed wire name and renaming it would break existing reports.
 */
export const COMMERCE_EVENTS = {
  VIEW_MENU: {
    name: "VIEW_MENU",
    type: "commerce",
    category: "commerce.view_item_list",
  },
  NAVIGATE_GALERY: {
    name: "NAVIGATE_GALERY",
    type: "navigation",
    category: "navigation.route_change",
  },
  VIEW_PRODUCT: {
    name: "VIEW_PRODUCT",
    type: "commerce",
    category: "commerce.view_item",
  },
  HOVER_ON_PRODUCT: {
    name: "HOVER_ON_PRODUCT",
    type: "interaction",
    category: "interaction.hover",
  },
  VIEW_PRODUCT_DETAILS: {
    name: "VIEW_PRODUCT_DETAILS",
    type: "commerce",
    category: "commerce.select_item",
  },
  ORDER_PRODUCT: {
    name: "ORDER_PRODUCT",
    type: "commerce",
    category: "commerce.purchase",
  },
  HESITATE_ORDERING: {
    name: "HESITATE_ORDERING",
    type: "engagement",
    category: "engagement.hesitation",
  },
} as const satisfies Record<
  string,
  { name: string; type: EventType; category: EventCategory }
>;

export type CommerceEventName = keyof typeof COMMERCE_EVENTS;

/**
 * The keys that belong on a `CommerceItem`. Used to split a flat event input
 * into the item itself versus the target-level props that surround it.
 */
export const COMMERCE_ITEM_KEYS = [
  "affiliation",
  "coupon",
  "currency",
  "discount",
  "index",
  "item_brand",
  "item_category",
  "item_category2",
  "item_category3",
  "item_id",
  "item_list_id",
  "item_list_name",
  "item_name",
  "item_variant",
  "price",
  "quantity",
] as const;
