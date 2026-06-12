import { SDKConfig } from "../types/config";
import { hmacSHA256, generateNonce } from "../utils/crypto";

export class SDKError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "SDKError";
  }
}

export type UnauthorizedHandler = () => Promise<void>;

export class NetworkClient {
  private unauthorizedHandler: UnauthorizedHandler | null = null;

  constructor(private readonly config: SDKConfig) { }

  setUnauthorizedHandler(handler: UnauthorizedHandler): void {
    this.unauthorizedHandler = handler;
  }

  private log(message: string, ...args: any[]): void {
    if (this.config.debug) {
      console.log(`[Tracking SDK] [Network] ${message}`, ...args);
    }
  }

  private logError(message: string, ...args: any[]): void {
    if (this.config.debug) {
      console.error(`[Tracking SDK] [Network] ${message}`, ...args);
    }
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryString?: string,
    maxRetries: number = 3
  ): Promise<T> {
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        return await this.requestInternal<T>(method, path, body, queryString, false);
      } catch (error) {
        attempt++;
        const isRetryable = error instanceof SDKError && (error.status === 0 || error.status >= 500);
        if (!isRetryable || attempt > maxRetries) {
          throw error;
        }
        this.logWarning(`Request to ${path} failed. Retrying... (${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }
    throw new Error("Max retries exceeded");
  }

  private async prepareRequest(
    method: string,
    path: string,
    body: unknown,
    queryString: string | undefined
  ): Promise<{ fullUrl: string; fetchOptions: RequestInit; normalizedPath: string }> {
    const uppercaseMethod = method.toUpperCase();

    let normalizedPath = path;
    if (!normalizedPath.startsWith("/")) {
      normalizedPath = `/${normalizedPath}`;
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = generateNonce();
    const bodyStr = body ? JSON.stringify(body) : "";
    const canonicalQuery = queryString || "";

    const canonicalParts = [
      uppercaseMethod,
      normalizedPath,
      canonicalQuery,
      timestamp,
      nonce,
      bodyStr,
    ];

    const canonicalRequest = canonicalParts.join("\n");
    const signature = await hmacSHA256(canonicalRequest, this.config.secretKey);

    let serverUrl = this.config.serverUrl;
    if (serverUrl.endsWith("/")) {
      serverUrl = serverUrl.slice(0, -1);
    }
    const fullUrl = `${serverUrl}${normalizedPath}${queryString ? `?${queryString}` : ""
      }`;

    this.log(`Requesting ${uppercaseMethod} ${fullUrl}`, {
      timestamp,
      nonce,
      hasBody: !!bodyStr,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-API-Key": this.config.publicKey,
      "X-Signature": signature,
      "X-Timestamp": timestamp,
      "X-Nonce": nonce,
    };

    const fetchOptions: RequestInit = {
      method: uppercaseMethod,
      headers,
      credentials: "include",
    };

    if (uppercaseMethod !== "GET" && uppercaseMethod !== "HEAD") {
      fetchOptions.body = bodyStr;
    }

    return { fullUrl, fetchOptions, normalizedPath };
  }

  private async requestInternal<T>(
    method: string,
    path: string,
    body: unknown,
    queryString: string | undefined,
    isRetry: boolean
  ): Promise<T> {
    const { fullUrl, fetchOptions, normalizedPath } = await this.prepareRequest(
      method,
      path,
      body,
      queryString
    );

    try {
      const response = await fetch(fullUrl, fetchOptions);

      if (response.status === 401) {
        this.logWarning(`Received 401 Unauthorized for ${normalizedPath}`);
        if (this.unauthorizedHandler && !isRetry) {
          this.log("Attempting session recovery...");
          try {
            await this.unauthorizedHandler();
            this.log("Session recovered successfully. Retrying original request...");
            return await this.requestInternal<T>(
              method,
              path,
              body,
              queryString,
              true
            );
          } catch (recoveryErr) {
            this.logError("Session recovery failed", recoveryErr);
            throw recoveryErr;
          }
        }
        throw new SDKError(
          response.status,
          `Unauthorized: ${await response.text()}`
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        this.logError(`Request failed with status ${response.status}: ${errorText}`);
        throw new SDKError(
          response.status,
          `Request failed with status ${response.status}: ${errorText}`
        );
      }

      const responseText = await response.text();
      this.log(`Response received for ${normalizedPath} (${response.status})`);

      if (!responseText) {
        return {} as T;
      }

      return JSON.parse(responseText) as T;
    } catch (error) {
      if (error instanceof SDKError) {
        throw error;
      }
      this.logError(`Network error for ${normalizedPath}`, error);
      throw new SDKError(0, error instanceof Error ? error.message : String(error));
    }
  }

  private logWarning(message: string, ...args: any[]): void {
    if (this.config.debug) {
      console.warn(`[Tracking SDK] [Network] ${message}`, ...args);
    }
  }
}
