import { StorageService } from "../../src/core/Storage";

describe("StorageService", () => {
  let storage: StorageService;

  beforeEach(() => {
    storage = new StorageService();
  });

  describe("LocalStorage Wrapper", () => {
    it("should set, get, and remove items with prefix", () => {
      storage.setLocal("key1", { user: "test" });
      expect(globalThis.localStorage.setItem).toHaveBeenCalledWith("__tk_key1", '{"user":"test"}');

      expect(storage.getLocal("key1")).toEqual({ user: "test" });

      storage.removeLocal("key1");
      expect(globalThis.localStorage.removeItem).toHaveBeenCalledWith("__tk_key1");
      expect(storage.getLocal("key1")).toBeNull();
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
      storage.setSession("session1", [1, 2]);
      expect(globalThis.sessionStorage.setItem).toHaveBeenCalledWith("__tk_session1", "[1,2]");
      expect(storage.getSession("session1")).toEqual([1, 2]);

      storage.removeSession("session1");
      expect(globalThis.sessionStorage.removeItem).toHaveBeenCalledWith("__tk_session1");
      expect(storage.getSession("session1")).toBeNull();
    });
  });

  describe("Cookie Management", () => {
    it("should set a cookie with SameSite=Lax and Secure", () => {
      const mockDoc = {
        get cookie() { return cookieStore; },
        set cookie(val) { cookieStore = val; }
      };
      
      const original = globalThis.document;
      Object.defineProperty(globalThis, "document", { value: mockDoc, writable: true });
      expect(document.cookie).toContain("my_cookie=cookie_val");
      expect(storage.getCookie("my_cookie")).toBe("val1");

      storage.deleteCookie("my_cookie");
      expect(cookieStore).toContain("expires=");

      globalThis.document = original;
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
