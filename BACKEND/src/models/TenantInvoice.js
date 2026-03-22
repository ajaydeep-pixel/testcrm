const mongoose = require('mongoose');

const tenantInvoiceLineItemSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      default: '',
    },
    quantity: {
      type: Number,
      default: 0,
    },
    unitAmount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    type: {
      type: String,
      default: 'subscription',
    },
  },
  { _id: false }
);

const tenantInvoiceBillingSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    zip: { type: String, default: '' },
    country: { type: String, default: '' },
  },
  { _id: false }
);

const tenantInvoiceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    tenantPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TenantPlan',
      default: null,
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ['subscription', 'overage', 'manual', 'adjustment', 'proration'],
      default: 'subscription',
    },
    status: {
      type: String,
      enum: ['draft', 'pending', 'paid', 'failed', 'void', 'canceled'],
      default: 'pending',
    },
    currency: {
      type: String,
      default: 'usd',
    },
    amount: {
      type: Number,
      default: 0,
    },
    subtotal: {
      type: Number,
      default: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    billingDate: Date,
    dueDate: Date,
    paidAt: Date,
    gatewayInvoiceId: {
      type: String,
      default: '',
    },
    invoiceUrl: {
      type: String,
      default: '',
    },
    billingSnapshot: {
      type: tenantInvoiceBillingSnapshotSchema,
      default: () => ({}),
    },
    lineItems: {
      type: [tenantInvoiceLineItemSchema],
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { collection: 'tenant_invoices', timestamps: true }
);

tenantInvoiceSchema.index({ tenantId: 1, createdAt: -1 });
tenantInvoiceSchema.index({ tenantPlanId: 1, createdAt: -1 });
tenantInvoiceSchema.index({ tenantId: 1, status: 1 });
tenantInvoiceSchema.index({ gatewayInvoiceId: 1 });

module.exports = mongoose.model('TenantInvoice', tenantInvoiceSchema);
