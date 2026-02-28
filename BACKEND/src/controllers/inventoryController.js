const Inventory = require('../models/Inventory');
const Product = require('../models/Product');

// Get inventory for a product
exports.getByProduct = async (req, res) => {
  try {
    const productId = req.params.productId;
    const entries = await Inventory.find({ product: productId });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch inventory' });
  }
};

// Add inventory entry (manual or purchase)
exports.add = async (req, res) => {
  try {
    const entry = new Inventory(req.body);
    await entry.save();
    res.status(201).json(entry);
  } catch (err) {
    res.status(400).json({ message: 'Failed to add inventory', error: err.message });
  }
};

// Low stock alert (all products below threshold)
exports.lowStock = async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 5;
    const products = await Product.find({ 'inventoryStatus.available': { $lt: threshold } });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch low stock products' });
  }
};
