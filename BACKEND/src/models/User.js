const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: function() { return this.role !== 'superadmin'; },
  },
  name: { type: String, required: true },
  email: { type: String, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'owner', 'manager', 'accountant', 'staff'], default: 'staff' },
  // 2FA (TOTP)
  totpEnabled: { type: Boolean, default: false },
  totpSecret: String,
  backupCodes: [String],
  // Account status
  status: { type: String, enum: ['active', 'inactive', 'locked'], default: 'active' },
  // Device & IP tracking
  lastLoginAt: Date,
  lastLoginIp: String,
  devices: [{
    deviceId: String,
    userAgent: String,
    ipAddress: String,
    lastUsedAt: Date,
    isActive: Boolean,
  }],
  billing_info: {
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    gst: { type: String, default: '' },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    zip: { type: String, default: '' },
    country: { type: String, default: '' },
  },
  customPermissions: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Indexes
UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });
UserSchema.index({ tenantId: 1 });
UserSchema.index({ status: 1 });

module.exports = mongoose.model('User', UserSchema);
