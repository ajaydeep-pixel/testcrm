const TenantPlan = require('../models/TenantPlan');
const Plan = require('../models/Plan');

const ACTIVE_STATUSES = ['trialing', 'active', 'canceling', 'past_due', 'incomplete'];

async function getCurrentTenantPlan(tenantId) {
  if (!tenantId) return null;

  let tenantPlan = await TenantPlan.findOne({
    tenantId,
    status: { $in: ACTIVE_STATUSES },
  })
    .sort({ createdAt: -1 })
    .populate('planId');

  if (!tenantPlan) {
    tenantPlan = await TenantPlan.findOne({ tenantId }).sort({ createdAt: -1 }).populate('planId');
  }

  return tenantPlan;
}

async function resolvePlanForTenantPlan(tenantPlan) {
  if (!tenantPlan) return null;
  if (tenantPlan.planId?.slug) return tenantPlan.planId;
  return Plan.findById(tenantPlan.planId);
}

function getPlanSlug(tenantPlan, plan) {
  if (plan?.slug) return plan.slug;
  if (tenantPlan?.metadata?.planSlug) return tenantPlan.metadata.planSlug;
  return null;
}

function isTrialExpired(tenantPlan, now = new Date()) {
  if (!tenantPlan) return false;
  if (tenantPlan.status !== 'trialing') return false;
  if (!tenantPlan.currentPeriodEnd) return false;
  return now > new Date(tenantPlan.currentPeriodEnd);
}

module.exports = {
  ACTIVE_STATUSES,
  getCurrentTenantPlan,
  resolvePlanForTenantPlan,
  getPlanSlug,
  isTrialExpired,
};
