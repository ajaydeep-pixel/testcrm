const express = require('express');
const router = express.Router();
const inventoryCtrl = require('../controllers/inventoryController');

// GET /api/inventory/product/:productId - get inventory for product
router.get('/product/:productId', inventoryCtrl.getByProduct);

// POST /api/inventory - add inventory entry
router.post('/', inventoryCtrl.add);

// GET /api/inventory/low-stock?threshold=5 - low stock alert
router.get('/low-stock', inventoryCtrl.lowStock);

module.exports = router;
