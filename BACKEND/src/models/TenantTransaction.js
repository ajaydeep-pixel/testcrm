const mongoose = require('mongoose');

const tenantTransactionSchema = new mongoose.Schema(
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
    tenantInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TenantInvoice',
      default: null,
    },
    gateway: {
      type: String,
      enum: ['stripe', 'razorpay'],
      required: true,
    },
    type: {
      type: String,
      enum: ['charge', 'refund', 'authorization', 'payment_attempt', 'webhook_event'],
      default: 'payment_attempt',
    },
    gatewayTransactionId: {
      type: String,
      default: '',
    },
    gatewayPaymentIntentId: {
      type: String,
      default: '',
    },
    gatewayOrderId: {
      type: String,
      default: '',
    },
    amount: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'usd',
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'refunded', 'canceled'],
      default: 'pending',
    },
    failureCode: {
      type: String,
      default: '',
    },
    failureMessage: {
      type: String,
      default: '',
    },
    idempotencyKey: {
      type: String,
      default: '',
    },
    rawEventRef: {
      type: String,
      default: '',
    },
    processedAt: Date,
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { collection: 'tenant_transactions', timestamps: true }
);

tenantTransactionSchema.index({ tenantId: 1, createdAt: -1 });
tenantTransactionSchema.index({ tenantInvoiceId: 1, createdAt: -1 });
tenantTransactionSchema.index({ tenantPlanId: 1, createdAt: -1 });
tenantTransactionSchema.index({ gateway: 1, gatewayTransactionId: 1 });
tenantTransactionSchema.index({ gateway: 1, gatewayOrderId: 1 });
tenantTransactionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('TenantTransaction', tenantTransactionSchema);
