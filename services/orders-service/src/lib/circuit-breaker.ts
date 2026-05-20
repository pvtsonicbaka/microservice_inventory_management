/**
 * Lightweight circuit breaker implementation.
 *
 * States:
 *   CLOSED  — requests pass through normally
 *   OPEN    — requests fail fast without calling the upstream
 *   HALF_OPEN — one probe request is allowed; if it succeeds the circuit closes
 */

type State = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit */
  failureThreshold?: number;
  /** Milliseconds to wait before moving from OPEN → HALF_OPEN */
  recoveryTimeout?: number;
  /** Name used in log messages */
  name?: string;
}

export class CircuitBreaker {
  private state: State = "CLOSED";
  private failures = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly recoveryTimeout: number;
  private readonly name: string;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.recoveryTimeout  = options.recoveryTimeout  ?? 30_000;
    this.name             = options.name             ?? "circuit-breaker";
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime >= this.recoveryTimeout) {
        this.state = "HALF_OPEN";
      } else {
        throw new Error(`CircuitBreaker[${this.name}] is OPEN — upstream unavailable`);
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
    this.state = "CLOSED";
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = "OPEN";
      console.error(
        JSON.stringify({
          level: "error",
          msg: `CircuitBreaker[${this.name}] opened after ${this.failures} failures`,
        })
      );
    }
  }

  getState(): State {
    return this.state;
  }
}

// Singleton breakers per upstream service
export const inventoryBreaker = new CircuitBreaker({
  name: "inventory-service",
  failureThreshold: 5,
  recoveryTimeout: 30_000,
});
