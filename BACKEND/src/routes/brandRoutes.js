const express = require('express');
const router = express.Router();
const brandCtrl = require('../controllers/brandController');

router.get('/', brandCtrl.list);
router.post('/', brandCtrl.create);
router.put('/:id', brandCtrl.update);
router.delete('/:id', brandCtrl.remove);

module.exports = router;
