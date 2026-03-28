/**
 * Admin Controller
 * Superadmin operations: manage all tenants, users, payments, and system-wide analytics
 */

const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Invoice = require('../models/Invoice');
const AuditLog = require('../models/AuditLog');
const fs = require('fs');
const path = require('path');
const AuthService = require('../services/AuthService');
const PlatformSettings = require('../models/PlatformSettings');
const Plan = require('../models/Plan');
const TenantPlan = require('../models/TenantPlan');
const bcrypt = require('bcryptjs');

const ACTIVE_TENANT_PLAN_STATUSES = ['trialing', 'active', 'canceling', 'past_due', 'incomplete'];

const getCurrentTenantPlansMap = async (tenantIds) => {
  if (!tenantIds.length) return new Map();

  const tenantPlans = await TenantPlan.find({
    tenantId: { $in: tenantIds },
    status: { $in: ACTIVE_TENANT_PLAN_STATUSES },
  })
    .sort({ tenantId: 1, createdAt: -1 })
    .lean();

  const map = new Map();
  tenantPlans.forEach((tenantPlan) => {
    const key = tenantPlan.tenantId.toString();
    if (!map.has(key)) {
      map.set(key, tenantPlan);
    }
  });

  return map;
};

const getPlansMap = async (tenantPlans) => {
  const planIds = [...new Set(tenantPlans.map((tenantPlan) => tenantPlan?.planId?.toString()).filter(Boolean))];
  if (!planIds.length) return new Map();

  const plans = await Plan.find({ _id: { $in: planIds } }).lean();
  return new Map(plans.map((plan) => [plan._id.toString(), plan]));
};

