const mongoose = require('mongoose');

const SaleItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: String,
  barcode: String,
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  gstPercent: Number,
  discount: { type: Number, default: 0 }
}, { _id: false });

const SaleSchema = new mongoose.Schema({
  invoiceNo: { type: String, required: true, unique: true },
  items: [SaleItemSchema],
  customer: {
    name: String,
    phone: String,
    email: String
  },
  paymentMethod: { type: String, enum: ['Cash','UPI','Card','Credit'], default: 'Cash' },
  totalAmount: Number,
  gstAmount: Number,
  discountAmount: Number,
  paidAmount: Number,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Sale', SaleSchema);
