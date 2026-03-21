/**
 * Tenant Middleware
 * Enforces tenantId extraction and validation on all requests.
 * Expects JWT to contain tenantId and userId.
 */

const Tenant = require('../models/Tenant');
const { getCurrentTenantPlan, resolvePlanForTenantPlan, getPlanSlug, isTrialExpired } = require('../utils/tenantPlanState');

/**
 * Extract tenant from JWT token and attach to request
 */
exports.extractTenant = (req, res, next) => {
  try {
    // Extract tenantId from user object (set by authMiddleware)
    if (!req.user || !req.user.tenantId) {
      return res.status(403).json({ 
        message: 'Tenant ID not found in token. User not properly onboarded.' 
      });
    }

    req.tenantId = req.user.tenantId;
    req.userId = req.user.userId || req.user.id;
    next();
  } catch (err) {
    res.status(500).json({ message: 'Error extracting tenant', error: err.message });
  }
};

/**
 * Verify tenant is active and user has access to it
 */
exports.verifyTenantAccess = async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.tenantId);
    
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    // Check if tenant is suspended
    if (tenant.status === 'suspended') {
      return res.status(403).json({ message: 'Tenant account is suspended' });
    }

    const tenantPlan = await getCurrentTenantPlan(tenant._id);
    const plan = await resolvePlanForTenantPlan(tenantPlan);

    if (tenantPlan && isTrialExpired(tenantPlan)) {
      return res.status(403).json({
        message: 'Trial period expired. Please upgrade to a paid plan.'
      });
    }

    // Attach tenant details to request
    req.tenant = tenant;
    req.tenantPlan = tenantPlan || null;
    req.planDetails = plan || null;
    req.planSlug = getPlanSlug(tenantPlan, plan) || 'trial';
    next();
  } catch (err) {
    res.status(500).json({ message: 'Error verifying tenant access', error: err.message });
  }
};

/**
 * Enforce tenantId filter in query/body data
 * Used in controller layers to ensure data isolation
 */
exports.appendTenantFilter = (data = {}) => {
  return { ...data, tenantId: data.tenantId || this.tenantId };
};

module.exports = exports;
