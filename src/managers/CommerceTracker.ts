import { COMMERCE_EVENTS, COMMERCE_ITEM_KEYS } from "../constants";
import type {
  CommerceEventOverrides,
  CommerceItem,
  EventCategory,
  EventType,
  GalleryNavigationInput,
  HesitateOrderingInput,
  HoverProductInput,
  ItemListEventInput,
  OrderProductInput,
  ProductEventInput,
  TargetProps,
  ViewProductDetailsInput,
} from "../types/events";
import { EventTracker } from "./EventTracker";

interface CommerceEventDefinition {
  name: string;
  type: EventType;
  category: EventCategory;
}

/** Drops keys whose value is `undefined` so they never overwrite a derived value. */
function compact(props: TargetProps): TargetProps {
  const result: TargetProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) result[key] = value;
  }
  return result;
}

/** Splits a flat product input into the `CommerceItem` fields it carries. */
function toCommerceItem(input: Record<string, any>): CommerceItem {
  const item: CommerceItem = {};
  for (const key of COMMERCE_ITEM_KEYS) {
    if (input[key] !== undefined) (item as Record<string, any>)[key] = input[key];
  }
  return item;
}

/** Monetary value of a single line: unit price times quantity, when a price is known. */
function deriveValue(item: CommerceItem): number | undefined {
  if (item.price === undefined) return undefined;
  return item.price * (item.quantity ?? 1);
}

/**
 * @class CommerceTracker
 * @description Semantic commerce events built on top of {@link EventTracker.trackCustomEvent}.
 *
 * Every method maps to one fixed `name`/`type`/`category` triple from `COMMERCE_EVENTS`
 * and shapes its input into a consistent payload: the product always lands in
 * `target.items[]` as a `CommerceItem`, and event-specific details land in the
 * matching `TargetProps` fields. The tracker is a pure payload builder - it owns no
 * timers, no DOM listeners and infers nothing about visitor intent.
 */
export class CommerceTracker {
  constructor(private readonly eventTracker: EventTracker) {}

  /**
   * @function viewMenu
   * @description Tracks `VIEW_MENU` - the visitor opened a list of products (a menu).
   * @param {ItemListEventInput} [input] - The list identity, and its items when known.
   * @param {CommerceEventOverrides} [overrides] - Optional event-level overrides.
   * @returns {Promise<void>}
   */
  async viewMenu(
    input: ItemListEventInput = {},
    overrides?: CommerceEventOverrides
  ): Promise<void> {
    await this.emit(COMMERCE_EVENTS.VIEW_MENU, this.buildListTarget(input), overrides);
  }

  /**
   * @function navigateGalery
   * @description Tracks `NAVIGATE_GALERY` - the visitor moved within a product gallery.
   * @param {GalleryNavigationInput} [input] - The gallery identity, the position reached and its destination.
   * @param {CommerceEventOverrides} [overrides] - Optional event-level overrides.
   * @returns {Promise<void>}
   */
  async navigateGalery(
    input: GalleryNavigationInput = {},
    overrides?: CommerceEventOverrides
  ): Promise<void> {
    const { index, href, ...list } = input;
    const target = { ...this.buildListTarget(list), ...compact({ index, href }) };
    await this.emit(COMMERCE_EVENTS.NAVIGATE_GALERY, target, overrides);
  }

  /**
   * @function viewProduct
   * @description Tracks `VIEW_PRODUCT` - a product became visible to the visitor.
   * @param {ProductEventInput} input - The product.
   * @param {CommerceEventOverrides} [overrides] - Optional event-level overrides.
   * @returns {Promise<void>}
   */
  async viewProduct(
    input: ProductEventInput,
    overrides?: CommerceEventOverrides
  ): Promise<void> {
    await this.emit(COMMERCE_EVENTS.VIEW_PRODUCT, this.buildProductTarget(input), overrides);
  }

  /**
   * @function hoverOnProduct
   * @description Tracks `HOVER_ON_PRODUCT` - the visitor dwelled on a product.
   * @param {HoverProductInput} input - The product plus `duration_ms`, the dwell time measured by the host app.
   * @param {CommerceEventOverrides} [overrides] - Optional event-level overrides.
   * @returns {Promise<void>}
   */
  async hoverOnProduct(
    input: HoverProductInput,
    overrides?: CommerceEventOverrides
  ): Promise<void> {
    const { duration_ms, ...product } = input;
    const target = this.buildProductTarget(product, { duration_ms });
    await this.emit(COMMERCE_EVENTS.HOVER_ON_PRODUCT, target, overrides);
  }