const decorateTenant = (tenantDoc, tenantPlan, planDoc) => {
  const tenant = typeof tenantDoc.toObject === 'function' ? tenantDoc.toObject() : { ...tenantDoc };
  const currentPeriodEnd = tenantPlan?.currentPeriodEnd || tenantPlan?.endDate || null;
  const trialDaysRemaining = tenantPlan?.status === 'trialing' && currentPeriodEnd
    ? Math.max(0, Math.ceil((new Date(currentPeriodEnd).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;
  const usage = tenantPlan?.usage || tenant.usage || {
    invoiceCount: 0,
    apiCallsThisMonth: 0,
    activeUsers: 0,
    storageMB: 0,
  };

  return {
    ...tenant,
    plan: planDoc?.slug || tenantPlan?.metadata?.planSlug || 'trial',
    planName: planDoc?.name || planDoc?.slug || tenantPlan?.metadata?.planSlug || 'Trial',
    planDetails: planDoc || null,
    trialEndAt: currentPeriodEnd,
    trialDaysRemaining,
    usage,
    subscription: tenantPlan
      ? {
          id: tenantPlan.gatewaySubscriptionId || null,
          status: tenantPlan.status,
          gateway: tenantPlan.gateway,
          currentPeriodStart: tenantPlan.currentPeriodStart || tenantPlan.startDate || null,
          currentPeriodEnd,
          cancelAtPeriodEnd: !!tenantPlan.cancelAtPeriodEnd,
          canceledAt: tenantPlan.canceledAt || null,
        }
      : null,
  };
};

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

    const recentTenantsRaw = await Tenant.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email status createdAt');

    const recentTenantIds = recentTenantsRaw.map((tenant) => tenant._id);
    const recentTenantPlansMap = await getCurrentTenantPlansMap(recentTenantIds);
    const recentPlansMap = await getPlansMap([...recentTenantPlansMap.values()]);
    const recentTenants = recentTenantsRaw.map((tenant) =>
      decorateTenant(
        tenant,
        recentTenantPlansMap.get(tenant._id.toString()),
        recentPlansMap.get(recentTenantPlansMap.get(tenant._id.toString())?.planId?.toString())
      )
    );

    const currentTenantPlans = await TenantPlan.find({
      status: { $in: ACTIVE_TENANT_PLAN_STATUSES },
    }).sort({ tenantId: 1, createdAt: -1 }).lean();

    const currentByTenant = new Map();
    currentTenantPlans.forEach((tenantPlan) => {
      const key = tenantPlan.tenantId.toString();
      if (!currentByTenant.has(key)) {
        currentByTenant.set(key, tenantPlan);
      }
    });

    const plansMap = await getPlansMap([...currentByTenant.values()]);
    const tenantsByPlanCounts = new Map();
    [...currentByTenant.values()].forEach((tenantPlan) => {
      const slug = plansMap.get(tenantPlan.planId?.toString())?.slug || tenantPlan.metadata?.planSlug || 'trial';
      tenantsByPlanCounts.set(slug, (tenantsByPlanCounts.get(slug) || 0) + 1);
    });
    const tenantsByPlan = [...tenantsByPlanCounts.entries()].map(([slug, count]) => ({ _id: slug, count }));

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

    const [tenantDocs, total] = await Promise.all([
      Tenant.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('name email status createdAt'),
      Tenant.countDocuments(filter),
    ]);

    const tenantPlansMap = await getCurrentTenantPlansMap(tenantDocs.map((tenant) => tenant._id));
    const plansMap = await getPlansMap([...tenantPlansMap.values()]);

    let tenants = tenantDocs.map((tenant) =>
      decorateTenant(
        tenant,
        tenantPlansMap.get(tenant._id.toString()),
        plansMap.get(tenantPlansMap.get(tenant._id.toString())?.planId?.toString())
      )
    );

    if (plan) {
      tenants = tenants.filter((tenant) => tenant.plan === plan);
    }

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

    const tenantPlansMap = await getCurrentTenantPlansMap([tenant._id]);
    const tenantPlan = tenantPlansMap.get(tenant._id.toString()) || null;
    const plansMap = await getPlansMap(tenantPlan ? [tenantPlan] : []);
    const decoratedTenant = decorateTenant(
      tenant,
      tenantPlan,
      plansMap.get(tenantPlan?.planId?.toString())
    );

    const users = await User.find({ tenantId: tenant._id })
      .select('name email role status lastLoginAt createdAt');

    const invoices = await Invoice.find({ tenantId: tenant._id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ tenant: decoratedTenant, users, invoices });
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
    const { name, email, phone, address, country, state, city, zip, plan, status, settings } = req.body;

    const updateFields = {};
    if (name) updateFields.name = name;
    if (email) updateFields.email = email;
    if (phone !== undefined) updateFields.phone = phone;
    if (address !== undefined) updateFields.address = address;
    if (country !== undefined) updateFields.country = country;
    if (state !== undefined) updateFields.state = state;
    if (city !== undefined) updateFields.city = city;
    if (zip !== undefined) updateFields.zip = zip;
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

    if (plan) {
      const planDoc = await Plan.findOne({ slug: plan, isActive: true });
      if (!planDoc) {
        return res.status(400).json({ message: 'Invalid plan' });
      }

      const existingCurrentPlan = await TenantPlan.findOne({
        tenantId: tenant._id,
        status: { $in: ACTIVE_TENANT_PLAN_STATUSES },
      }).sort({ createdAt: -1 });

      const selectedPlanId = planDoc._id.toString();
      const currentPlanId = existingCurrentPlan?.planId?.toString();

      if (currentPlanId !== selectedPlanId) {
        const now = new Date();
        if (existingCurrentPlan) {
          existingCurrentPlan.status = existingCurrentPlan.status === 'trialing' ? 'expired' : 'canceled';
          existingCurrentPlan.endedAt = now;
          existingCurrentPlan.cancelAtPeriodEnd = false;
          await existingCurrentPlan.save();
        }

        const durationDays = planDoc.cycleType === 'custom'
          ? Number(planDoc.customDays || 0)
          : planDoc.cycleType === 'yearly'
            ? 365
            : 30;
        const currentPeriodEnd = durationDays ? new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000) : null;

        await TenantPlan.create({
          tenantId: tenant._id,
          planId: planDoc._id,
          status: planDoc.price === 0 ? 'active' : 'incomplete',
          gateway: null,
          startDate: now,
          currentPeriodStart: now,
          currentPeriodEnd,
          nextBillingDate: planDoc.paymentType === 'subscription' ? currentPeriodEnd : null,
          renewalInterval: planDoc.cycleType === 'custom'
            ? 'custom'
            : planDoc.paymentType === 'subscription'
              ? planDoc.cycleType
              : 'one-time',
          previousTenantPlanId: existingCurrentPlan?._id || null,
          usage: existingCurrentPlan?.usage || undefined,
          metadata: {
            planSlug: planDoc.slug,
            source: 'admin_update_tenant',
          },
        });
      }
    }

    const tenantPlansMap = await getCurrentTenantPlansMap([tenant._id]);
    const tenantPlan = tenantPlansMap.get(tenant._id.toString()) || null;
    const plansMap = await getPlansMap(tenantPlan ? [tenantPlan] : []);
    res.json({
      message: 'Tenant updated',
      tenant: decorateTenant(tenant, tenantPlan, plansMap.get(tenantPlan?.planId?.toString())),
    });
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
 * POST /api/admin/settings/logo
 */
exports.uploadBrandLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Logo file is required' });
    }

    let settings = await PlatformSettings.findOne({ key: 'platform' });
    if (!settings) {
      settings = await PlatformSettings.create({ key: 'platform' });
    }

    const previousLogoUrl = settings?.branding?.logoUrl || '';
    const relativeUrl = `/uploads/branding/${req.file.filename}`;

    settings.branding = {
      ...(settings.branding?.toObject?.() || settings.branding || {}),
      logoUrl: relativeUrl,
    };
    await settings.save();

    if (previousLogoUrl && previousLogoUrl.startsWith('/uploads/branding/')) {
      const previousFilePath = path.join(__dirname, '..', '..', previousLogoUrl.replace(/^\//, ''));
      if (fs.existsSync(previousFilePath) && previousFilePath !== req.file.path) {
        try {
          fs.unlinkSync(previousFilePath);
        } catch (unlinkErr) {
          console.error('Failed to remove previous logo:', unlinkErr.message);
        }
      }
    }

    res.json({
      message: 'Logo uploaded successfully',
      logoUrl: relativeUrl,
    });
  } catch (err) {
    console.error('Error uploading brand logo:', err);
    res.status(500).json({ message: 'Failed to upload logo', error: err.message });
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
    const { name, slug, price, paymentType, cycleType, customDays, features, rateLimit, description, isActive, sortOrder } = req.body;
    if (!name || !slug) return res.status(400).json({ message: 'Name and slug are required' });

    const existing = await Plan.findOne({ $or: [{ name }, { slug: slug.toLowerCase() }] });
    if (existing) return res.status(409).json({ message: 'Plan with this name or slug already exists' });

    const plan = await Plan.create({
      name, slug: slug.toLowerCase(), price: price || 0,
      paymentType: paymentType || 'subscription',
      cycleType: cycleType || 'monthly',
      customDays: cycleType === 'custom' ? Number(customDays) : null,
      features: features || {},
      rateLimit: {
        requests: rateLimit?.requests || 100,
        window: rateLimit?.window || 3600,
      },
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
    const { name, price, paymentType, cycleType, customDays, features, rateLimit, description, isActive, sortOrder } = req.body;

    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    if (name) plan.name = name;
    if (price !== undefined) plan.price = price;
    if (paymentType) plan.paymentType = paymentType;
    if (cycleType) plan.cycleType = cycleType;
    if (customDays !== undefined) plan.customDays = cycleType === 'custom' || plan.cycleType === 'custom' ? Number(customDays) : null;
    if (features) plan.features = { ...plan.features, ...features };
    if (rateLimit) {
      plan.rateLimit = {
        ...plan.rateLimit?.toObject?.(),
        ...plan.rateLimit,
        ...rateLimit,
      };
    }
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
