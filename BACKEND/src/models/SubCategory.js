const mongoose = require('mongoose');

const SubCategorySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true, default: null },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', index: true, required: true },
  name: { type: String, required: true, trim: true, index: true },
  description: { type: String, trim: true, default: '' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

SubCategorySchema.index({ tenantId: 1, categoryId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('SubCategory', SubCategorySchema);
