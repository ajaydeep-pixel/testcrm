const express = require('express');
const router = express.Router();
const supplierCtrl = require('../controllers/supplierController');

// POST /api/suppliers - create supplier
router.post('/', supplierCtrl.create);

// GET /api/suppliers - list suppliers
router.get('/', supplierCtrl.list);

// GET /api/suppliers/:id - get supplier by id
router.get('/:id', supplierCtrl.get);

module.exports = router;
