const Product = require('../models/Product');
const Brand = require('../models/Brand');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Inventory = require('../models/Inventory');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const fs = require('fs');
const path = require('path');
const { logActivity } = require('../helpers/activityLogger');

const escapeRegex = (input = '') => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PRODUCT_POPULATE = [
  { path: 'brandId', select: 'name' },
  { path: 'categoryId', select: 'name' },
  { path: 'subCategoryId', select: 'name' }
];
const buildTenantFilter = (tenantId, extra = {}) => ({
  ...extra,
  $or: [{ tenantId }, { tenantId: null }]
});
const buildTenantScope = (tenantId) => ({ $or: [{ tenantId }, { tenantId: null }] });

const normalizeProduct = (doc) => {
  const p = doc.toObject ? doc.toObject() : { ...doc };
  const brandName = p.brandId?.name || p.brand || '';
  const categoryName = p.categoryId?.name || p.category || '';
  const subCategoryName = p.subCategoryId?.name || p.subCategory || '';
  return {
    ...p,
    brand: brandName,
    category: categoryName,
    subCategory: subCategoryName,
    brandName,
    categoryName,
    subCategoryName
  };
};

const resolveUploadPath = (url) => {
  if (!url || typeof url !== 'string') return null;
  let pathname = url;
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      pathname = new URL(url).pathname;
    }
  } catch {
    return null;
  }
  if (!pathname.startsWith('/uploads/')) return null;
  const safePath = pathname.replace(/^\/+/, '');
  const filePath = path.join(__dirname, '..', '..', safePath);
  if (!filePath.includes(path.join('uploads', 'products'))) return null;
  return filePath;
};

