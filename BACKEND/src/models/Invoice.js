const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'paid', 'overdue', 'canceled'],
      default: 'draft',
    },
    type: {
      type: String,
      enum: ['subscription', 'overage', 'manual'],
      default: 'subscription',
    },
    plan: String, // e.g., 'basic', 'pro'
    amount: Number, // in cents/paise
    currency: String,
    period: {
      start: Date,
      end: Date,
    },
    items: [
      {
        description: String,
        quantity: Number,
        unitPrice: Number,
        total: Number,
      },
    ],
    stripeInvoiceId: String,
    razorpayPaymentId: String,
    paidAt: Date,
    dueAt: Date,
    pdfUrl: String,
    notes: String,
    createdAt: {
      type: Date,
      default: () => new Date(),
    },
    updatedAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  { collection: 'invoices', timestamps: true }
);

// Indexes
invoiceSchema.index({ tenantId: 1, createdAt: -1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ stripeInvoiceId: 1 });
invoiceSchema.index({ razorpayPaymentId: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
