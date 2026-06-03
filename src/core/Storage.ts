export class StorageService {
  private readonly prefix = "__tk_";

  private getFullKey(key: string): string {
    return key.startsWith(this.prefix) ? key : `${this.prefix}${key}`;
  }

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

  deleteCookie(name: string, domain?: string): void {
    this.setCookie(name, "", -1, domain);
  }
}
