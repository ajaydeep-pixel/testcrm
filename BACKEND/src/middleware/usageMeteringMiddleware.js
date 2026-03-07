/**
 * Usage Metering Middleware
 * Automatically tracks API calls and user activity
 */

const UsageMeterService = require('../services/UsageMeterService');

/**
 * Record API usage for each request
 */
exports.recordUsage = async (req, res, next) => {
  // Only record for authenticated requests
  if (req.tenantId && req.user?.userId) {
    try {
      // Record API call asynchronously (don't block request)
      UsageMeterService.recordAPICall(req.tenantId).catch((err) =>
        console.error('Error recording API call:', err)
      );

      // Record active user (login tracking)
      UsageMeterService.recordActiveUser(req.tenantId, req.user.userId).catch((err) =>
        console.error('Error recording active user:', err)
      );
    } catch (err) {
      console.error('Error in usage metering:', err);
      // Don't fail the request
    }
  }

  next();
};

/**
 * Record invoice creation
 */
exports.recordInvoiceCreation = async (tenantId) => {
  try {
    await UsageMeterService.recordInvoice(tenantId);
  } catch (err) {
    console.error('Error recording invoice:', err);
  }
};

/**
 * Record file upload/storage
 */
exports.recordStorageUsage = async (tenantId, sizeInMB) => {
  try {
    await UsageMeterService.recordStorage(tenantId, sizeInMB);
  } catch (err) {
    console.error('Error recording storage:', err);
  }
};

/**
 * Check if tenant has exceeded usage limits
 */
exports.checkUsageAndWarn = async (req, res, next) => {
  if (!req.tenantId || !req.tenant) {
    return next();
  }

  try {
    const usage = await UsageMeterService.getMonthlyUsage(req.tenantId);
    const plan = req.tenant.plan;

    const limits = {
      basic: { apiCalls: 100000, invoiceCount: 1000, storageMB: 5000 },
      pro: { apiCalls: 1000000, invoiceCount: 50000, storageMB: 50000 },
      enterprise: { apiCalls: Infinity, invoiceCount: Infinity, storageMB: Infinity },
    };

    const tenantLimits = limits[plan] || limits.basic;

    // Check for overages and set warning header
    const warnings = [];

    if (usage.apiCalls > tenantLimits.apiCalls * 0.9) {
      warnings.push('API call limit approaching');
    }
    if (usage.invoiceCount > tenantLimits.invoiceCount * 0.9) {
      warnings.push('Invoice limit approaching');
    }
    if (usage.storageMB > tenantLimits.storageMB * 0.9) {
      warnings.push('Storage limit approaching');
    }

    if (warnings.length > 0) {
      res.setHeader('X-Usage-Warning', warnings.join('; '));
    }

    next();
  } catch (err) {
    console.error('Error checking usage:', err);
    next(); // Don't block on errors
  }
};

module.exports = exports;
