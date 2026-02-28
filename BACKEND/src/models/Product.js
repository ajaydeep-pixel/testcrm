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
  name: { type: String, required: true, index: true },
  category: { type: String, index: true },
  brand: { type: String },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', index: true },
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', index: true },
  model: { type: String },
  barcode: { type: String, index: true, sparse: true },
  purchasePrice: PriceSchema,
  sellingPrice: PriceSchema,
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  images: [{ type: String }],
  gstPercent: { type: Number, default: 0 },
  inventoryStatus: InventoryStatusSchema,
  expiryDate: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', ProductSchema);
