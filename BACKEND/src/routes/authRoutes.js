const express = require('express');
const router = express.Router();
const authCtrl = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

// Public endpoints (no auth required)
// POST /api/auth/signup — Tenant onboarding
router.post('/signup', authCtrl.signupTenant);

// POST /api/auth/login — User login (with optional tenantId)
router.post('/login', authCtrl.login);

// Protected endpoints (auth required)
// GET /api/auth/sessions — List all active sessions
router.get('/sessions', verifyToken, authCtrl.listSessions);

// POST /api/auth/sessions/revoke — Revoke a specific session
router.post('/sessions/revoke', verifyToken, authCtrl.revokeSession);

// POST /api/auth/logout — Log out from all sessions
router.post('/logout', verifyToken, authCtrl.logout);

// POST /api/auth/2fa/setup — Initiate 2FA setup (TOTP)
router.post('/2fa/setup', verifyToken, authCtrl.setup2FA);

// POST /api/auth/2fa/confirm — Confirm and enable 2FA
router.post('/2fa/confirm', verifyToken, authCtrl.confirm2FA);

// POST /api/auth/2fa/disable — Disable 2FA
router.post('/2fa/disable', verifyToken, authCtrl.disable2FA);

module.exports = router;

