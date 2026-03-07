const express = require('express');
const router = express.Router();
const auditCtrl = require('../controllers/auditController');
const { verifyToken } = require('../middleware/authMiddleware');
const { extractTenant } = require('../middleware/tenantMiddleware');
const { authorize } = require('../middleware/permissionMiddleware');

// All routes require auth + tenant extraction
router.use(verifyToken, extractTenant);

// GET /api/audit/logs — List audit logs (owner/manager/accountant only)
router.get('/logs', authorize('audit', 'read'), auditCtrl.getLogs);

// GET /api/audit/user/:userId — Get user activity timeline
router.get('/user/:userId', authorize('audit', 'read'), auditCtrl.getUserActivity);

// GET /api/audit/resource/:resourceId — Get resource change history
router.get('/resource/:resourceId', authorize('audit', 'read'), auditCtrl.getResourceHistory);

// GET /api/audit/export — Export logs (JSON or CSV)
router.get('/export', authorize('audit', 'read'), auditCtrl.exportLogs);

// GET /api/audit/summary — Get audit statistics
router.get('/summary', authorize('audit', 'read'), auditCtrl.getSummary);

module.exports = router;
