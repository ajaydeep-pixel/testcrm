/**
 * Usage & Rate Limit Controller
 * Views and admin functions for usage and rate limiting
 */

const UsageMeterService = require('../services/UsageMeterService');
const RateLimiterService = require('../services/RateLimiterService');
const BillingService = require('../services/BillingService');

const DEFAULT_RATE_LIMIT = {
  requests: 100,
  window: 3600,
};

function buildPlanPayload(planDetails, tenantPlan, planSlug = 'trial') {
  if (!planDetails) {
    return {
      slug: planSlug,
      status: tenantPlan?.status || null,
    };
  }

  return {
    _id: planDetails._id,
    name: planDetails.name,
    slug: planDetails.slug,
    price: planDetails.price,
    paymentType: planDetails.paymentType,
    cycleType: planDetails.cycleType,
    customDays: planDetails.customDays,
    billingCycle: planDetails.billingCycle,
    currency: planDetails.currency,
    description: planDetails.description,
    rateLimit: planDetails.rateLimit || DEFAULT_RATE_LIMIT,
    status: tenantPlan?.status || null,
  };
}

function getRateLimitConfig(planDetails) {
  return {
    requests: planDetails?.rateLimit?.requests || DEFAULT_RATE_LIMIT.requests,
    window: planDetails?.rateLimit?.window || DEFAULT_RATE_LIMIT.window,
  };
}

/**
 * GET /api/usage/current
 * Get current month's usage and compare to plan limits
 */
exports.getCurrentUsage = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const planSlug = req.planSlug || 'trial';
    const planDetails = req.planDetails || null;
    const tenantPlan = req.tenantPlan || null;

    const usage = await UsageMeterService.getMonthlyUsage(tenantId);
    const limits = await BillingService.checkUsageLimits(tenantId);

    res.json({
      month: UsageMeterService.getCurrentMonth(),
      plan: buildPlanPayload(planDetails, tenantPlan, planSlug),
      planSlug,
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
    const planSlug = req.planSlug || 'trial';
    const planDetails = req.planDetails || null;
    const tenantPlan = req.tenantPlan || null;
    const rateLimitConfig = getRateLimitConfig(planDetails);
    const rateLimitKey = `tenant:${tenantId}`;

    const usage = await RateLimiterService.getUsage(rateLimitKey, rateLimitConfig.window);

    res.json({
      plan: buildPlanPayload(planDetails, tenantPlan, planSlug),
      planSlug,
      rateLimit: rateLimitConfig,
      limit: rateLimitConfig.requests,
      window: rateLimitConfig.window,
      current: usage.current,
      remaining: Math.max(0, rateLimitConfig.requests - usage.current),
      percentUsed: Math.round((usage.current / rateLimitConfig.requests) * 100),
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
    const planSlug = req.planSlug || 'trial';
    const planDetails = req.planDetails || null;
    const tenantPlan = req.tenantPlan || null;
    const rateLimitConfig = getRateLimitConfig(planDetails);

    const usage = await UsageMeterService.getMonthlyUsage(tenantId);
    const limits = await BillingService.checkUsageLimits(tenantId);
    const rateLimitKey = `tenant:${tenantId}`;
    const rateUsage = await RateLimiterService.getUsage(rateLimitKey, rateLimitConfig.window);

    res.json({
      tenant: {
        name: tenant.name,
        plan: buildPlanPayload(planDetails, tenantPlan, planSlug),
        planSlug,
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
        window: rateLimitConfig.window,
        limit: rateLimitConfig.requests,
        current: rateUsage.current,
        remaining: Math.max(0, rateLimitConfig.requests - rateUsage.current),
        percentUsed: Math.round((rateUsage.current / rateLimitConfig.requests) * 100),
      },
      warnings: [],
    });
  } catch (err) {
    console.error('Error getting dashboard:', err);
    res.status(500).json({ message: 'Failed to get dashboard', error: err.message });
  }
};
