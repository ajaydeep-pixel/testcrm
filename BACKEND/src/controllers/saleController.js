const Sale = require('../models/Sale');
const Product = require('../models/Product');
const mongoose = require('mongoose');
const { logActivity } = require('../helpers/activityLogger');

// List sales invoices with pagination/search
exports.list = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const filter = {};

    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ invoiceNo: regex }, { 'customer.name': regex }, { 'customer.phone': regex }, { 'customer.email': regex }];
    }

    const [items, total] = await Promise.all([
      Sale.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Sale.countDocuments(filter)
    ]);

    res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch invoices' });
  }
};

// Create a new sale (billing)
exports.create = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const payload = req.body || {};
    if (!payload.invoiceNo) {
      throw new Error('invoiceNo is required');
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error('At least one item is required');
    }

    // 1. Save Sale record
    const sale = new Sale(payload);
    await sale.save({ session });

    // 2. Update Inventory for each item
    for (const item of payload.items) {
      const product = await Product.findById(item.product).session(session);
      if (!product) {
        throw new Error(`Product not found: ${item.name}`);
      }
      
      // Ensure inventoryStatus exists
      if (!product.inventoryStatus) {
        product.inventoryStatus = { available: 0, damaged: 0, used: 0, returned: 0, lost: 0 };
      }

      // Check if enough stock is available
      if (product.inventoryStatus.available < item.quantity) {
        throw new Error(`Insufficient stock for ${item.name}. Available: ${product.inventoryStatus.available}`);
      }

      // Deduct stock
      try {
        product.inventoryStatus.available -= item.quantity;
        await product.save({ session });
      } catch (saveErr) {
        throw new Error(`Failed to update stock for ${item.name}: ${saveErr.message}`);
      }
    }

    await logActivity(req.user.id, 'CREATE_SALE', `Created invoice: ${sale.invoiceNo}, Amount: ${sale.totalAmount}`);

    await session.commitTransaction();
    session.endSession();
    res.status(201).json(sale);
  } catch (err) {
    console.error('Sale Creation Error:', err);
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ message: 'Sale creation failed', error: err.message });
  }
};

// Get sale by invoiceNo
exports.get = async (req, res) => {
  try {
    const sale = await Sale.findOne({ invoiceNo: req.params.invoiceNo });
    res.json(sale);
  } catch (err) {
    res.status(404).json({ message: 'Sale not found' });
  }
};
