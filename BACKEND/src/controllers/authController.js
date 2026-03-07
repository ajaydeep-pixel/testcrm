const User = require('../models/User');
const Tenant = require('../models/Tenant');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const AuthService = require('../services/AuthService');
const SessionService = require('../services/SessionService');

/**
 * TENANT ONBOARDING (Signup)
 * Creates a new Tenant + Admin User + trial setup
 */
exports.signupTenant = async (req, res) => {
  try {
    const { companyName, email, password, branch, timezone = 'UTC', gst_enabled = false, gst_number } = req.body;

    // Normalize branch — frontend may send string or object { name, timezone, currency }
    const branchName = typeof branch === 'object' ? branch.name : branch;
    const branchTimezone = (typeof branch === 'object' && branch.timezone) || timezone;
    const branchCurrency = (typeof branch === 'object' && branch.currency) || 'USD';

    // Validate input
    if (!companyName || !email || !password || !branchName) {
      return res.status(400).json({ message: 'Missing required fields: companyName, email, password, branch' });
    }

    // Check if email already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Create Tenant (14-day trial)
    const tenant = new Tenant({
      _id: new mongoose.Types.ObjectId(),
      name: companyName,
      email,
      status: 'active',
      plan: 'trial',
      trialStartAt: new Date(),
      trialEndAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      branches: [
        {
          _id: new mongoose.Types.ObjectId(),
          name: branchName,
          timezone: branchTimezone,
        },
      ],
      settings: {
        timezone: branchTimezone,
        currency: branchCurrency,
        gst_enabled,
        gst_number,
      },
    });

    await tenant.save();

    // Create Admin User
    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({
      tenantId: tenant._id,
      name: companyName.split(' ')[0], // First word as name
      email,
      passwordHash,
      role: 'owner',
      status: 'active',
    });

    await user.save();

    // Update tenant with primary admin
    tenant.primaryAdminId = user._id;
    await tenant.save();

    // Issue JWT + create session
    const token = AuthService.issueToken(user._id.toString(), tenant._id.toString(), 'owner');
    const deviceInfo = {
      userAgent: req.headers['user-agent'] || 'unknown',
      ipAddress: req.ip || '0.0.0.0',
    };
    const sessionId = await SessionService.createSession(user._id.toString(), tenant._id.toString(), deviceInfo);

    res.status(201).json({
      message: 'Tenant and user created successfully',
      token,
      sessionId,
      tenant: {
        _id: tenant._id,
        name: tenant.name,
        plan: tenant.plan,
        trialEndAt: tenant.trialEndAt,
      },
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Signup failed', error: err.message });
  }
};

/**
 * LOGIN
 * Authenticates user and returns JWT + session
 */
exports.login = async (req, res) => {
  try {
    const { email, password, tenantId, totp } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    // Find user by email (and tenantId if provided for security)
    const query = { email };
    if (tenantId) {
      query.tenantId = tenantId;
    }

    const user = await User.findOne(query);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'User account is inactive or locked' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // If 2FA is enabled, verify TOTP token
    if (user.totpEnabled) {
      if (!totp) {
        return res.status(403).json({ message: '2FA required', requires2FA: true });
      }

      const isTOTPValid = AuthService.verifyTOTP(totp, user.totpSecret);
      if (!isTOTPValid) {
        return res.status(403).json({ message: 'Invalid 2FA code' });
      }
    }

    // Superadmin bypasses tenant checks
    if (user.role !== 'superadmin') {
      // Check tenant status
      const tenant = await Tenant.findById(user.tenantId);
      if (!tenant || tenant.status === 'suspended') {
        return res.status(403).json({ message: 'Tenant account suspended' });
      }

      if (tenant.plan === 'trial') {
        const trialExpiry = new Date(tenant.trialEndAt);
        if (new Date() > trialExpiry) {
          return res.status(403).json({ message: 'Trial expired. Please upgrade to a paid plan.' });
        }
      }
    }

    // Issue JWT + create session
    const tenantIdStr = user.tenantId ? user.tenantId.toString() : null;
    const token = AuthService.issueToken(user._id.toString(), tenantIdStr, user.role);
    const deviceInfo = {
      userAgent: req.headers['user-agent'] || 'unknown',
      ipAddress: req.ip || '0.0.0.0',
    };
    const sessionId = await SessionService.createSession(user._id.toString(), tenantIdStr, deviceInfo);

    // Update last login
    user.lastLoginAt = new Date();
    user.lastLoginIp = deviceInfo.ipAddress;
    await user.save();

    res.json({
      message: 'Login successful',
      token,
      sessionId,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};

/**
 * SETUP 2FA
 * Generate TOTP secret and QR code
 */
exports.setup2FA = async (req, res) => {
  try {
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    const user = await User.findOne({ _id: userId, tenantId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const tenant = await Tenant.findById(tenantId);
    const { secret, qrCode } = await AuthService.generateTOTPSecret(user.email, tenant.name);

    // Generate backup codes
    const backupCodes = AuthService.generateBackupCodes();
    const hashedCodes = backupCodes.map((code) => AuthService.hashBackupCode(code));

    // Store in user temporarily (not yet confirmed)
    user.totpSecret = secret;
    user.backupCodes = hashedCodes;
    await user.save();

    res.json({
      message: '2FA setup initiated',
      secret,
      qrCode,
      backupCodes, // Return plain codes once; user should save these
    });
  } catch (err) {
    console.error('2FA setup error:', err);
    res.status(500).json({ message: '2FA setup failed', error: err.message });
  }
};

/**
 * CONFIRM 2FA
 * User verifies TOTP code to enable 2FA
 */
exports.confirm2FA = async (req, res) => {
  try {
    const { totp } = req.body;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    const user = await User.findOne({ _id: userId, tenantId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.totpSecret) {
      return res.status(400).json({ message: 'No 2FA setup in progress' });
    }

    // Verify TOTP
    const isTOTPValid = AuthService.verifyTOTP(totp, user.totpSecret);
    if (!isTOTPValid) {
      return res.status(403).json({ message: 'Invalid TOTP code' });
    }

    // Enable 2FA
    user.totpEnabled = true;
    await user.save();

    res.json({ message: '2FA enabled successfully' });
  } catch (err) {
    console.error('2FA confirmation error:', err);
    res.status(500).json({ message: '2FA confirmation failed', error: err.message });
  }
};

/**
 * DISABLE 2FA
 */
exports.disable2FA = async (req, res) => {
  try {
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    const user = await User.findOne({ _id: userId, tenantId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.totpEnabled = false;
    user.totpSecret = undefined;
    user.backupCodes = [];
    await user.save();

    res.json({ message: '2FA disabled' });
  } catch (err) {
    console.error('2FA disable error:', err);
    res.status(500).json({ message: 'Disable 2FA failed', error: err.message });
  }
};

/**
 * LIST SESSIONS
 * User's active sessions across devices
 */
exports.listSessions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    const sessions = await SessionService.getUserSessions(userId, tenantId);
    res.json({ sessions });
  } catch (err) {
    console.error('List sessions error:', err);
    res.status(500).json({ message: 'Failed to list sessions', error: err.message });
  }
};

/**
 * REVOKE SESSION
 * Log out a specific session
 */
exports.revokeSession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    if (!sessionId) {
      return res.status(400).json({ message: 'sessionId required' });
    }

    await SessionService.revokeSession(sessionId, userId, tenantId);
    res.json({ message: 'Session revoked' });
  } catch (err) {
    console.error('Revoke session error:', err);
    res.status(500).json({ message: 'Failed to revoke session', error: err.message });
  }
};

/**
 * LOGOUT (revoke all sessions)
 */
exports.logout = async (req, res) => {
  try {
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    const sessions = await SessionService.getUserSessions(userId, tenantId);
    for (const session of sessions) {
      await SessionService.revokeSession(session.sessionId, userId, tenantId);
    }

    res.json({ message: 'Logged out from all sessions' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: 'Logout failed', error: err.message });
  }
};

