/**
 * Admin Controller
 * Superadmin operations: manage all tenants, users, payments, and system-wide analytics
 */

const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Invoice = require('../models/Invoice');
const AuditLog = require('../models/AuditLog');
const AuthService = require('../services/AuthService');
const PlatformSettings = require('../models/PlatformSettings');
const Plan = require('../models/Plan');
const bcrypt = require('bcryptjs');

/**
 * GET /api/admin/dashboard
 */
exports.getDashboardMetrics = async (req, res) => {
  try {
    const totalTenants = await Tenant.countDocuments();
    const activeTenants = await Tenant.countDocuments({ status: 'active' });
    const totalUsers = await User.countDocuments({ role: { $ne: 'superadmin' } });
    const totalInvoices = await Invoice.countDocuments();

    const paidInvoices = await Invoice.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
    ]);

    const totalRevenue = paidInvoices[0]?.totalAmount || 0;

    const tenantsByPlan = await Tenant.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } },
    ]);

    const recentTenants = await Tenant.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email plan status createdAt');

    res.json({
      metrics: {
        totalTenants,
        activeTenants,
        totalUsers,
        totalInvoices,
        totalRevenue: totalRevenue / 100,
        tenantsByPlan,
        recentTenants,
      },
    });
  } catch (err) {
    console.error('Error getting dashboard metrics:', err);
    res.status(500).json({ message: 'Failed to get metrics', error: err.message });
  }
};

/**
 * GET /api/admin/tenants
 */
exports.listTenants = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, plan } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (status) filter.status = status;
    if (plan) filter.plan = plan;

    const [tenants, total] = await Promise.all([
      Tenant.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('name email plan status trialEndAt createdAt'),
      Tenant.countDocuments(filter),
    ]);

    res.json({
      tenants,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Error listing tenants:', err);
    res.status(500).json({ message: 'Failed to list tenants', error: err.message });
  }
};

/**
 * GET /api/admin/tenants/:tenantId
 */
exports.getTenantDetails = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.tenantId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const users = await User.find({ tenantId: tenant._id })
      .select('name email role status lastLoginAt createdAt');

    const invoices = await Invoice.find({ tenantId: tenant._id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ tenant, users, invoices });
  } catch (err) {
    console.error('Error getting tenant details:', err);
    res.status(500).json({ message: 'Failed to get tenant details', error: err.message });
  }
};

/**
 * PATCH /api/admin/tenants/:tenantId/status
 */
exports.updateTenantStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Use: active, suspended' });
    }

    const tenant = await Tenant.findByIdAndUpdate(
      req.params.tenantId,
      { status },
      { new: true }
    );
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    res.json({ message: `Tenant ${status}`, tenant });
  } catch (err) {
    console.error('Error updating tenant status:', err);
    res.status(500).json({ message: 'Failed to update tenant', error: err.message });
  }
};

/**
 * PUT /api/admin/tenants/:tenantId
 */
exports.updateTenant = async (req, res) => {
  try {
    const { name, email, plan, status, settings } = req.body;

    const updateFields = {};
    if (name) updateFields.name = name;
    if (email) updateFields.email = email;
    if (plan && ['trial', 'basic', 'pro', 'enterprise'].includes(plan)) updateFields.plan = plan;
    if (status && ['active', 'suspended', 'inactive'].includes(status)) updateFields.status = status;
    if (settings) {
      if (settings.timezone) updateFields['settings.timezone'] = settings.timezone;
      if (settings.currency) updateFields['settings.currency'] = settings.currency;
      if (typeof settings.gst_enabled === 'boolean') updateFields['settings.gst_enabled'] = settings.gst_enabled;
      if (settings.gst_number !== undefined) updateFields['settings.gst_number'] = settings.gst_number;
    }

    const tenant = await Tenant.findByIdAndUpdate(
      req.params.tenantId,
      { $set: updateFields },
      { new: true }
    );
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    res.json({ message: 'Tenant updated', tenant });
  } catch (err) {
    console.error('Error updating tenant:', err);
    res.status(500).json({ message: 'Failed to update tenant', error: err.message });
  }
};

/**
 * GET /api/admin/users
 */
exports.listUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, role } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { role: { $ne: 'superadmin' } };
    if (status) filter.status = status;
    if (role) filter.role = role;

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('name email role status tenantId lastLoginAt createdAt')
        .populate('tenantId', 'name plan status'),
      User.countDocuments(filter),
    ]);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Error listing users:', err);
    res.status(500).json({ message: 'Failed to list users', error: err.message });
  }
};

/**
 * PATCH /api/admin/users/:userId/status
 */
exports.updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive', 'locked'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Use: active, inactive, locked' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { status },
      { new: true }
    ).select('name email role status');

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ message: `User ${status}`, user });
  } catch (err) {
    console.error('Error updating user status:', err);
    res.status(500).json({ message: 'Failed to update user', error: err.message });
  }
};

/**
 * PATCH /api/admin/users/:userId/password
 */
exports.resetUserPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'superadmin') return res.status(403).json({ message: 'Cannot reset superadmin password from here' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ message: 'Failed to reset password', error: err.message });
  }
};

/**
 * POST /api/admin/users/:userId/login-as
 */
