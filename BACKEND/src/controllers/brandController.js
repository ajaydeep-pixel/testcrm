const Brand = require('../models/Brand');
const Product = require('../models/Product');
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
      Brand.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
      Brand.countDocuments(filter)
    ]);

    res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch brands' });
  }
};

exports.create = async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const description = (req.body.description || '').trim();
    const tenantId = req.tenantId || req.user?.tenantId || null;
    if (!name) return res.status(400).json({ message: 'Brand name is required' });

    const existing = await Brand.findOne({ tenantId, name });
    if (existing) return res.status(400).json({ message: 'Brand name already exists' });

    const brand = new Brand({ tenantId, name, description });
    await brand.save();
    
    await logActivity(req.user.userId, 'CREATE_BRAND', `Created brand: ${brand.name}`);

    res.status(201).json(brand);
  } catch (err) {
    res.status(400).json({ message: 'Brand creation failed', error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const description = (req.body.description || '').trim();
    const tenantId = req.tenantId || req.user?.tenantId || null;
    if (!name) return res.status(400).json({ message: 'Brand name is required' });

    const existing = await Brand.findOne({ tenantId, name, _id: { $ne: req.params.id } });
    if (existing) return res.status(400).json({ message: 'Brand name already exists' });

    const brand = await Brand.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { name, description },
      { new: true }
    );
    if (!brand) return res.status(404).json({ message: 'Brand not found' });
    
    await logActivity(req.user.userId, 'UPDATE_BRAND', `Updated brand to: ${brand.name}`);

    res.json(brand);
  } catch (err) {
    res.status(400).json({ message: 'Brand update failed', error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId || null;
    const inUse = await Product.countDocuments({ brandId: req.params.id });
    if (inUse > 0) {
      return res.status(400).json({ message: `Cannot delete brand. ${inUse} product(s) are linked.` });
    }

    const brand = await Brand.findOneAndDelete({ _id: req.params.id, tenantId });
    if (!brand) return res.status(404).json({ message: 'Brand not found' });

    await logActivity(req.user.userId, 'DELETE_BRAND', `Deleted brand: ${brand.name}`);

    res.json({ message: 'Brand deleted' });
  } catch (err) {
    res.status(400).json({ message: 'Brand deletion failed', error: err.message });
  }
};
