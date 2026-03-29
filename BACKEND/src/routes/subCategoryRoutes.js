const express = require('express');
const router = express.Router();
const subCategoryCtrl = require('../controllers/subCategoryController');

router.get('/', subCategoryCtrl.list);
router.post('/', subCategoryCtrl.create);
router.put('/:id', subCategoryCtrl.update);
router.delete('/:id', subCategoryCtrl.remove);

module.exports = router;
