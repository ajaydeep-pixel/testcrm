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
tenantSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Tenant', tenantSchema);
