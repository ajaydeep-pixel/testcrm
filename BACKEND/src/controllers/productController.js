const Product = require('../models/Product');
const Brand = require('../models/Brand');
const Category = require('../models/Category');
const { logActivity } = require('../helpers/activityLogger');

const escapeRegex = (input = '') => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PRODUCT_POPULATE = [{ path: 'brandId', select: 'name' }, { path: 'categoryId', select: 'name' }];

const normalizeProduct = (doc) => {
  const p = doc.toObject ? doc.toObject() : { ...doc };
  const brandName = p.brandId?.name || p.brand || '';
  const categoryName = p.categoryId?.name || p.category || '';
  return {
    ...p,
    brand: brandName,
    category: categoryName,
    brandName,
    categoryName
  };
};

// List all products with optional query filter
exports.list = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 200);
    const skip = (page - 1) * limit;
    const filter = {};

    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: regex }, { brand: regex }, { model: regex }, { category: regex }, { barcode: regex }];
    }

    const [items, total] = await Promise.all([
      Product.find(filter).populate(PRODUCT_POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Product.countDocuments(filter)
    ]);

    res.json({
      items: items.map(normalizeProduct),
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
};

// Search products by name or barcode (for POS)
exports.search = async (req, res) => {
  try {
    const q = req.query.q || '';
    const barcode = req.query.barcode;
    let products;
    if (barcode) {
      products = await Product.findOne({ barcode: barcode }).populate(PRODUCT_POPULATE);
      return res.json(products ? [normalizeProduct(products)] : []);
    }
    const regex = new RegExp(escapeRegex(q), 'i');
    products = await Product.find({ $or: [{ name: regex }, { brand: regex }, { model: regex }, { category: regex }] })
      .populate(PRODUCT_POPULATE)
      .limit(20);
    res.json(products.map(normalizeProduct));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create product (used by instant-add during billing)
exports.create = async (req, res) => {
  try {
    const payload = { ...req.body };
    const { brandId, categoryId } = payload;

    if (!brandId || !categoryId) {
      return res.status(400).json({ message: 'brandId and categoryId are required' });
    }

    const [brandDoc, categoryDoc] = await Promise.all([
      Brand.findById(brandId),
      Category.findById(categoryId)
    ]);

    if (!brandDoc) return res.status(400).json({ message: 'Invalid brandId' });
    if (!categoryDoc) return res.status(400).json({ message: 'Invalid categoryId' });

    // Keep denormalized names for compatibility with existing search and UI
    payload.brand = brandDoc.name;
    payload.category = categoryDoc.name;

    const product = new Product(payload);
    await product.save();

    await logActivity(req.user.id, 'CREATE_PRODUCT', `Created product: ${product.name} (${product.barcode || 'No barcode'})`);

    const hydrated = await Product.findById(product._id).populate(PRODUCT_POPULATE);
    res.status(201).json(normalizeProduct(hydrated));
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: 'Invalid data', error: err.message });
  }
};

// Basic update
exports.update = async (req, res) => {
  try {
    const payload = { ...req.body };
    const { brandId, categoryId } = payload;

    if (brandId) {
      const brandDoc = await Brand.findById(brandId);
      if (!brandDoc) return res.status(400).json({ message: 'Invalid brandId' });
      payload.brand = brandDoc.name;
    }

    if (categoryId) {
      const categoryDoc = await Category.findById(categoryId);
      if (!categoryDoc) return res.status(400).json({ message: 'Invalid categoryId' });
      payload.category = categoryDoc.name;
    }

    const product = await Product.findByIdAndUpdate(req.params.id, payload, { new: true }).populate(PRODUCT_POPULATE);
    
    if (product) {
      await logActivity(req.user.id, 'UPDATE_PRODUCT', `Updated product: ${product.name}`);
    }

    res.json(product ? normalizeProduct(product) : null);
  } catch (err) {
    res.status(400).json({ message: 'Update failed' });
  }
};

// Get single product
exports.get = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate(PRODUCT_POPULATE);
    res.json(product ? normalizeProduct(product) : null);
  } catch (err) {
    res.status(404).json({ message: 'Not found' });
  }
};

// Delete single product
exports.remove = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    await Product.findByIdAndDelete(req.params.id);
    
    await logActivity(req.user.id, 'DELETE_PRODUCT', `Deleted product: ${product.name}`);

    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(400).json({ message: 'Delete failed' });
  }
};
