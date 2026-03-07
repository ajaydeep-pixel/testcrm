/**
 * Usage Metering Service
 * Tracks API calls, invoice count, storage, active users
 * Persists to MongoDB for billing and analytics
 */

const redis = require('redis');
const RedisMemoryStore = require('../helpers/RedisMemoryStore');
const Tenant = require('../models/Tenant');

class UsageMeter {
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
      console.log('✅ UsageMeter connected to Redis');
    } catch (err) {
      console.warn('⚠️ Redis unavailable, using in-memory store for usage metering:', err.message);
      this.client = new RedisMemoryStore();
      await this.client.connect();
      this.ready = true;
    }
  }

  /**
   * Increment a usage metric (API call, invoice, upload, etc.)
   */
  async incrementMetric(tenantId, metric, count = 1) {
    try {
      const key = `usage:${tenantId}:${metric}:${this.getCurrentMonth()}`;

      // Increment in Redis (fast, in-memory)
      const newValue = await this.client.incrBy(key, count);

      // Set expiry to next month
      const daysUntilMonth = 32 - new Date().getDate();
      const secondsUntilMonth = daysUntilMonth * 24 * 60 * 60;
      await this.client.expire(key, secondsUntilMonth);

      return newValue;
    } catch (err) {
      console.error('Error incrementing metric:', err);
      throw err;
    }
  }

  /**
   * Get current month usage
   */
  async getMonthlyUsage(tenantId) {
    try {
      const monthKey = this.getCurrentMonth();
      const metrics = ['apiCalls', 'invoiceCount', 'storageMB', 'activeUsers'];

      const usage = {};

      for (const metric of metrics) {
        const key = `usage:${tenantId}:${metric}:${monthKey}`;
        const value = await this.client.get(key);
        usage[metric] = parseInt(value) || 0;
      }

      return usage;
    } catch (err) {
      console.error('Error getting usage:', err);
      return {};
    }
  }

  /**
   * Record API call
   */
  async recordAPICall(tenantId) {
    return this.incrementMetric(tenantId, 'apiCalls', 1);
  }

  /**
   * Record invoice creation
   */
  async recordInvoice(tenantId) {
    return this.incrementMetric(tenantId, 'invoiceCount', 1);
  }

  /**
   * Record storage usage
   */
  async recordStorage(tenantId, mb) {
    return this.incrementMetric(tenantId, 'storageMB', mb);
  }

  /**
   * Track active users (unique login count)
   */
  async recordActiveUser(tenantId, userId) {
    try {
      const key = `active_users:${tenantId}:${this.getCurrentMonth()}`;
      await this.client.sAdd(key, userId);
      await this.client.expire(key, 32 * 24 * 60 * 60); // ~1 month

      // Get count
      const count = await this.client.sCard(key);
      return count;
    } catch (err) {
      console.error('Error recording active user:', err);
      throw err;
    }
  }

  /**
   * Sync usage to MongoDB for billing purposes (called periodically)
   */
  async syncToDatabase(tenantId) {
    try {
      const usage = await this.getMonthlyUsage(tenantId);

      const tenant = await Tenant.findByIdAndUpdate(tenantId, { usage }, { new: true });

      return tenant;
    } catch (err) {
      console.error('Error syncing usage to DB:', err);
      throw err;
    }
  }

  /**
   * Sync all tenants' usage to MongoDB
   */
  async syncAllTenants() {
    try {
      const tenants = await Tenant.find({});

      for (const tenant of tenants) {
        await this.syncToDatabase(tenant._id);
      }

      return { message: `Synced usage for ${tenants.length} tenants` };
    } catch (err) {
      console.error('Error syncing all tenants:', err);
      throw err;
    }
  }

  /**
   * Get current month in YYYY-MM format
   */
  getCurrentMonth() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${month}`;
  }

  /**
   * Reset usage for a tenant (admin function)
   */
  async resetUsage(tenantId) {
    try {
      const monthKey = this.getCurrentMonth();
      const metrics = ['apiCalls', 'invoiceCount', 'storageMB', 'activeUsers'];

      for (const metric of metrics) {
        const key = `usage:${tenantId}:${metric}:${monthKey}`;
        await this.client.del(key);
      }

      return { message: 'Usage reset' };
    } catch (err) {
      console.error('Error resetting usage:', err);
      throw err;
    }
  }
}

module.exports = new UsageMeter();
