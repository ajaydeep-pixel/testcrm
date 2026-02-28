const express = require('express');
const router = express.Router();
const saleCtrl = require('../controllers/saleController');

// GET /api/sales?q=&page=&limit= - list invoices
router.get('/', saleCtrl.list);

// POST /api/sales - create sale
router.post('/', saleCtrl.create);

// GET /api/sales/:invoiceNo - get sale by invoice
router.get('/:invoiceNo', saleCtrl.get);

module.exports = router;
