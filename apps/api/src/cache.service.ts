import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * Simple in-memory cache for frequently accessed data
 * This reduces database round-trips for data that doesn't change often
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly cache = new Map<string, CacheEntry<any>>();

  // Default TTL: 30 seconds (balances freshness vs performance)
  private readonly DEFAULT_TTL_MS = 30 * 1000;

  /**
   * Get cached value or execute getter and cache result
   */
  async getOrSet<T>(
    key: string,
    getter: () => Promise<T>,
    ttlMs: number = this.DEFAULT_TTL_MS,
  ): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return cached.data as T;
    }

    // Fetch fresh data
    const data = await getter();

    // Cache it
    this.cache.set(key, {
      data,
      expiresAt: now + ttlMs,
    });

    return data;
  }

  /**
   * Directly set a cache value (used for cache warming)
   */
  set<T>(key: string, data: T, ttlMs: number = this.DEFAULT_TTL_MS): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Invalidate a specific cache key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching a prefix
   */
  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats for debugging
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Cache key builders for consistent key naming
export const CacheKeys = {
  clinic: (clinicId: string) => `clinic:${clinicId}`,
  clinicStats: (clinicId: string) => `clinic:${clinicId}:stats`,
  doctors: (clinicId: string) => `clinic:${clinicId}:doctors`,
  doctor: (clinicId: string, doctorId: string) => `clinic:${clinicId}:doctor:${doctorId}`,
  doctorSchedule: (doctorId: string) => `doctor:${doctorId}:schedule`,
  staff: (clinicId: string) => `clinic:${clinicId}:staff`,
  licenses: (clinicId: string) => `clinic:${clinicId}:licenses`,
  specializations: () => 'specializations',
};

// TTL values for different types of data
export const CacheTTL = {
  CLINIC: 60 * 1000,        // 1 minute - clinic info rarely changes
  DOCTORS: 30 * 1000,       // 30 seconds - doctor list
  SCHEDULE: 30 * 1000,      // 30 seconds - schedule data
  STAFF: 30 * 1000,         // 30 seconds - staff list
  LICENSES: 30 * 1000,      // 30 seconds - license info
  SPECIALIZATIONS: 5 * 60 * 1000,  // 5 minutes - reference data
};
