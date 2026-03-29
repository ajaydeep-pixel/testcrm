const mongoose = require('mongoose');

const PriceSchema = new mongoose.Schema({
  amount: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' }
}, { _id: false });

const InventoryStatusSchema = new mongoose.Schema({
  available: { type: Number, default: 0 },
  damaged: { type: Number, default: 0 },
  used: { type: Number, default: 0 },
  returned: { type: Number, default: 0 },
  lost: { type: Number, default: 0 }
}, { _id: false });

const ProductSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true, default: null },
  name: { type: String, required: true, index: true },
  description: { type: String, trim: true, default: '' },
  sku: { type: String, trim: true, index: true, sparse: true },
  category: { type: String, index: true },
  subCategory: { type: String, trim: true, default: '' },
  subCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory', index: true },
  brand: { type: String },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', index: true },
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', index: true },
  model: { type: String },
  barcode: { type: String, index: true, sparse: true },
  oemNumber: { type: String, trim: true, default: '' },
  unitOfMeasure: { type: String, trim: true, default: '' },
  purchasePrice: PriceSchema,
  sellingPrice: PriceSchema,
  mrp: { type: Number, default: 0 },
  discountPercent: { type: Number, default: 0 },
  maxDiscountPercent: { type: Number, default: 0 },
  hsnCode: { type: String, trim: true, default: '' },
  taxType: { type: String, trim: true, default: 'GST' },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  images: [{ type: String }],
  tags: [{ type: String, trim: true }],
  compatibleVehicleModels: [{ type: String, trim: true }],
  gstPercent: { type: Number, default: 0 },
  status: { type: String, trim: true, default: 'active' },
  warrantyPeriod: { type: String, trim: true, default: '' },
  minStock: { type: Number, default: 0 },
  maxStock: { type: Number, default: 0 },
  stockLocation: { type: String, trim: true, default: '' },
  inventoryStatus: InventoryStatusSchema,
  expiryDate: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

ProductSchema.index({ tenantId: 1, sku: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Product', ProductSchema);
