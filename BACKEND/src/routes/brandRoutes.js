const express = require('express');
const router = express.Router();
const brandCtrl = require('../controllers/brandController');
const { isAdmin } = require('../middleware/authMiddleware');

router.get('/', brandCtrl.list);
router.post('/', isAdmin, brandCtrl.create);
router.put('/:id', isAdmin, brandCtrl.update);
router.delete('/:id', isAdmin, brandCtrl.remove);

module.exports = router;
