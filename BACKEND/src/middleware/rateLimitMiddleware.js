/**
 * Rate Limit Middleware
 * Enforces per-tenant API rate limits
 */

const RateLimiter = require('../services/RateLimiterService');

/**
 * Rate limit middleware - per tenant
 * Usage: app.use('/api/', rateLimitTenant())
 * Limits are based on plan
 */
exports.rateLimitTenant = (options = {}) => {
  return async (req, res, next) => {
    // Only apply to authenticated requests with tenantId
    if (!req.tenantId) {
      return next();
    }

    // Different limits per plan
    const planLimits = {
      trial: { requests: 100, window: 3600 }, // 100 req/hour
      basic: { requests: 1000, window: 3600 }, // 1000 req/hour
      pro: { requests: 10000, window: 3600 }, // 10k req/hour
      enterprise: { requests: 100000, window: 3600 }, // 100k req/hour
    };

    const plan = req.tenant?.plan || 'trial';
    const limits = planLimits[plan] || planLimits.trial;

    const rateLimitKey = `tenant:${req.tenantId}`;

    try {
      const result = await RateLimiter.checkLimit(rateLimitKey, limits.requests, limits.window);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Current', result.current);
      res.setHeader('X-RateLimit-ResetAt', result.resetAt || 0);

      if (!result.allowed) {
        return res.status(429).json({
          message: 'Rate limit exceeded',
          limit: result.limit,
          current: result.current,
          resetAt: result.resetAt,
        });
      }

      next();
    } catch (err) {
      console.error('Rate limit error:', err);
      next(); // Fail open
    }
  };
};

/**
 * Rate limit middleware - per user
 * Useful for sensitive operations (auth attempts, password reset, etc.)
 */
exports.rateLimitUser = (limit = 10, windowSeconds = 60) => {
  return async (req, res, next) => {
    if (!req.user?.userId) {
      return next();
    }

    const rateLimitKey = `user:${req.user.userId}:${req.path}`;

    try {
      const result = await RateLimiter.checkLimit(rateLimitKey, limit, windowSeconds);

      if (!result.allowed) {
        return res.status(429).json({
          message: 'Too many attempts. Please try again later.',
          resetAt: result.resetAt,
        });
      }

      next();
    } catch (err) {
      console.error('Rate limit error:', err);
      next(); // Fail open
    }
  };
};

/**
 * Rate limit middleware - per IP (for public/unauthenticated endpoints)
 */
exports.rateLimitIP = (limit = 50, windowSeconds = 60) => {
  return async (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const rateLimitKey = `ip:${ip}:${req.path}`;

    try {
      const result = await RateLimiter.checkLimit(rateLimitKey, limit, windowSeconds);

      if (!result.allowed) {
        return res.status(429).json({
          message: 'Too many requests from this IP.',
          resetAt: result.resetAt,
        });
      }

      next();
    } catch (err) {
      console.error('Rate limit error:', err);
      next(); // Fail open
    }
  };
};

module.exports = exports;
