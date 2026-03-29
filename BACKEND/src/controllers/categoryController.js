const Category = require('../models/Category');
const Product = require('../models/Product');
const SubCategory = require('../models/SubCategory');
const { logActivity } = require('../helpers/activityLogger');

const escapeRegex = (input = '') => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const buildTenantFilter = (tenantId, extra = {}) => ({
  ...extra,
  $or: [{ tenantId }, { tenantId: null }]
});

exports.list = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const tenantId = req.tenantId || req.user?.tenantId || null;
    const filter = buildTenantFilter(tenantId, { isActive: true });

    if (q) {
      filter.name = { $regex: escapeRegex(q), $options: 'i' };
    }

    const [items, total] = await Promise.all([
      Category.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
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
    const description = (req.body.description || '').trim();
    const tenantId = req.tenantId || req.user?.tenantId || null;
    if (!name) return res.status(400).json({ message: 'Category name is required' });

    const existing = await Category.findOne({ tenantId, name });
    if (existing) return res.status(400).json({ message: 'Category name already exists' });

    const category = new Category({ tenantId, name, description });
    await category.save();

    await logActivity(req.user.userId, 'CREATE_CATEGORY', `Created category: ${category.name}`);

    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ message: 'Category creation failed', error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const description = (req.body.description || '').trim();
    const tenantId = req.tenantId || req.user?.tenantId || null;
    if (!name) return res.status(400).json({ message: 'Category name is required' });

    const existing = await Category.findOne({ tenantId, name, _id: { $ne: req.params.id } });
    if (existing) return res.status(400).json({ message: 'Category name already exists' });

    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { name, description },
      { new: true }
    );
    if (!category) return res.status(404).json({ message: 'Category not found' });

    await logActivity(req.user.userId, 'UPDATE_CATEGORY', `Updated category to: ${category.name}`);

    res.json(category);
  } catch (err) {
    res.status(400).json({ message: 'Category update failed', error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId || null;
    const inUse = await Product.countDocuments({ categoryId: req.params.id });
    if (inUse > 0) {
      return res.status(400).json({ message: `Cannot delete category. ${inUse} product(s) are linked.` });
    }
    const subCount = await SubCategory.countDocuments({ categoryId: req.params.id, $or: [{ tenantId }, { tenantId: null }] });
    if (subCount > 0) {
      return res.status(400).json({ message: `Cannot delete category. ${subCount} subcategory(ies) are linked.` });
    }

    const category = await Category.findOneAndDelete({ _id: req.params.id, tenantId });
    if (!category) return res.status(404).json({ message: 'Category not found' });

    await logActivity(req.user.userId, 'DELETE_CATEGORY', `Deleted category: ${category.name}`);

    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(400).json({ message: 'Category deletion failed', error: err.message });
  }
};
