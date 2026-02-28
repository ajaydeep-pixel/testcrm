const express = require('express');
const router = express.Router();
const purchaseCtrl = require('../controllers/purchaseController');

// POST /api/purchases - create purchase order
router.post('/', purchaseCtrl.create);

// GET /api/purchases/:purchaseOrderNo - get purchase by order number
router.get('/:purchaseOrderNo', purchaseCtrl.get);

module.exports = router;
