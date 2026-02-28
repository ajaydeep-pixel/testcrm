const Supplier = require('../models/Supplier');

// Create supplier
exports.create = async (req, res) => {
  try {
    const supplier = new Supplier(req.body);
    await supplier.save();
    res.status(201).json(supplier);
  } catch (err) {
    res.status(400).json({ message: 'Supplier creation failed', error: err.message });
  }
};

// Get all suppliers
exports.list = async (req, res) => {
  try {
    const suppliers = await Supplier.find();
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch suppliers' });
  }
};

// Get supplier by id
exports.get = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    res.json(supplier);
  } catch (err) {
    res.status(404).json({ message: 'Supplier not found' });
  }
};
