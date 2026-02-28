const mongoose = require('mongoose');

const InventoryEntrySchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  status: { type: String, enum: ['Available','Damaged','Used','Returned','Lost'], default: 'Available' },
  location: { type: String },
  batch: { type: String },
  expiryDate: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Inventory', InventoryEntrySchema);
