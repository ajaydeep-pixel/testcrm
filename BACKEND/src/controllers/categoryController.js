const Category = require('../models/Category');
const Product = require('../models/Product');
const { logActivity } = require('../helpers/activityLogger');

exports.list = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const filter = { isActive: true };

    if (q) {
      filter.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    const [items, total] = await Promise.all([
      Category.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
      Category.countDocuments(filter)
    ]);

    res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
};

exports.create = async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Category name is required' });
    const category = new Category({ name });
    await category.save();

    await logActivity(req.user.id, 'CREATE_CATEGORY', `Created category: ${category.name}`);

    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ message: 'Category creation failed', error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Category name is required' });
    const category = await Category.findByIdAndUpdate(req.params.id, { name }, { new: true });
    if (!category) return res.status(404).json({ message: 'Category not found' });

    await logActivity(req.user.id, 'UPDATE_CATEGORY', `Updated category to: ${category.name}`);

    res.json(category);
  } catch (err) {
    res.status(400).json({ message: 'Category update failed', error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const inUse = await Product.countDocuments({ categoryId: req.params.id });
    if (inUse > 0) {
      return res.status(400).json({ message: `Cannot delete category. ${inUse} product(s) are linked.` });
    }

    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    await logActivity(req.user.id, 'DELETE_CATEGORY', `Deleted category: ${category.name}`);

    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(400).json({ message: 'Category deletion failed', error: err.message });
  }
};
