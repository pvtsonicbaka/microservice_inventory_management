import { logger } from "./logger";

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number;   // failures before opening (default: 5)
  successThreshold?: number;   // successes in HALF_OPEN to close (default: 2)
  timeout?: number;            // ms to wait before trying HALF_OPEN (default: 30000)
}

/**
 * Simple circuit breaker implementation.
 *
 * States:
 *  CLOSED     — normal operation, requests pass through
 *  OPEN       — failing fast, requests rejected immediately
 *  HALF_OPEN  — testing recovery, limited requests allowed
 */
export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;

  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;

  constructor(opts: CircuitBreakerOptions) {
    this.name = opts.name;
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.successThreshold = opts.successThreshold ?? 2;
    this.timeout = opts.timeout ?? 30_000;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        this.state = "HALF_OPEN";
        this.successes = 0;
        logger.info(`Circuit breaker ${this.name} → HALF_OPEN`);
      } else {
        throw new Error(`Circuit breaker OPEN: ${this.name}`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.failures = 0;
    if (this.state === "HALF_OPEN") {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.state = "CLOSED";
        logger.info(`Circuit breaker ${this.name} → CLOSED`);
      }
    }
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.state === "HALF_OPEN" || this.failures >= this.failureThreshold) {
      this.state = "OPEN";
      logger.warn(`Circuit breaker ${this.name} → OPEN`, {
        failures: this.failures,
      });
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

// Pre-built breakers for inter-service calls
export const breakers = {
  inventory: new CircuitBreaker({ name: "inventory-service", failureThreshold: 5, timeout: 30_000 }),
  auth:      new CircuitBreaker({ name: "auth-service",      failureThreshold: 5, timeout: 30_000 }),
  orders:    new CircuitBreaker({ name: "orders-service",    failureThreshold: 5, timeout: 30_000 }),
};
