/**
 * Auth Service
 * Handles JWT issuance, TOTP generation/verification, and backup codes.
 */

const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

/**
 * Issue JWT token with tenantId and userId
 */
exports.issueToken = (userId, tenantId, role = 'staff', expiresIn = '7d') => {
  const token = jwt.sign(
    {
      userId,
      tenantId,
      role,
      iat: Math.floor(Date.now() / 1000),
    },
    process.env.JWT_SECRET,
    { expiresIn }
  );
  return token;
};

/**
 * Verify JWT token
 */
exports.verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
};

/**
 * Generate TOTP secret and QR code for user
 */
exports.generateTOTPSecret = async (userEmail, tenantName) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `AICODING (${tenantName}) <${userEmail}>`,
      issuer: 'AICODING SaaS',
      length: 32,
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode,
      otpauthUrl: secret.otpauth_url,
    };
  } catch (err) {
    console.error('Error generating TOTP secret:', err);
    throw err;
  }
};

/**
 * Verify TOTP token
 */
exports.verifyTOTP = (token, secret) => {
  try {
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time windows (30s each) for clock drift
    });
    return verified;
  } catch (err) {
    console.error('Error verifying TOTP:', err);
    return false;
  }
};

/**
 * Generate backup codes (10 codes, 8 alphanumeric each)
 */
exports.generateBackupCodes = (count = 10) => {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
};

/**
 * Hash backup code for storage
 */
exports.hashBackupCode = (code) => {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(code).digest('hex');
};

/**
 * Verify backup code
 */
exports.verifyBackupCode = (plainCode, hashedCode) => {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(plainCode).digest('hex');
  return hash === hashedCode;
};

/**
 * Decode token for debugging (without verification)
 */
exports.decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (err) {
    return null;
  }
};

module.exports = exports;
