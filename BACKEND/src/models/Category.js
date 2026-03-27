const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true, default: null },
  name: { type: String, required: true, trim: true, index: true },
  description: { type: String, trim: true, default: '' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

CategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Category', CategorySchema);
