const express = require('express');
const router = express.Router();
const settingsCtrl = require('../controllers/settingsController');
const { authorize } = require('../middleware/permissionMiddleware');

// Billing Info (current tenant / business account)
router.get('/business-info', authorize('settings', 'read'), settingsCtrl.getBusinessInfo);
router.put('/business-info', authorize('settings', 'update'), settingsCtrl.updateBusinessInfo);
router.get('/billing-info', authorize('settings', 'read'), settingsCtrl.getBillingInfo);
router.put('/billing-info', authorize('settings', 'update'), settingsCtrl.updateBillingInfo);
router.get('/profile-info', authorize('settings', 'read'), settingsCtrl.getProfileInfo);
router.put('/profile-info', authorize('settings', 'update'), settingsCtrl.updateProfileInfo);

module.exports = router;
