/**
 * Rate Limiter Service
 * Redis-backed sliding window rate limiting per tenant and per API key
 */

const redis = require('redis');
const RedisMemoryStore = require('../helpers/RedisMemoryStore');

class RateLimiter {
  constructor() {
    this.client = null;
    this.ready = false;
    this.initRedis();
  }

  async initRedis() {
    try {
      const redisClient = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: { reconnectStrategy: () => false }, // Don't retry on failure
      });

      await Promise.race([
        redisClient.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timeout')), 2000)),
      ]);

      this.client = redisClient;
      this.ready = true;
      console.log('✅ RateLimiter connected to Redis');
    } catch (err) {
      console.warn('⚠️ Redis unavailable, using in-memory store for rate-limiting:', err.message);
      this.client = new RedisMemoryStore();
      await this.client.connect();
      this.ready = true;
    }
  }

  /**
   * Check if request is within rate limit
   * @param {String} key - unique identifier (tenant:endpoint, user:api, etc.)
   * @param {Number} limit - max requests
   * @param {Number} windowSeconds - time window
   * @returns { allowed: boolean, current: number, limit: number, resetAt: number }
   */
  async checkLimit(key, limit, windowSeconds = 60) {
    try {
      const now = Date.now();
      const windowStart = now - windowSeconds * 1000;
      const redisKey = `ratelimit:${key}`;

      // Remove old entries outside the window
      await this.client.zRemRangeByScore(redisKey, '-inf', windowStart);

      // Count current requests in window
      const current = await this.client.zCard(redisKey);

      if (current < limit) {
        // Add current request
        await this.client.zAdd(redisKey, {
          score: now,
          member: `${now}-${Math.random()}`,
        });

        // Set expiry
        await this.client.expire(redisKey, windowSeconds + 1);

        return {
          allowed: true,
          current: current + 1,
          limit,
          resetAt: Math.floor((windowStart + windowSeconds * 1000) / 1000),
        };
      }

      // Get oldest request time to calculate reset
      const oldest = await this.client.zRange(redisKey, 0, 0, { withScores: true });
      const resetAt = oldest.length > 0 ? Math.floor((oldest[0].score + windowSeconds * 1000) / 1000) : null;

      return {
        allowed: false,
        current,
        limit,
        resetAt,
      };
    } catch (err) {
      console.error('Error checking rate limit:', err);
      // Fail open (allow) if Redis is down
      return { allowed: true, current: 0, limit, resetAt: null };
    }
  }

  /**
   * Get current usage for a key
   */
  async getUsage(key, windowSeconds = 60) {
    try {
      const now = Date.now();
      const windowStart = now - windowSeconds * 1000;
      const redisKey = `ratelimit:${key}`;

      await this.client.zRemRangeByScore(redisKey, '-inf', windowStart);
      const current = await this.client.zCard(redisKey);

      return { current, window: windowSeconds };
    } catch (err) {
      console.error('Error getting usage:', err);
      return { current: 0, window: windowSeconds };
    }
  }

  /**
   * Reset a rate limit key
   */
  async reset(key) {
    try {
      await this.client.del(`ratelimit:${key}`);
      return { message: 'Rate limit reset' };
    } catch (err) {
      console.error('Error resetting rate limit:', err);
      throw err;
    }
  }
}

module.exports = new RateLimiter();
