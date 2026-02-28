const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  name: { type: String, index: true },
  phone: { type: String, required: true, index: true },
  address: { type: String },
  email: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Customer', CustomerSchema);
