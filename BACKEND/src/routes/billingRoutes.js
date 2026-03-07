const express = require('express');
const router = express.Router();
const billingCtrl = require('../controllers/billingController');
const { verifyToken } = require('../middleware/authMiddleware');
const { extractTenant } = require('../middleware/tenantMiddleware');

// GET /api/billing/plans — public
router.get('/plans', billingCtrl.getPlans);

// Protected routes (require auth + tenant)
router.use(verifyToken, extractTenant);

// Subscription management
router.get('/subscription', billingCtrl.getSubscriptionStatus);
router.post('/create-checkout-session', billingCtrl.createCheckoutSession);
router.get('/checkout-status', billingCtrl.getCheckoutStatus);
router.post('/change-plan', billingCtrl.changePlan);
router.post('/cancel', billingCtrl.cancelSubscription);

// Invoices
router.get('/invoices', billingCtrl.listInvoices);
router.get('/invoices/:invoiceId', billingCtrl.getInvoice);

// Usage
router.post('/usage', billingCtrl.recordUsage);
router.get('/usage', billingCtrl.checkUsageLimits);

module.exports = router;
