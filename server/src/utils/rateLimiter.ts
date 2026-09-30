interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export class SocketRateLimiter {
  private buckets: Map<string, TokenBucket>;
  private maxTokens: number;
  private refillRatePerSec: number;

  constructor(maxTokens = 20, refillRatePerSec = 10) {
    this.buckets = new Map();
    this.maxTokens = maxTokens;
    this.refillRatePerSec = refillRatePerSec;
  }

  /**
   * Consumes one token for the given socket ID.
   * Returns true if allowed, false if rate limited.
   */
  public allow(socketId: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(socketId);

    if (!bucket) {
      bucket = { tokens: this.maxTokens - 1, lastRefill: now };
      this.buckets.set(socketId, bucket);
      return true;
    }

    // Refill tokens based on elapsed time
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = elapsedSeconds * this.refillRatePerSec;
    bucket.tokens = Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  public remove(socketId: string): void {
    this.buckets.delete(socketId);
  }

  public clear(): void {
    this.buckets.clear();
  }
}
