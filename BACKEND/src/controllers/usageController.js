/**
 * Usage & Rate Limit Controller
 * Views and admin functions for usage and rate limiting
 */

const UsageMeterService = require('../services/UsageMeterService');
const RateLimiterService = require('../services/RateLimiterService');
const BillingService = require('../services/BillingService');

/**
 * GET /api/usage/current
 * Get current month's usage and compare to plan limits
 */
exports.getCurrentUsage = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const tenant = req.tenant;

    const usage = await UsageMeterService.getMonthlyUsage(tenantId);
    const limits = await BillingService.checkUsageLimits(tenantId);

    res.json({
      month: UsageMeterService.getCurrentMonth(),
      plan: tenant.plan,
      usage,
      limits: limits.limits,
      exceeded: limits.exceeded,
      percentUsed: {
        apiCalls: Math.round((usage.apiCalls / (limits.limits.apiCalls || 1)) * 100),
        invoiceCount: Math.round((usage.invoiceCount / (limits.limits.invoiceCount || 1)) * 100),
        storageMB: Math.round((usage.storageMB / (limits.limits.storageMB || 1)) * 100),
      },
    });
  } catch (err) {
    console.error('Error getting usage:', err);
    res.status(500).json({ message: 'Failed to get usage', error: err.message });
  }
};

/**
 * GET /api/usage/rate-limit-status
 * Get current rate limit status
 */
exports.getRateLimitStatus = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const tenant = req.tenant;

    const planLimits = {
      trial: { requests: 100, window: 3600 },
      basic: { requests: 1000, window: 3600 },
      pro: { requests: 10000, window: 3600 },
      enterprise: { requests: 100000, window: 3600 },
    };

    const limits = planLimits[tenant.plan] || planLimits.trial;
    const rateLimitKey = `tenant:${tenantId}`;

    const usage = await RateLimiterService.getUsage(rateLimitKey, limits.window);

    res.json({
      plan: tenant.plan,
      limit: limits.requests,
      window: limits.window,
      current: usage.current,
      remaining: Math.max(0, limits.requests - usage.current),
      percentUsed: Math.round((usage.current / limits.requests) * 100),
    });
  } catch (err) {
    console.error('Error getting rate limit status:', err);
    res.status(500).json({ message: 'Failed to get rate limit status', error: err.message });
  }
};

/**
 * POST /api/usage/reset (admin only)
 * Reset monthly usage counters (for testing)
 */
exports.resetUsage = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // Only owner can reset
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only owner can reset usage' });
    }

    await UsageMeterService.resetUsage(tenantId);
    res.json({ message: 'Usage reset for current month' });
  } catch (err) {
    console.error('Error resetting usage:', err);
    res.status(500).json({ message: 'Failed to reset usage', error: err.message });
  }
};

/**
 * POST /api/usage/sync (admin only)
 * Manually sync usage to database (normally happens periodically)
 */
exports.syncUsageToDb = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // Only owner can trigger sync
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only owner can sync usage' });
    }

    const tenant = await UsageMeterService.syncToDatabase(tenantId);
    res.json({ message: 'Usage synced to database', usage: tenant.usage });
  } catch (err) {
    console.error('Error syncing usage:', err);
    res.status(500).json({ message: 'Failed to sync usage', error: err.message });
  }
};

/**
 * GET /api/usage/dashboard
 * Comprehensive dashboard with all usage metrics
 */
exports.getDashboard = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const tenant = req.tenant;

    const usage = await UsageMeterService.getMonthlyUsage(tenantId);
    const limits = await BillingService.checkUsageLimits(tenantId);

    const planLimits = {
      trial: { requests: 100, window: 3600 },
      basic: { requests: 1000, window: 3600 },
      pro: { requests: 10000, window: 3600 },
      enterprise: { requests: 100000, window: 3600 },
    };

    const plan = planLimits[tenant.plan] || planLimits.trial;
    const rateLimitKey = `tenant:${tenantId}`;
    const rateUsage = await RateLimiterService.getUsage(rateLimitKey, plan.window);

    res.json({
      tenant: {
        name: tenant.name,
        plan: tenant.plan,
        status: tenant.status,
      },
      usage: {
        currentMonth: {
          month: UsageMeterService.getCurrentMonth(),
          metrics: usage,
        },
        limits: limits.limits,
        isOverLimit: limits.isOverLimit,
        exceeded: limits.exceeded,
      },
      rateLimit: {
        window: plan.window,
        limit: plan.requests,
        current: rateUsage.current,
        remaining: Math.max(0, plan.requests - rateUsage.current),
        percentUsed: Math.round((rateUsage.current / plan.requests) * 100),
      },
      warnings: [],
    });
  } catch (err) {
    console.error('Error getting dashboard:', err);
    res.status(500).json({ message: 'Failed to get dashboard', error: err.message });
  }
};
