const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema(
  {
    _id: mongoose.Schema.Types.ObjectId,
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phone: {
      type: String,
      default: '',
    },
    address: {
      type: String,
      default: '',
    },
    country: {
      type: String,
      default: '',
    },
    state: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      default: '',
    },
    zip: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'inactive'],
      default: 'active',
    },
    plan: {
      type: String,
      default: 'trial',
    },
    trialStartAt: {
      type: Date,
      default: () => new Date(),
    },
    trialEndAt: {
      type: Date,
      default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
    },
    primaryAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    branches: [
      {
        _id: mongoose.Schema.Types.ObjectId,
        name: String,
        address: String,
        city: String,
        state: String,
        zip: String,
        phone: String,
        timezone: String,
      },
    ],
    settings: {
      timezone: {
        type: String,
        default: 'UTC',
      },
      currency: {
        type: String,
        default: 'USD',
      },
      gst_enabled: {
        type: Boolean,
        default: false,
      },
      gst_number: String,
      vat_enabled: {
        type: Boolean,
        default: false,
      },
      vat_number: String,
    },
    billing: {
      sameAsBusiness: { type: Boolean, default: false },
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      address: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      zip: { type: String, default: '' },
      country: { type: String, default: '' },
    },
    stripeCustomerId: String,
    stripePlanId: String,
    subscription: {
      id: String,
      status: { type: String, enum: [null, 'active', 'past_due', 'canceled', 'canceling', 'unpaid', 'incomplete', 'trialing'], default: null },
      gateway: { type: String, enum: [null, 'stripe', 'razorpay'], default: null },
      planSlug: String,
      currentPeriodStart: Date,
      currentPeriodEnd: Date,
      cancelAtPeriodEnd: { type: Boolean, default: false },
      canceledAt: Date,
    },
    usage: {
      invoiceCount: { type: Number, default: 0 },
      apiCallsThisMonth: { type: Number, default: 0 },
      activeUsers: { type: Number, default: 1 },
      storageMB: { type: Number, default: 0 },
    },
    createdAt: {
      type: Date,
      default: () => new Date(),
    },
    updatedAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  { collection: 'tenants', timestamps: true }
);

// Indexes for common queries
tenantSchema.index({ email: 1 });
tenantSchema.index({ status: 1 });
tenantSchema.index({ plan: 1 });
tenantSchema.index({ createdAt: -1 });
tenantSchema.index({ 'subscription.status': 1 });

module.exports = mongoose.model('Tenant', tenantSchema);
