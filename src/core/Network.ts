import { SDKConfig } from "../types/config";
import { Logger } from "../utils/logger";
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

  /**
   * Contract:
   * Registers a callback function to handle `401 Unauthorized` errors globally.
   * When a request fails with 401, this handler is executed (e.g., to refresh a session)
   * before the failed request is automatically retried once.
   * 
   * @param {UnauthorizedHandler} handler - The async callback function to execute on 401 errors.
   * @returns {void}
   */
  setUnauthorizedHandler(handler: UnauthorizedHandler): void {
    this.unauthorizedHandler = handler;
  }

  /**
   * @function request
   * @description Contract:
   * Makes an authenticated HTTP request to the tracking server, with built-in retry logic
   * for transient network failures or 5xx server errors. The method automatically signs
   * the payload, attaches proper headers, handles JSON serialization/deserialization, and
   * implements exponential backoff between retries.
   * 
   * @template T The expected return type of the parsed JSON response.
   * @param {string} method - The HTTP method (e.g., "GET", "POST", "PUT").
   * @param {string} path - The API endpoint path (e.g., "/events/api/v1/events/custom").
   * @param {unknown} [body] - The request body payload, to be serialized as JSON.
   * @param {string} [queryString] - Optional query string parameters.
   * @param {number} [maxRetries=3] - Maximum number of retries for retryable errors.
   * @returns {Promise<T>} Resolves with the parsed response body upon success.
   */
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
        Logger.warn("Network", `Request to ${path} failed. Retrying... (${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }
    throw new Error("Max retries exceeded");
  }

  /**
   * Contract:
   * Internally prepares the request parameters, ensuring the path is normalized and URL is properly built.
   * Generates a cryptographic signature (HMAC-SHA256) of the canonical request format to authenticate 
   * the payload against the server, alongside timestamp and nonce for replay protection.
   * 
   * @private
   * @param {string} method - The HTTP method.
   * @param {string} path - The API path.
   * @param {unknown} body - The un-serialized request body.
   * @param {string | undefined} queryString - The raw query string.
   * @returns {Promise<{ fullUrl: string; fetchOptions: RequestInit; normalizedPath: string }>} Prepared fetch arguments.
   */
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
    const queryPart = queryString ? `?${queryString}` : "";
    const fullUrl = `${serverUrl}${normalizedPath}${queryPart}`;

    Logger.log("Network", `Requesting ${uppercaseMethod} ${fullUrl}`, {
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

  /**
   * Contract:
   * The underlying fetch executor. Calls `prepareRequest` and fires the native `fetch`.
   * It handles standard HTTP errors, auto-recovers from `401 Unauthorized` using the registered
   * `unauthorizedHandler`, and parses successful responses as JSON.
   * 
   * @private
   * @template T
   * @param {string} method - HTTP method.
   * @param {string} path - Target path.
   * @param {unknown} body - Payload body.
   * @param {string | undefined} queryString - URL query parameters.
   * @param {boolean} isRetry - Indicates if this call is an automatic 401 recovery retry.
   * @returns {Promise<T>} Resolves with the parsed JSON response.
   */
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
        Logger.warn("Network", `Received 401 Unauthorized for ${normalizedPath}`);
        if (this.unauthorizedHandler && !isRetry) {
          Logger.log("Network", "Attempting session recovery...");
          try {
            await this.unauthorizedHandler();
            Logger.log("Network", "Session recovered successfully. Retrying original request...");
            return await this.requestInternal<T>(
              method,
              path,
              body,
              queryString,
              true
            );
          } catch (recoveryErr) {
            Logger.error("Network", "Session recovery failed", recoveryErr);
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
        Logger.error("Network", `Request failed with status ${response.status}: ${errorText}`);
        throw new SDKError(
          response.status,
          `Request failed with status ${response.status}: ${errorText}`
        );
      }

      const responseText = await response.text();
      Logger.log("Network", `Response received for ${normalizedPath} (${response.status})`);

      if (!responseText) {
        return {} as T;
      }

      return JSON.parse(responseText) as T;
    } catch (error) {
      if (error instanceof SDKError) {
        throw error;
      }
      Logger.error("Network", `Network error for ${normalizedPath}`, error);
      throw new SDKError(0, error instanceof Error ? error.message : String(error));
    }
  }

}
