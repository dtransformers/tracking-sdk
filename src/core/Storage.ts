export class StorageService {
  private readonly prefix = "__tk_";

  /**
   * @function getFullKey
   * @description Gets the full key with prefix
   * Contract:
   * Prefixes the provided key with `__tk_` to avoid collisions with other data 
   * stored in the host application's local or session storage.
   * 
   * @private
   * @param {string} key - The raw storage key.
   * @returns {string} The safely prefixed storage key.
   */
  private getFullKey(key: string): string {
    return key.startsWith(this.prefix) ? key : `${this.prefix}${key}`;
  }

  /**
   * @function setLocal
   * @description Sets a local storage item
   * Contract:
   * Serializes the value to JSON and stores it in the browser's `localStorage` 
   * under a safely prefixed key. Gracefully handles environments where `localStorage` 
   * is unavailable (e.g. SSR) or quota limits are exceeded.
   * 
   * @param {string} key - The storage key to write to.
   * @param {unknown} value - The data payload to serialize and store.
   * @returns {void}
   */
  setLocal(key: string, value: unknown): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(this.getFullKey(key), JSON.stringify(value));
    } catch (e) {
      if (typeof console !== "undefined") {
        console.warn(`[Tracking SDK] [Storage] Error setting local storage for key ${key}:`, e);
      }
    }
  }

  /**
   * @function getLocal
   * @description Gets a local storage item
   * Contract:
   * Retrieves and parses a JSON value from `localStorage` using the prefixed key.
   * Returns null if the item is missing, the environment lacks `localStorage`, or 
   * if JSON parsing fails.
   * 
   * @template T
   * @param {string} key - The raw key to retrieve.
   * @returns {T | null} The parsed JSON object, or null if not found/error.
   */
  getLocal<T>(key: string): T | null {
    if (typeof localStorage === "undefined") return null;
    try {
      const item = localStorage.getItem(this.getFullKey(key));
      return item ? (JSON.parse(item) as T) : null;
    } catch (e) {
      if (typeof console !== "undefined") {
        console.warn(`[Tracking SDK] [Storage] Error parsing local storage for key ${key}:`, e);
      }
      return null;
    }
  }

  /**
   * @function removeLocal
   * @description Removes a local storage item
   * Contract:
   * Removes the prefixed key entirely from `localStorage`.
   * 
   * @param {string} key - The raw key to remove.
   * @returns {void}
   */
  removeLocal(key: string): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.removeItem(this.getFullKey(key));
    } catch (e) {
      if (typeof console !== "undefined") {
        console.warn(`[Tracking SDK] [Storage] Error removing local storage for key ${key}:`, e);
      }
    }
  }

  /**
   * @function setSession
   * @description Sets a session storage item
   * Contract:
   * Serializes the value to JSON and stores it in the browser's `sessionStorage`.
   * Safe for SSR and resilient to quota exhaustion.
   * 
   * @param {string} key - The raw key to write.
   * @param {unknown} value - The payload to serialize and store.
   * @returns {void}
   */
  setSession(key: string, value: unknown): void {
    if (typeof sessionStorage === "undefined") return;
    try {
      sessionStorage.setItem(this.getFullKey(key), JSON.stringify(value));
    } catch (e) {
      if (typeof console !== "undefined") {
        console.warn(`[Tracking SDK] [Storage] Error setting session storage for key ${key}:`, e);
      }
    }
  }

  /**
   * @function getSession
   * @description Gets a session storage item
   * Contract:
   * Retrieves and parses a JSON value from `sessionStorage`.
   * Returns null if missing, in an SSR environment, or if parsing fails.
   * 
   * @template T
   * @param {string} key - The raw key to read.
   * @returns {T | null} The parsed JSON object, or null.
   */
  getSession<T>(key: string): T | null {
    if (typeof sessionStorage === "undefined") return null;
    try {
      const item = sessionStorage.getItem(this.getFullKey(key));
      return item ? (JSON.parse(item) as T) : null;
    } catch (e) {
      if (typeof console !== "undefined") {
        console.warn(`[Tracking SDK] [Storage] Error parsing session storage for key ${key}:`, e);
      }
      return null;
    }
  }

  /**
   * @function removeSession
   * @description Removes a session storage item
   * Contract:
   * Removes a specific item from `sessionStorage` using its prefixed key.
   * 
   * @param {string} key - The raw key to remove.
   * @returns {void}
   */
  removeSession(key: string): void {
    if (typeof sessionStorage === "undefined") return;
    try {
      sessionStorage.removeItem(this.getFullKey(key));
    } catch (e) {
      if (typeof console !== "undefined") {
        console.warn(`[Tracking SDK] [Storage] Error removing session storage for key ${key}:`, e);
      }
    }
  }

  /**
   * @function getCookie
   * @description Gets a cookie value
   * Contract:
   * Parses `document.cookie` to retrieve the value associated with the specified cookie name.
   * Automatically URI-decodes the extracted string.
   * 
   * @param {string} name - The exact cookie name.
   * @returns {string | null} The unencoded cookie string, or null if not found.
   */
  getCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      const rawValue = parts.pop();
      if (rawValue) {
        return decodeURIComponent(rawValue.split(";").shift() || "");
      }
    }
    return null;
  }

  /**
   * @function setCookie
   * @description Sets a cookie value
   * Contract:
   * Sets a browser cookie with strict security defaults (`SameSite=Lax`, `Secure`, `path=/`).
   * Optionally configures the expiration date and root domain for cross-subdomain tracking.
   * 
   * @param {string} name - The cookie name.
   * @param {string} value - The unencoded cookie value.
   * @param {number} [days] - Number of days until the cookie expires. Session cookie if omitted.
   * @param {string} [domain] - Target domain for the cookie.
   * @returns {void}
   */
  setCookie(name: string, value: string, days?: number, domain?: string): void {
    if (typeof document === "undefined") return;
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = `; expires=${date.toUTCString()}`;
    }
    const domainStr = domain ? `; domain=${domain}` : "";
    document.cookie = `${name}=${encodeURIComponent(
      value
    )}${expires}${domainStr}; path=/; SameSite=Lax; Secure`;
  }

  /**
   * @function deleteCookie
   * @description Deletes a cookie
   * Contract:
   * Force deletes a cookie by re-setting it with an expiration date in the past (-1 days).
   * 
   * @param {string} name - The cookie name to remove.
   * @param {string} [domain] - Must exactly match the domain used to set the cookie.
   * @returns {void}
   */
  deleteCookie(name: string, domain?: string): void {
    this.setCookie(name, "", -1, domain);
  }
}
