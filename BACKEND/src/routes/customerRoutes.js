const express = require('express');
const router = express.Router();
const customerCtrl = require('../controllers/customerController');

// GET /api/customers?q=&page=&limit=
router.get('/', customerCtrl.list);

// POST /api/customers - create or return existing by phone
router.post('/', customerCtrl.create);

// GET /api/customers/:id
router.get('/:id', customerCtrl.get);

module.exports = router;