// List all products with optional query filter
exports.list = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 200);
    const skip = (page - 1) * limit;
    const tenantId = req.tenantId || req.user?.tenantId || null;
    const filter = buildTenantFilter(tenantId, {});
    const tenantScope = buildTenantScope(tenantId);

    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      filter.$and = [
        tenantScope,
        {
          $or: [
            { name: regex },
            { sku: regex },
            { brand: regex },
            { model: regex },
            { category: regex },
            { subCategory: regex },
            { barcode: regex },
            { oemNumber: regex },
            { description: regex }
          ]
        }
      ];
      delete filter.$or;
    }

    const [items, total] = await Promise.all([
      Product.find(filter).populate(PRODUCT_POPULATE).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
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
    const tenantId = req.tenantId || req.user?.tenantId || null;
    const tenantScope = buildTenantScope(tenantId);
    let products;
    if (barcode) {
      products = await Product.findOne(buildTenantFilter(tenantId, { barcode })).populate(PRODUCT_POPULATE);
      return res.json(products ? [normalizeProduct(products)] : []);
    }
    const regex = new RegExp(escapeRegex(q), 'i');
    products = await Product.find({
      $and: [
        tenantScope,
        {
          $or: [
            { name: regex },
            { sku: regex },
            { brand: regex },
            { model: regex },
            { category: regex },
            { subCategory: regex },
            { barcode: regex },
            { oemNumber: regex },
            { description: regex }
          ]
        }
      ]
    })
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
    const tenantId = req.tenantId || req.user?.tenantId || null;
    const { brandId, categoryId, subCategoryId } = payload;

    if (!brandId || !categoryId) {
      return res.status(400).json({ message: 'brandId and categoryId are required' });
    }

    const [brandDoc, categoryDoc] = await Promise.all([
      Brand.findOne({ _id: brandId, $or: [{ tenantId }, { tenantId: null }] }),
      Category.findOne({ _id: categoryId, $or: [{ tenantId }, { tenantId: null }] })
    ]);

    if (!brandDoc) return res.status(400).json({ message: 'Invalid brandId' });
    if (!categoryDoc) return res.status(400).json({ message: 'Invalid categoryId' });

    payload.brand = brandDoc.name;
    payload.category = categoryDoc.name;
    payload.tenantId = tenantId;

    if (subCategoryId) {
      const subCategoryDoc = await SubCategory.findOne({ _id: subCategoryId, $or: [{ tenantId }, { tenantId: null }] });
      if (!subCategoryDoc) return res.status(400).json({ message: 'Invalid subCategoryId' });
      if (String(subCategoryDoc.categoryId) !== String(categoryId)) {
        return res.status(400).json({ message: 'Subcategory does not belong to selected category' });
      }
      payload.subCategory = subCategoryDoc.name;
      payload.subCategoryId = subCategoryDoc._id;
    } else {
      payload.subCategory = '';
      payload.subCategoryId = undefined;
    }

    const product = new Product(payload);
    await product.save();

    await logActivity(req.user.userId || req.user.id, 'CREATE_PRODUCT', `Created product: ${product.name} (${product.barcode || 'No barcode'})`);

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
    const tenantId = req.tenantId || req.user?.tenantId || null;
    const { brandId, categoryId, subCategoryId } = payload;

    const existingProduct = await Product.findOne({ _id: req.params.id, $or: [{ tenantId }, { tenantId: null }] });
    if (!existingProduct) return res.status(404).json({ message: 'Product not found' });

    if (brandId) {
      const brandDoc = await Brand.findOne({ _id: brandId, $or: [{ tenantId }, { tenantId: null }] });
      if (!brandDoc) return res.status(400).json({ message: 'Invalid brandId' });
      payload.brand = brandDoc.name;
    }

    if (categoryId) {
      const categoryDoc = await Category.findOne({ _id: categoryId, $or: [{ tenantId }, { tenantId: null }] });
      if (!categoryDoc) return res.status(400).json({ message: 'Invalid categoryId' });
      payload.category = categoryDoc.name;
    }

    if (subCategoryId) {
      const subCategoryDoc = await SubCategory.findOne({ _id: subCategoryId, $or: [{ tenantId }, { tenantId: null }] });
      if (!subCategoryDoc) return res.status(400).json({ message: 'Invalid subCategoryId' });
      if (categoryId && String(subCategoryDoc.categoryId) !== String(categoryId)) {
        return res.status(400).json({ message: 'Subcategory does not belong to selected category' });
      }
      payload.subCategory = subCategoryDoc.name;
      payload.subCategoryId = subCategoryDoc._id;
    } else if (subCategoryId === '' || subCategoryId === null) {
      payload.subCategory = '';
      payload.subCategoryId = undefined;
    }

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, $or: [{ tenantId }, { tenantId: null }] },
      payload,
      { new: true }
    ).populate(PRODUCT_POPULATE);

    const oldImages = Array.isArray(existingProduct.images) ? existingProduct.images : [];
    const newImages = Array.isArray(product?.images) ? product.images : [];
    const removedImages = oldImages.filter((img) => img && !newImages.includes(img));

    removedImages.forEach((img) => {
      const filePath = resolveUploadPath(img);
      if (!filePath) return;
      fs.unlink(filePath, () => {});
    });

    if (product) {
      await logActivity(req.user.userId || req.user.id, 'UPDATE_PRODUCT', `Updated product: ${product.name}`);
    }

    res.json(product ? normalizeProduct(product) : null);
  } catch (err) {
    res.status(400).json({ message: 'Update failed' });
  }
};

// Get single product
exports.get = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId || null;
    const product = await Product.findOne({ _id: req.params.id, $or: [{ tenantId }, { tenantId: null }] }).populate(PRODUCT_POPULATE);
    res.json(product ? normalizeProduct(product) : null);
  } catch (err) {
    res.status(404).json({ message: 'Not found' });
  }
};

// Delete single product
exports.remove = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId || null;
    const product = await Product.findOne({ _id: req.params.id, $or: [{ tenantId }, { tenantId: null }] });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const [inventoryCount, saleCount, purchaseCount] = await Promise.all([
      Inventory.countDocuments({ product: product._id }),
      Sale.countDocuments({ 'items.product': product._id }),
      Purchase.countDocuments({ 'items.product': product._id })
    ]);

    if (inventoryCount > 0 || saleCount > 0 || purchaseCount > 0) {
      return res.status(400).json({
        message: 'Cannot delete product. It is already used in inventory or billing records.'
      });
    }

    await Product.findOneAndDelete({ _id: req.params.id, $or: [{ tenantId }, { tenantId: null }] });

    if (Array.isArray(product.images)) {
      product.images.forEach((img) => {
        const filePath = resolveUploadPath(img);
        if (!filePath) return;
        fs.unlink(filePath, () => {});
      });
    }
    
    await logActivity(req.user.userId || req.user.id, 'DELETE_PRODUCT', `Deleted product: ${product.name}`);

    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(400).json({ message: 'Delete failed' });
  }
};
