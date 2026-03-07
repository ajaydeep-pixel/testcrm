/**
 * Permission Middleware
 * Enforces role-based and resource-level access control
 */

const PermissionService = require('../services/PermissionService');

/**
 * Authorize user for a resource and action
 * Usage: router.get('/products', authorize('products', 'read'), handler)
 */
exports.authorize = (resource, action) => {
  return (req, res, next) => {
    // User and role should be set by auth middleware
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const hasAccess = PermissionService.checkPermission(req.user, resource, action);

    if (!hasAccess) {
      return res.status(403).json({
        message: `Insufficient permissions. Required: ${resource}:${action}`,
      });
    }

    // Attach permission info to request for later use
    req.resource = resource;
    req.action = action;

    next();
  };
};

/**
 * Branch-level authorization
 * Ensures user can only access their assigned branches
 */
exports.authorizeBranch = () => {
  return async (req, res, next) => {
    const branchId = req.params.branchId || req.body.branchId;

    if (!branchId) {
      // No branch specified, allow
      return next();
    }

    // Owner can access all branches
    if (req.user.role === 'owner') {
      return next();
    }

    // For other roles, check if branch is in user's assigned branches
    if (!req.user.assignedBranches || !req.user.assignedBranches.includes(branchId)) {
      return res.status(403).json({
        message: 'You do not have access to this branch',
      });
    }

    next();
  };
};

/**
 * Data isolation by tenantId
 * Ensures queries are filtered by tenantId (set by tenant middleware)
 */
exports.enforceTenantIsolation = (dataModel) => {
  return (req, res, next) => {
    // Attach filter function to request for controller use
    req.applyTenantFilter = (query) => {
      return { ...query, tenantId: req.tenantId };
    };

    next();
  };
};

/**
 * Custom permission checker for specific conditions
 */
exports.conditionalAuthorize = (checkFn) => {
  return async (req, res, next) => {
    try {
      const allowed = await checkFn(req, res);
      if (!allowed) {
        return res.status(403).json({
          message: 'Access denied based on resource condition',
        });
      }
      next();
    } catch (err) {
      res.status(500).json({ message: 'Authorization error', error: err.message });
    }
  };
};

module.exports = exports;
