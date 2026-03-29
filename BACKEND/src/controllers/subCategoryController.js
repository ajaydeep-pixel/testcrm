const SubCategory = require('../models/SubCategory');
const Category = require('../models/Category');
const Product = require('../models/Product');
const { logActivity } = require('../helpers/activityLogger');

const escapeRegex = (input = '') => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const buildTenantFilter = (tenantId, extra = {}) => ({
  ...extra,
  $or: [{ tenantId }, { tenantId: null }]
});

const normalize = (doc) => {
  const item = doc.toObject ? doc.toObject() : { ...doc };
  const categoryName = item.categoryId?.name || item.categoryName || '';
  return { ...item, categoryName };
};

exports.list = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const tenantId = req.tenantId || req.user?.tenantId || null;
    const filter = buildTenantFilter(tenantId, { isActive: true });
    const categoryId = (req.query.categoryId || '').trim();

    if (categoryId) {
      filter.categoryId = categoryId;
    }

    if (q) {
      filter.name = { $regex: escapeRegex(q), $options: 'i' };
    }

    const [items, total] = await Promise.all([
      SubCategory.find(filter).populate({ path: 'categoryId', select: 'name' }).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
      SubCategory.countDocuments(filter)
    ]);

    res.json({
      items: items.map(normalize),
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch subcategories' });
  }
};

exports.create = async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const description = (req.body.description || '').trim();
    const categoryId = (req.body.categoryId || '').trim();
    const tenantId = req.tenantId || req.user?.tenantId || null;

    if (!name) return res.status(400).json({ message: 'Subcategory name is required' });
    if (!categoryId) return res.status(400).json({ message: 'Category is required' });

    const category = await Category.findOne({ _id: categoryId, $or: [{ tenantId }, { tenantId: null }] });
    if (!category) return res.status(400).json({ message: 'Invalid category' });

    const existing = await SubCategory.findOne({ tenantId, categoryId, name });
    if (existing) return res.status(400).json({ message: 'Subcategory name already exists in this category' });

    const subCategory = new SubCategory({ tenantId, categoryId, name, description });
    await subCategory.save();

    await logActivity(req.user.userId || req.user.id, 'CREATE_SUBCATEGORY', `Created subcategory: ${subCategory.name}`);

    const hydrated = await SubCategory.findById(subCategory._id).populate({ path: 'categoryId', select: 'name' });
    res.status(201).json(normalize(hydrated));
  } catch (err) {
    res.status(400).json({ message: 'Subcategory creation failed', error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const description = (req.body.description || '').trim();
    const categoryId = (req.body.categoryId || '').trim();
    const tenantId = req.tenantId || req.user?.tenantId || null;

    if (!name) return res.status(400).json({ message: 'Subcategory name is required' });
    if (!categoryId) return res.status(400).json({ message: 'Category is required' });

    const category = await Category.findOne({ _id: categoryId, $or: [{ tenantId }, { tenantId: null }] });
    if (!category) return res.status(400).json({ message: 'Invalid category' });

    const existing = await SubCategory.findOne({ tenantId, categoryId, name, _id: { $ne: req.params.id } });
    if (existing) return res.status(400).json({ message: 'Subcategory name already exists in this category' });

    const subCategory = await SubCategory.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { name, description, categoryId },
      { new: true }
    ).populate({ path: 'categoryId', select: 'name' });

    if (!subCategory) return res.status(404).json({ message: 'Subcategory not found' });

    await logActivity(req.user.userId || req.user.id, 'UPDATE_SUBCATEGORY', `Updated subcategory: ${subCategory.name}`);

    res.json(normalize(subCategory));
  } catch (err) {
    res.status(400).json({ message: 'Subcategory update failed', error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId || null;
    const inUse = await Product.countDocuments({ subCategoryId: req.params.id });
    if (inUse > 0) {
      return res.status(400).json({ message: `Cannot delete subcategory. ${inUse} product(s) are linked.` });
    }

    const subCategory = await SubCategory.findOneAndDelete({ _id: req.params.id, tenantId });
    if (!subCategory) return res.status(404).json({ message: 'Subcategory not found' });

    await logActivity(req.user.userId || req.user.id, 'DELETE_SUBCATEGORY', `Deleted subcategory: ${subCategory.name}`);

    res.json({ message: 'Subcategory deleted' });
  } catch (err) {
    res.status(400).json({ message: 'Subcategory deletion failed' });
  }
};
