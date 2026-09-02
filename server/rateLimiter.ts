import type { Request, Response, NextFunction } from "express";

interface HitRecord {
  count: number;
  resetTime: number;
}

class InMemoryRateLimiter {
  private store = new Map<string, HitRecord>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Periodically evict expired rate limit windows every 2 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      this.store.forEach((record, key) => {
        if (now > record.resetTime) {
          this.store.delete(key);
        }
      });
    }, 2 * 60 * 1000);
    this.cleanupInterval.unref();
  }

  check(
    key: string,
    maxRequests: number,
    windowMs: number
  ): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record || now > record.resetTime) {
      this.store.set(key, { count: 1, resetTime: now + windowMs });
      return { allowed: true, remaining: maxRequests - 1, retryAfterMs: 0 };
    }

    if (record.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, record.resetTime - now),
      };
    }

    record.count += 1;
    return {
      allowed: true,
      remaining: maxRequests - record.count,
      retryAfterMs: 0,
    };
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export const rateLimiter = new InMemoryRateLimiter();

/**
 * Express middleware for general IP-based rate limiting
 */
export function createExpressRateLimit(max: number = 120, windowMs: number = 60_000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
    const key = `express:${clientIp}`;
    const result = rateLimiter.check(key, max, windowMs);

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", result.remaining);

    if (!result.allowed) {
      res.setHeader("Retry-After", Math.ceil(result.retryAfterMs / 1000));
      return res.status(429).json({
        error: "Too Many Requests",
        message: "Request limit exceeded. Please slow down and try again shortly.",
      });
    }

    next();
  };
}
