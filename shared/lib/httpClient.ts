import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { CORRELATION_HEADER } from "./correlation";
import { logger } from "./logger";

const DEFAULT_TIMEOUT = 5_000;   // 5 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 300;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Creates an axios instance with:
 * - Timeout (default 5s)
 * - Automatic retry with exponential backoff on 5xx / network errors
 * - Correlation ID forwarding
 */
export function createHttpClient(baseURL: string, correlationId?: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: DEFAULT_TIMEOUT,
    headers: correlationId ? { [CORRELATION_HEADER]: correlationId } : {},
  });

  // Retry interceptor
  client.interceptors.response.use(
    (res) => res,
    async (err) => {
      const config = err.config as AxiosRequestConfig & { _retryCount?: number };
      if (!config) return Promise.reject(err);

      config._retryCount = config._retryCount ?? 0;

      const isRetryable =
        !err.response ||                          // network error
        err.response.status >= 500 ||             // server error
        err.code === "ECONNABORTED";              // timeout

      if (isRetryable && config._retryCount < MAX_RETRIES) {
        config._retryCount++;
        const delay = RETRY_DELAY_MS * Math.pow(2, config._retryCount - 1); // exponential backoff
        logger.warn(`Retrying request (attempt ${config._retryCount}/${MAX_RETRIES})`, {
          url: config.url,
          delay,
        });
        await sleep(delay);
        return client(config);
      }

      return Promise.reject(err);
    }
  );

  return client;
}