exports.loginAsUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'superadmin') {
      return res.status(403).json({ message: 'Cannot impersonate another superadmin' });
    }

    const token = AuthService.issueToken(
      user._id.toString(),
      user.tenantId ? user.tenantId.toString() : null,
      user.role
    );

    res.json({
      message: `Logged in as ${user.email}`,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
    });
  } catch (err) {
    console.error('Error login-as:', err);
    res.status(500).json({ message: 'Login-as failed', error: err.message });
  }
};

/**
 * GET /api/admin/invoices
 */
exports.listInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (status) filter.status = status;

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('tenantId', 'name email'),
      Invoice.countDocuments(filter),
    ]);

    res.json({
      invoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Error listing invoices:', err);
    res.status(500).json({ message: 'Failed to list invoices', error: err.message });
  }
};

/**
 * GET /api/admin/payments
 */
exports.getPaymentsSummary = async (req, res) => {
  try {
    const revenueByMonth = await Invoice.aggregate([
      { $match: { status: 'paid' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$paidAt' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 12 },
    ]);

    const revenueByPlan = await Invoice.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: '$plan', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    const totalRevenue = await Invoice.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    res.json({
      totalRevenue: (totalRevenue[0]?.total || 0) / 100,
      revenueByMonth,
      revenueByPlan,
    });
  } catch (err) {
    console.error('Error getting payments:', err);
    res.status(500).json({ message: 'Failed to get payments', error: err.message });
  }
};

/**
 * GET /api/admin/activity
 */
exports.getActivityLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      AuditLog.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('userId', 'name email')
        .populate('tenantId', 'name'),
      AuditLog.countDocuments(),
    ]);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Error getting activity logs:', err);
    res.status(500).json({ message: 'Failed to get activity logs', error: err.message });
  }
};

/**
 * GET /api/admin/settings
 */
exports.getSettings = async (req, res) => {
  try {
    let settings = await PlatformSettings.findOne({ key: 'platform' });
    if (!settings) {
      settings = await PlatformSettings.create({ key: 'platform' });
    }
    res.json({ settings });
  } catch (err) {
    console.error('Error getting settings:', err);
    res.status(500).json({ message: 'Failed to get settings', error: err.message });
  }
};

/**
 * PUT /api/admin/settings
 */
exports.updateSettings = async (req, res) => {
  try {
    const { branding, contact } = req.body;
    const update = {};
    if (branding) update.branding = branding;
    if (contact) update.contact = contact;

    const settings = await PlatformSettings.findOneAndUpdate(
      { key: 'platform' },
      { $set: update },
      { new: true, upsert: true }
    );
    res.json({ message: 'Settings updated', settings });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ message: 'Failed to update settings', error: err.message });
  }
};

/**
 * GET /api/branding (public — no auth)
 */
/**
 * GET /api/admin/plans
 */
exports.listPlans = async (req, res) => {
  try {
    const plans = await Plan.find().sort({ sortOrder: 1, createdAt: 1 });
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching plans' });
  }
};

/**
 * POST /api/admin/plans
 */
exports.createPlan = async (req, res) => {
  try {
    const { name, slug, price, billingCycle, features, description, isActive, sortOrder } = req.body;
    if (!name || !slug) return res.status(400).json({ message: 'Name and slug are required' });

    const existing = await Plan.findOne({ $or: [{ name }, { slug: slug.toLowerCase() }] });
    if (existing) return res.status(409).json({ message: 'Plan with this name or slug already exists' });

    const plan = await Plan.create({
      name, slug: slug.toLowerCase(), price: price || 0,
      billingCycle: billingCycle || 'monthly',
      features: features || {},
      description: description || '',
      isActive: isActive !== false,
      sortOrder: sortOrder || 0,
    });
    res.status(201).json({ plan });
  } catch (err) {
    res.status(500).json({ message: 'Error creating plan' });
  }
};

/**
 * PUT /api/admin/plans/:planId
 */
exports.updatePlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const { name, price, billingCycle, features, description, isActive, sortOrder } = req.body;

    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    if (name) plan.name = name;
    if (price !== undefined) plan.price = price;
    if (billingCycle) plan.billingCycle = billingCycle;
    if (features) plan.features = { ...plan.features, ...features };
    if (description !== undefined) plan.description = description;
    if (isActive !== undefined) plan.isActive = isActive;
    if (sortOrder !== undefined) plan.sortOrder = sortOrder;

    await plan.save();
    res.json({ plan });
  } catch (err) {
    res.status(500).json({ message: 'Error updating plan' });
  }
};

/**
 * DELETE /api/admin/plans/:planId
 */
exports.deletePlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    // Check if any tenants are using this plan
    const tenantsUsingPlan = await Tenant.countDocuments({ plan: plan.slug });
    if (tenantsUsingPlan > 0) {
      return res.status(400).json({ message: `Cannot delete: ${tenantsUsingPlan} tenant(s) are using this plan` });
    }

    await Plan.findByIdAndDelete(planId);
    res.json({ message: 'Plan deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting plan' });
  }
};

exports.getPublicBranding = async (req, res) => {
  try {
    const settings = await PlatformSettings.findOne({ key: 'platform' }).select('branding');
    res.json({
      appName: settings?.branding?.appName || 'BikeFlow',
      tagline: settings?.branding?.tagline || 'Cloud POS for medium businesses',
      logoUrl: settings?.branding?.logoUrl || '',
      primaryColor: settings?.branding?.primaryColor || '#2563eb',
    });
  } catch (err) {
    res.json({ appName: 'BikeFlow', tagline: 'Cloud POS for medium businesses', logoUrl: '', primaryColor: '#2563eb' });
  }
};
