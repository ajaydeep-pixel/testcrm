const express = require('express');
const router = express.Router();
const billingCtrl = require('../controllers/billingController');
const { verifyToken } = require('../middleware/authMiddleware');
const { extractTenant } = require('../middleware/tenantMiddleware');

// All routes require auth + tenant extraction

// GET /api/billing/plans — Get available plans (public)
router.get('/plans', billingCtrl.getPlans);

// Protected routes (require auth + tenant)
router.use(verifyToken, extractTenant);

// GET /api/billing/subscription — Get subscription status
router.get('/subscription', billingCtrl.getSubscriptionStatus);

// POST /api/billing/subscribe — Create subscription
router.post('/subscribe', billingCtrl.createSubscription);

// POST /api/billing/change-plan — Upgrade/downgrade
router.post('/change-plan', billingCtrl.changePlan);

// POST /api/billing/cancel — Cancel subscription
router.post('/cancel', billingCtrl.cancelSubscription);

// GET /api/billing/invoices — List invoices
router.get('/invoices', billingCtrl.listInvoices);

// GET /api/billing/invoices/:invoiceId — Get specific invoice
router.get('/invoices/:invoiceId', billingCtrl.getInvoice);

// POST /api/billing/usage — Record usage
router.post('/usage', billingCtrl.recordUsage);

// GET /api/billing/usage — Check usage limits
router.get('/usage', billingCtrl.checkUsageLimits);

// Webhooks (public, but verified via signatures)
// POST /api/billing/webhook/stripe
router.post('/webhook/stripe', billingCtrl.stripeWebhook);

// POST /api/billing/webhook/razorpay
router.post('/webhook/razorpay', billingCtrl.razorpayWebhook);

module.exports = router;
