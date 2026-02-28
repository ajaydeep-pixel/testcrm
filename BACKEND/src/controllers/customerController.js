const Customer = require('../models/Customer');

// List customers with simple search & pagination
exports.list = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 500);
    const skip = (page - 1) * limit;
    const filter = {};
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: regex }, { phone: regex }, { email: regex }];
    }

    const [items, total] = await Promise.all([
      Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Customer.countDocuments(filter)
    ]);

    res.json({ items, page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) });
  } catch (err) {
    console.error('Customer list error', err);
    res.status(500).json({ message: 'Failed to fetch customers' });
  }
};

// Create a new customer
exports.create = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.phone || !payload.phone.trim()) {
      return res.status(400).json({ message: 'Phone is required' });
    }

    // If phone already exists, return existing (idempotent)
    let existing = await Customer.findOne({ phone: payload.phone.trim() });
    if (existing) {
      return res.status(200).json(existing);
    }

    const customer = new Customer({
      name: payload.name || '',
      phone: payload.phone.trim(),
      address: payload.address || '',
      email: payload.email || ''
    });
    await customer.save();
    res.status(201).json(customer);
  } catch (err) {
    console.error('Customer create error', err);
    res.status(400).json({ message: 'Failed to create customer', error: err.message });
  }
};

// Get customer by id
exports.get = async (req, res) => {
  try {
    const c = await Customer.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Customer not found' });
    res.json(c);
  } catch (err) {
    res.status(404).json({ message: 'Customer not found' });
  }
};
