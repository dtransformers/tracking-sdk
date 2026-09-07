import { CommerceTracker } from "../../src/managers/CommerceTracker";
import { EventTracker } from "../../src/managers/EventTracker";

jest.mock("../../src/managers/EventTracker");

describe("CommerceTracker", () => {
  let commerce: CommerceTracker;
  let mockEventTracker: jest.Mocked<EventTracker>;

  const lastEvent = () => mockEventTracker.trackCustomEvent.mock.calls[0][0];

  beforeEach(() => {
    mockEventTracker = new EventTracker(
      null as any,
      null as any,
      null as any
    ) as jest.Mocked<EventTracker>;
    mockEventTracker.trackCustomEvent.mockResolvedValue(undefined);

    commerce = new CommerceTracker(mockEventTracker);
  });

  describe("event identity", () => {
    it("sends VIEW_MENU as commerce.view_item_list", async () => {
      await commerce.viewMenu();

      expect(lastEvent()).toMatchObject({
        name: "VIEW_MENU",
        type: "commerce",
        category: "commerce.view_item_list",
      });
    });

    it("sends NAVIGATE_GALERY as navigation.route_change", async () => {
      await commerce.navigateGalery();

      expect(lastEvent()).toMatchObject({
        name: "NAVIGATE_GALERY",
        type: "navigation",
        category: "navigation.route_change",
      });
    });

    it("sends VIEW_PRODUCT as commerce.view_item", async () => {
      await commerce.viewProduct({ item_id: "p_1" });

      expect(lastEvent()).toMatchObject({
        name: "VIEW_PRODUCT",
        type: "commerce",
        category: "commerce.view_item",
      });
    });

    it("sends HOVER_ON_PRODUCT as interaction.hover", async () => {
      await commerce.hoverOnProduct({ item_id: "p_1", duration_ms: 900 });

      expect(lastEvent()).toMatchObject({
        name: "HOVER_ON_PRODUCT",
        type: "interaction",
        category: "interaction.hover",
      });
    });

    it("sends VIEW_PRODUCT_DETAILS as commerce.select_item", async () => {
      await commerce.viewProductDetails({ item_id: "p_1" });

      expect(lastEvent()).toMatchObject({
        name: "VIEW_PRODUCT_DETAILS",
        type: "commerce",
        category: "commerce.select_item",
      });
    });

    it("sends ORDER_PRODUCT as commerce.purchase", async () => {
      await commerce.orderProduct({ item_id: "p_1", transaction_id: "t_1" });

      expect(lastEvent()).toMatchObject({
        name: "ORDER_PRODUCT",
        type: "commerce",
        category: "commerce.purchase",
      });
    });

    it("sends HESITATE_ORDERING as engagement.hesitation", async () => {
      await commerce.hesitateOrdering({ item_id: "p_1", duration_ms: 12400 });

      expect(lastEvent()).toMatchObject({
        name: "HESITATE_ORDERING",
        type: "engagement",
        category: "engagement.hesitation",
      });
    });

    it("stamps an ISO occurred_at on every event", async () => {
      await commerce.viewProduct({ item_id: "p_1" });

      expect(lastEvent().occurred_at).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });
  });

  describe("product payload mapping", () => {
    it("moves commerce item fields into target.items", async () => {
      await commerce.viewProduct({
        item_id: "p_123",
        item_name: "Tajine",
        item_brand: "Osoul",
        item_category: "Plats",
        price: 89,
        currency: "MAD",
        quantity: 1,
        item_list_name: "Galery",
      });

      expect(lastEvent().target?.items).toEqual([
        {
          item_id: "p_123",
          item_name: "Tajine",
          item_brand: "Osoul",
          item_category: "Plats",
          price: 89,
          currency: "MAD",
          quantity: 1,
          item_list_name: "Galery",
        },
      ]);
    });

    it("derives target.value and target.currency from price and quantity", async () => {
      await commerce.viewProduct({ item_id: "p_1", price: 40, quantity: 3, currency: "MAD" });

      expect(lastEvent().target).toMatchObject({ value: 120, currency: "MAD" });
    });

    it("omits target.value when the product has no price", async () => {
      await commerce.viewProduct({ item_id: "p_1" });

      expect(lastEvent().target).not.toHaveProperty("value");
    });

    it("does not leak non-item fields into target.items", async () => {
      await commerce.hoverOnProduct({ item_id: "p_1", duration_ms: 900 });

      expect(lastEvent().target?.items?.[0]).not.toHaveProperty("duration_ms");
    });
  });

  describe("event specific fields", () => {
    it("records hover dwell time as target.duration_ms", async () => {
      await commerce.hoverOnProduct({ item_id: "p_1", duration_ms: 900 });

      expect(lastEvent().target).toMatchObject({ duration_ms: 900 });
    });

    it("records the details view source as target.component and target.href", async () => {
      await commerce.viewProductDetails({
        item_id: "p_1",
        component: "product_card",
        href: "https://shop.test/p/1",
      });

      expect(lastEvent().target).toMatchObject({
        component: "product_card",
        href: "https://shop.test/p/1",
      });
    });

    it("records order totals alongside the ordered item", async () => {
      await commerce.orderProduct({
        item_id: "p_1",
        price: 89,
        currency: "MAD",
        transaction_id: "t_42",
        value: 99,
        shipping: 10,
        tax: 0,
        coupon: "WELCOME",
        payment_type: "cod",
      });

      expect(lastEvent().target).toMatchObject({
        transaction_id: "t_42",
        value: 99,
        shipping: 10,
        tax: 0,
        currency: "MAD",
        payment_type: "cod",
      });
    });

    it("keeps an explicit multi item order list instead of the single item", async () => {
      await commerce.orderProduct({
        transaction_id: "t_42",
        value: 150,
        currency: "MAD",
        items: [
          { item_id: "p_1", price: 50, quantity: 1 },
          { item_id: "p_2", price: 100, quantity: 1 },
        ],
      });

      expect(lastEvent().target?.items).toHaveLength(2);
    });

    it("records the host supplied hesitation reason under target.custom", async () => {
      await commerce.hesitateOrdering({
        item_id: "p_1",
        duration_ms: 12400,
        reason: "abandoned_form",
      });

      expect(lastEvent().target).toMatchObject({
        duration_ms: 12400,
        custom: { reason: "abandoned_form" },
      });
    });

    it("does not infer a hesitation reason when none is given", async () => {
      await commerce.hesitateOrdering({ item_id: "p_1", duration_ms: 12400 });

      expect(lastEvent().target).not.toHaveProperty("custom");
    });
  });

  describe("item list events", () => {
    it("records the menu list identity without an items array when none is given", async () => {
      await commerce.viewMenu({ item_list_id: "menu_lunch", item_list_name: "Lunch Menu" });

      const target = lastEvent().target!;
      expect(target).toMatchObject({
        item_list_id: "menu_lunch",
        item_list_name: "Lunch Menu",
      });
      expect(target).not.toHaveProperty("items");
    });

    it("records the menu items when the list is provided", async () => {
      await commerce.viewMenu({
        item_list_name: "Lunch Menu",
        items: [{ item_id: "p_1" }, { item_id: "p_2" }],
      });

      expect(lastEvent().target?.items).toHaveLength(2);
    });

    it("records gallery position and destination", async () => {
      await commerce.navigateGalery({
        item_list_name: "Galery",
        index: 3,
        href: "https://shop.test/galery?i=3",
      });

      expect(lastEvent().target).toMatchObject({
        item_list_name: "Galery",
        index: 3,
        href: "https://shop.test/galery?i=3",
      });
    });
  });

  describe("overrides", () => {
    it("forwards page_id, sequence and click_ids to the event tracker", async () => {
      await commerce.viewProduct(
        { item_id: "p_1" },
        { page_id: 7, sequence: 42, click_ids: { gclid: "abc" } }
      );

      expect(lastEvent()).toMatchObject({
        page_id: 7,
        sequence: 42,
        click_ids: { gclid: "abc" },
      });
    });

    it("lets the caller override occurred_at", async () => {
      await commerce.viewProduct(
        { item_id: "p_1" },
        { occurred_at: "2026-01-01T00:00:00.000Z" }
      );

      expect(lastEvent().occurred_at).toBe("2026-01-01T00:00:00.000Z");
    });

    it("merges extra target props supplied by the caller", async () => {
      await commerce.viewProduct({
        item_id: "p_1",
        target: { element_id: "card-1", page_name: "home" },
      });

      expect(lastEvent().target).toMatchObject({
        element_id: "card-1",
        page_name: "home",
      });
      expect(lastEvent().target?.items?.[0].item_id).toBe("p_1");
    });
  });

  it("propagates failures from the event tracker", async () => {
    mockEventTracker.trackCustomEvent.mockRejectedValueOnce(new Error("network down"));

    await expect(commerce.viewProduct({ item_id: "p_1" })).rejects.toThrow("network down");
  });
});
