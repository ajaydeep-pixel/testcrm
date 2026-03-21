const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    billingCycle: {
      type: String,
      default: 'monthly',
    },
    paymentType: {
      type: String,
      enum: ['subscription', 'one_time'],
      default: 'subscription',
    },
    cycleType: {
      type: String,
      enum: ['monthly', 'yearly', 'custom'],
      default: 'monthly',
    },
    customDays: {
      type: Number,
      default: null,
      min: 1,
    },
    features: {
      maxUsers: { type: Number, default: 1 },
      maxBranches: { type: Number, default: 1 },
      maxProducts: { type: Number, default: 100 },
      maxInvoicesPerMonth: { type: Number, default: 50 },
    },
    rateLimit: {
      requests: {
        type: Number,
        default: 100,
        min: 1,
      },
      window: {
        type: Number,
        default: 3600,
        min: 1,
      },
    },
    currency: {
      type: String,
      default: 'usd',
      lowercase: true,
    },
    stripePriceId: {
      type: String,
      default: '',
    },
    stripeProductId: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

planSchema.pre('validate', function syncLegacyBillingCycle(next) {
  if (!this.paymentType) {
    this.paymentType = this.billingCycle === 'one-time' || this.billingCycle === 'free' ? 'one_time' : 'subscription';
  }

  if (!this.cycleType) {
    if (this.billingCycle === 'monthly' || this.billingCycle === 'yearly') this.cycleType = this.billingCycle;
    else this.cycleType = 'custom';
  }

  if (this.paymentType === 'subscription' && this.cycleType === 'custom') {
    this.invalidate('cycleType', 'Subscription plans support only monthly or yearly cycle types');
  }

  if (this.cycleType === 'custom' && !this.customDays) {
    this.invalidate('customDays', 'customDays is required for custom cycle type');
  }

  if (this.cycleType !== 'custom') {
    this.customDays = null;
  }

  this.billingCycle = this.cycleType === 'custom'
    ? 'custom'
    : this.paymentType === 'one_time' && (this.cycleType === 'monthly' || this.cycleType === 'yearly')
      ? `one-time-${this.cycleType}`
      : this.cycleType;

  next();
});

module.exports = mongoose.model('Plan', planSchema);
