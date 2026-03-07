const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userEmail: String,
    userName: String,
    action: {
      type: String,
      enum: ['create', 'read', 'update', 'delete', 'export', 'import', 'approve', 'reject', 'login', 'logout', 'download'],
      required: true,
    },
    resource: {
      type: String,
      enum: ['product', 'sale', 'purchase', 'invoice', 'user', 'branch', 'inventory', 'customer', 'supplier', 'settings'],
      required: true,
    },
    resourceId: String,
    resourceName: String,
    description: String,
    // Change tracking
    changes: {
      before: mongoose.Schema.Types.Mixed,
      after: mongoose.Schema.Types.Mixed,
    },
    // Context
    ipAddress: String,
    userAgent: String,
    deviceId: String,
    branchId: mongoose.Schema.Types.ObjectId,
    // Status
    status: {
      type: String,
      enum: ['success', 'failure'],
      default: 'success',
    },
    errorMessage: String,
    // Timestamps
    timestamp: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
  },
  { collection: 'audit_logs', timestamps: false }
);

// Indexes for common queries
auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, action: 1 });
auditLogSchema.index({ resourceId: 1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ status: 1 });

// TTL index for automatic deletion (customize per tenant)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

module.exports = mongoose.model('AuditLog', auditLogSchema);
