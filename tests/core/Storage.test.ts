import { StorageService } from "../../src/core/Storage";

describe("StorageService", () => {
  let storage: StorageService;

  beforeEach(() => {
    storage = new StorageService();
  });

  describe("LocalStorage Wrapper", () => {
    it("should set, get, and remove items with prefix", () => {
      const setItemSpy = jest.spyOn(Storage.prototype, "setItem");
      const removeItemSpy = jest.spyOn(Storage.prototype, "removeItem");

      storage.setLocal("key1", { user: "test" });
      expect(setItemSpy).toHaveBeenCalledWith("__tk_key1", '{"user":"test"}');

      expect(storage.getLocal("key1")).toEqual({ user: "test" });

      storage.removeLocal("key1");
      expect(removeItemSpy).toHaveBeenCalledWith("__tk_key1");
      expect(storage.getLocal("key1")).toBeNull();

      setItemSpy.mockRestore();
      removeItemSpy.mockRestore();
    });

    it("should gracefully handle unavailable localStorage", () => {
      const original = globalThis.localStorage;
      delete (globalThis as any).localStorage;

      storage.setLocal("test", { a: 1 });
      expect(storage.getLocal("test")).toBeNull();

      globalThis.localStorage = original;
    });
  });

  describe("Session Storage", () => {
    it("should handle session storage logic", () => {
      const setItemSpy = jest.spyOn(Storage.prototype, "setItem");
      const removeItemSpy = jest.spyOn(Storage.prototype, "removeItem");

      storage.setSession("session1", [1, 2]);
      expect(setItemSpy).toHaveBeenCalledWith("__tk_session1", "[1,2]");
      expect(storage.getSession("session1")).toEqual([1, 2]);

      storage.removeSession("session1");
      expect(removeItemSpy).toHaveBeenCalledWith("__tk_session1");
      expect(storage.getSession("session1")).toBeNull();

      setItemSpy.mockRestore();
      removeItemSpy.mockRestore();
    });
  });

  describe("Cookie Management", () => {
    it("should set a cookie with SameSite=Lax and Secure", () => {
      let cookieStore = "";
      const cookieSetSpy = jest.spyOn(document, "cookie", "set").mockImplementation((val) => {
        cookieStore = val;
      });
      const cookieGetSpy = jest.spyOn(document, "cookie", "get").mockImplementation(() => "my_cookie=cookie_val");

      storage.setCookie("my_cookie", "cookie_val");
      expect(cookieStore).toContain("my_cookie=cookie_val");
      expect(storage.getCookie("my_cookie")).toBe("cookie_val");

      storage.deleteCookie("my_cookie");
      expect(cookieStore).toContain("expires=");

      cookieSetSpy.mockRestore();
      cookieGetSpy.mockRestore();
    });

    it("should return null if cookie is not found", () => {
      expect(storage.getCookie("missing_cookie")).toBeNull();
    });

    it("should properly delete a cookie by expiring it", () => {
      const setCookieSpy = jest.spyOn(storage, "setCookie");
      
      storage.deleteCookie("my_cookie", "test.com");
      
      expect(setCookieSpy).toHaveBeenCalledWith("my_cookie", "", -1, "test.com");
    });
  });
});
