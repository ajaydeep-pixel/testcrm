const mongoose = require('mongoose');

const tenantPlanSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
    },
    status: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'canceling', 'canceled', 'expired', 'incomplete', 'suspended'],
      required: true,
      default: 'trialing',
    },
    gateway: {
      type: String,
      enum: ['stripe', 'razorpay', null],
      default: null,
    },
    gatewaySubscriptionId: {
      type: String,
      default: '',
    },
    gatewayCustomerId: {
      type: String,
      default: '',
    },
    startDate: Date,
    endDate: Date,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    nextBillingDate: Date,
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    canceledAt: Date,
    endedAt: Date,
    renewalInterval: {
      type: String,
      enum: ['monthly', 'yearly', 'one-time', 'custom'],
      default: 'monthly',
    },
    previousTenantPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TenantPlan',
      default: null,
    },
    nextPlannedPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      default: null,
    },
    usage: {
      invoiceCount: { type: Number, default: 0 },
      apiCallsThisMonth: { type: Number, default: 0 },
      activeUsers: { type: Number, default: 1 },
      storageMB: { type: Number, default: 0 },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { collection: 'tenant_plans', timestamps: true }
);

tenantPlanSchema.index({ tenantId: 1, createdAt: -1 });
tenantPlanSchema.index({ tenantId: 1, status: 1 });
tenantPlanSchema.index({ tenantId: 1, currentPeriodEnd: 1 });
tenantPlanSchema.index({ gateway: 1, gatewaySubscriptionId: 1 });

module.exports = mongoose.model('TenantPlan', tenantPlanSchema);
