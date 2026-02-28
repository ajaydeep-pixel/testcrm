const express = require('express');
const router = express.Router();
const categoryCtrl = require('../controllers/categoryController');
const { isAdmin } = require('../middleware/authMiddleware');

router.get('/', categoryCtrl.list);
router.post('/', isAdmin, categoryCtrl.create);
router.put('/:id', isAdmin, categoryCtrl.update);
router.delete('/:id', isAdmin, categoryCtrl.remove);

module.exports = router;
