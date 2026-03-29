const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const productCtrl = require('../controllers/productController');

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.user?.userId || req.user?.id || 'unknown';
    const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'products', String(userId));
    ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    cb(null, `product-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype?.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  }
});

// GET /api/products?q=...
router.get('/', productCtrl.list);

// GET /api/products/search?q=...
router.get('/search', productCtrl.search);

// POST /api/products/upload -> upload product image
router.post('/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
    const userId = req.user?.userId || req.user?.id || 'unknown';
    const url = `/uploads/products/${userId}/${req.file.filename}`;
    res.json({ url });
  } catch (err) {
    res.status(400).json({ message: 'Image upload failed' });
  }
});

// POST /api/products/  -> create new product (instant add)
router.post('/', productCtrl.create);

// GET /api/products/:id
router.get('/:id', productCtrl.get);

// PUT /api/products/:id
router.put('/:id', productCtrl.update);

// DELETE /api/products/:id
router.delete('/:id', productCtrl.remove);

module.exports = router;
