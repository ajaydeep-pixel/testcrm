/**
 * Admin Routes
 * All protected by superadmin middleware
 */

const express = require('express');
const router = express.Router();
const adminCtrl = require('../controllers/adminController');
const { verifyToken } = require('../middleware/authMiddleware');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Superadmin middleware
const requireSuperadmin = (req, res, next) => {
  if (req.user && req.user.role === 'superadmin') {
    next();
  } else {
    res.status(403).json({ message: 'Superadmin access required' });
  }
};

// All routes require verifyToken + requireSuperadmin
router.use(verifyToken, requireSuperadmin);

const brandingUploadDir = path.join(__dirname, '..', '..', 'uploads', 'branding');
if (!fs.existsSync(brandingUploadDir)) {
  fs.mkdirSync(brandingUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, brandingUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    cb(null, `branding-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Dashboard & Metrics
router.get('/dashboard', adminCtrl.getDashboardMetrics);

// Tenants
router.get('/tenants', adminCtrl.listTenants);
router.get('/tenants/:tenantId', adminCtrl.getTenantDetails);
router.put('/tenants/:tenantId', adminCtrl.updateTenant);
router.patch('/tenants/:tenantId/status', adminCtrl.updateTenantStatus);

// Users
router.get('/users', adminCtrl.listUsers);
router.patch('/users/:userId/status', adminCtrl.updateUserStatus);
router.post('/users/:userId/login-as', adminCtrl.loginAsUser);
router.patch('/users/:userId/password', adminCtrl.resetUserPassword);

// Invoices & Payments
router.get('/invoices', adminCtrl.listInvoices);
router.get('/payments', adminCtrl.getPaymentsSummary);

// Activity Logs
router.get('/activity', adminCtrl.getActivityLogs);

// Plans
router.get('/plans', adminCtrl.listPlans);
router.post('/plans', adminCtrl.createPlan);
router.put('/plans/:planId', adminCtrl.updatePlan);
router.delete('/plans/:planId', adminCtrl.deletePlan);

// Platform Settings
router.get('/settings', adminCtrl.getSettings);
router.put('/settings', adminCtrl.updateSettings);
router.post('/settings/logo', upload.single('logo'), adminCtrl.uploadBrandLogo);

module.exports = router;
