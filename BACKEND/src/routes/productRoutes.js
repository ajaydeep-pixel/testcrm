const express = require('express');
const router = express.Router();
const productCtrl = require('../controllers/productController');

// GET /api/products?q=...
router.get('/', productCtrl.list);

// GET /api/products/search?q=...
router.get('/search', productCtrl.search);

// POST /api/products/  -> create new product (instant add)
router.post('/', productCtrl.create);

// GET /api/products/:id
router.get('/:id', productCtrl.get);

// PUT /api/products/:id
router.put('/:id', productCtrl.update);

// DELETE /api/products/:id
router.delete('/:id', productCtrl.remove);

module.exports = router;
