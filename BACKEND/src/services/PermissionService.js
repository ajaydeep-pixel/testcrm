/**
 * RBAC Permission Model
 * Defines roles, permissions, and resource-level access across the platform
 */

const ROLE_PERMISSIONS = {
  owner: {
    users: ['create', 'read', 'update', 'delete'],
    branches: ['create', 'read', 'update', 'delete'],
    products: ['create', 'read', 'update', 'delete'],
    inventory: ['create', 'read', 'update', 'delete'],
    sales: ['create', 'read', 'update', 'delete'],
    purchases: ['create', 'read', 'update', 'delete'],
    suppliers: ['create', 'read', 'update', 'delete'],
    customers: ['create', 'read', 'update', 'delete'],
    reports: ['read'],
    billing: ['read', 'update'],
    settings: ['read', 'update'],
    audit: ['read'],
    approvals: ['create', 'read', 'approve', 'reject'],
  },
  manager: {
    users: ['read'],
    branches: ['read'],
    products: ['create', 'read', 'update'],
    inventory: ['read', 'update'],
    sales: ['create', 'read', 'update'],
    purchases: ['create', 'read', 'update'],
    suppliers: ['read'],
    customers: ['read', 'update'],
    reports: ['read'],
    billing: ['read'],
    settings: ['read'],
    audit: ['read'],
    approvals: ['read', 'approve'],
  },
  accountant: {
    users: ['read'],
    branches: ['read'],
    products: ['read'],
    inventory: ['read'],
    sales: ['read'],
    purchases: ['read'],
    suppliers: ['read'],
    customers: ['read'],
    reports: ['read'],
    billing: ['read'],
    settings: ['read'],
    audit: ['read'],
    approvals: ['read'],
  },
  staff: {
    users: [],
    branches: ['read'],
    products: ['read'],
    inventory: ['read', 'update'],
    sales: ['create', 'read'],
    purchases: ['read'],
    suppliers: [],
    customers: ['read'],
    reports: [],
    billing: [],
    settings: [],
    audit: [],
    approvals: ['read'],
  },
};

/**
 * Get all permissions for a role
 */
const getPermissionsForRole = (role) => {
  return ROLE_PERMISSIONS[role] || {};
};

/**
 * Check if role has permission for a resource + action
 */
const hasPermission = (role, resource, action) => {
  const permissions = getPermissionsForRole(role);
  const resourcePermissions = permissions[resource] || [];
  return resourcePermissions.includes(action);
};

/**
 * Check if user has custom permissions (overrides role-based)
 */
const hasCustomPermission = (user, resource, action) => {
  if (!user.customPermissions || user.customPermissions.length === 0) {
    return false;
  }

  const permKey = `${resource}:${action}`;
  return user.customPermissions.includes(permKey);
};

/**
 * Evaluate final permission (role + custom)
 */
const checkPermission = (user, resource, action) => {
  const roleHas = hasPermission(user.role, resource, action);
  const customHas = hasCustomPermission(user, resource, action);

  return roleHas || customHas;
};

/**
 * Get all resources accessible by a role
 */
const getAccessibleResources = (role) => {
  const permissions = getPermissionsForRole(role);
  return Object.keys(permissions).filter((resource) => permissions[resource].length > 0);
};

module.exports = {
  ROLE_PERMISSIONS,
  getPermissionsForRole,
  hasPermission,
  hasCustomPermission,
  checkPermission,
  getAccessibleResources,
};