  /**
   * @function viewProductDetails
   * @description Tracks `VIEW_PRODUCT_DETAILS` - the visitor opened a product's detail view.
   * @param {ViewProductDetailsInput} input - The product plus where it was opened from (`component`, `href`).
   * @param {CommerceEventOverrides} [overrides] - Optional event-level overrides.
   * @returns {Promise<void>}
   */
  async viewProductDetails(
    input: ViewProductDetailsInput,
    overrides?: CommerceEventOverrides
  ): Promise<void> {
    const { component, href, ...product } = input;
    const target = this.buildProductTarget(product, { component, href });
    await this.emit(COMMERCE_EVENTS.VIEW_PRODUCT_DETAILS, target, overrides);
  }

  /**
   * @function orderProduct
   * @description Tracks `ORDER_PRODUCT` - the visitor completed an order.
   * @param {OrderProductInput} input - The ordered product (or an explicit `items` list) and the order totals.
   * @param {CommerceEventOverrides} [overrides] - Optional event-level overrides.
   * @returns {Promise<void>}
   */
  async orderProduct(
    input: OrderProductInput,
    overrides?: CommerceEventOverrides
  ): Promise<void> {
    const { items, transaction_id, value, shipping, shipping_tier, tax, payment_type, ...product } =
      input;

    const target = this.buildProductTarget(product, {
      items,
      transaction_id,
      value,
      shipping,
      shipping_tier,
      tax,
      payment_type,
    });

    await this.emit(COMMERCE_EVENTS.ORDER_PRODUCT, target, overrides);
  }

  /**
   * @function hesitateOrdering
   * @description Tracks `HESITATE_ORDERING` - the visitor lingered without ordering.
   * The SDK does not decide what hesitation means: the host app supplies both the
   * measured `duration_ms` and its own `reason` label.
   * @param {HesitateOrderingInput} input - The product, the hesitation duration and the host's reason.
   * @param {CommerceEventOverrides} [overrides] - Optional event-level overrides.
   * @returns {Promise<void>}
   */
  async hesitateOrdering(
    input: HesitateOrderingInput,
    overrides?: CommerceEventOverrides
  ): Promise<void> {
    const { duration_ms, reason, ...product } = input;
    const target = this.buildProductTarget(product, {
      duration_ms,
      custom: reason === undefined ? undefined : { reason },
    });
    await this.emit(COMMERCE_EVENTS.HESITATE_ORDERING, target, overrides);
  }

  /**
   * @function buildListTarget
   * @description Shapes a product-list input into target props.
   * @private
   */
  private buildListTarget(input: ItemListEventInput): TargetProps {
    const { target, ...list } = input;
    return { ...compact(list), ...target };
  }

  /**
   * @function buildProductTarget
   * @description Shapes a flat product input into target props: the `CommerceItem`
   * fields become `target.items[0]`, the monetary value is derived from price and
   * quantity, and `extra` carries the event-specific props on top.
   * @private
   */
  private buildProductTarget(input: ProductEventInput, extra: TargetProps = {}): TargetProps {
    const { target, ...flat } = input;
    const item = toCommerceItem(flat);

    const derived: TargetProps = {};
    if (Object.keys(item).length > 0) derived.items = [item];

    const value = deriveValue(item);
    if (value !== undefined) derived.value = value;
    if (item.currency !== undefined) derived.currency = item.currency;

    return { ...derived, ...compact(extra), ...target };
  }

  /**
   * @function emit
   * @description Sends one semantic commerce event through the shared custom-event pipeline.
   * @private
   */
  private async emit(
    definition: CommerceEventDefinition,
    target: TargetProps,
    overrides?: CommerceEventOverrides
  ): Promise<void> {
    const { target: overrideTarget, ...rest } = overrides ?? {};

    await this.eventTracker.trackCustomEvent({
      ...rest,
      name: definition.name,
      type: definition.type,
      category: definition.category,
      occurred_at: overrides?.occurred_at ?? new Date().toISOString(),
      target: { ...target, ...overrideTarget },
    });
  }
}
