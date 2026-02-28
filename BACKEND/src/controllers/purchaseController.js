const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const mongoose = require('mongoose');
const { logActivity } = require('../helpers/activityLogger');

// Create a new purchase order
exports.create = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const payload = req.body || {};
    if (!payload.purchaseOrderNo) {
      throw new Error('purchaseOrderNo is required');
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error('At least one item is required');
    }

    // 1. Save Purchase record
    const purchase = new Purchase(payload);
    await purchase.save({ session });

    // 2. Update Inventory for each item
    for (const item of payload.items) {
      const product = await Product.findById(item.product).session(session);
      if (!product) {
        throw new Error(`Product not found: ${item.name}`);
      }

      // Add to available stock
      if (!product.inventoryStatus) {
        product.inventoryStatus = { available: 0, damaged: 0, used: 0, returned: 0, lost: 0 };
      }
      product.inventoryStatus.available += item.quantity;
      
      // Update purchase price if it changed
      product.purchasePrice = { amount: item.price, currency: 'INR' };
      
      await product.save({ session });
    }

    await logActivity(req.user.id, 'CREATE_PURCHASE', `Created purchase order: ${purchase.purchaseOrderNo}, Amount: ${purchase.totalAmount}`);

    await session.commitTransaction();
    session.endSession();
    res.status(201).json(purchase);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ message: 'Purchase creation failed', error: err.message });
  }
};

// Get purchase by order number
exports.get = async (req, res) => {
  try {
    const purchase = await Purchase.findOne({ purchaseOrderNo: req.params.purchaseOrderNo });
    res.json(purchase);
  } catch (err) {
    res.status(404).json({ message: 'Purchase not found' });
  }
};
