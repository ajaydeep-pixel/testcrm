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
      enum: ['monthly', 'yearly', 'one-time', 'free'],
      default: 'monthly',
    },
    features: {
      maxUsers: { type: Number, default: 1 },
      maxBranches: { type: Number, default: 1 },
      maxProducts: { type: Number, default: 100 },
      maxInvoicesPerMonth: { type: Number, default: 50 },
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

module.exports = mongoose.model('Plan', planSchema);
