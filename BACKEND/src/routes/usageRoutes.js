const express = require('express');
const router = express.Router();
const usageCtrl = require('../controllers/usageController');
const { verifyToken } = require('../middleware/authMiddleware');
const { extractTenant, verifyTenantAccess } = require('../middleware/tenantMiddleware');

// All routes require auth + tenant
router.use(verifyToken, extractTenant, verifyTenantAccess);

// GET /api/usage/current — Get current month usage vs limits
router.get('/current', usageCtrl.getCurrentUsage);

// GET /api/usage/rate-limit-status — Get rate limit status
router.get('/rate-limit-status', usageCtrl.getRateLimitStatus);

// GET /api/usage/dashboard — Complete usage dashboard
router.get('/dashboard', usageCtrl.getDashboard);

// POST /api/usage/reset — Reset usage (owner only)
router.post('/reset', usageCtrl.resetUsage);

// POST /api/usage/sync — Sync to database (owner only)
router.post('/sync', usageCtrl.syncUsageToDb);

module.exports = router;
