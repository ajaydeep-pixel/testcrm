const mongoose = require('mongoose');

const PurchaseItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: String,
  barcode: String,
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  gstPercent: Number
}, { _id: false });

const PurchaseSchema = new mongoose.Schema({
  purchaseOrderNo: { type: String, required: true, unique: true },
  items: [PurchaseItemSchema],
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  totalAmount: Number,
  gstAmount: Number,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Purchase', PurchaseSchema);
