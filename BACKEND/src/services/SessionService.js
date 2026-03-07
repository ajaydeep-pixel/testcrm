/**
 * Session Service
 * Manages user sessions with Redis backend.
 * Sessions store user context, device info, and permissions.
 */

const redis = require('redis');
const { v4: uuidv4 } = require('uuid');

// Create Redis client (connect to Redis at process.env.REDIS_URL or localhost:6379)
const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

client.on('error', (err) => console.error('Redis Client Error', err));
client.connect();

const SESSION_PREFIX = 'session:';
const SESSION_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Create a new session
 */
exports.createSession = async (userId, tenantId, deviceInfo = {}) => {
  try {
    const sessionId = uuidv4();
    const sessionData = {
      userId,
      tenantId,
      deviceId: deviceInfo.deviceId || 'unknown',
      userAgent: deviceInfo.userAgent || '',
      ipAddress: deviceInfo.ipAddress || '',
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };

    await client.setEx(
      `${SESSION_PREFIX}${sessionId}`,
      SESSION_EXPIRY,
      JSON.stringify(sessionData)
    );

    // Also add to user's session list for quick lookups
    await client.sAdd(`user_sessions:${userId}:${tenantId}`, sessionId);

    return sessionId;
  } catch (err) {
    console.error('Error creating session:', err);
    throw err;
  }
};

/**
 * Get session data
 */
exports.getSession = async (sessionId) => {
  try {
    const data = await client.get(`${SESSION_PREFIX}${sessionId}`);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('Error retrieving session:', err);
    return null;
  }
};

/**
 * Revoke (delete) a session
 */
exports.revokeSession = async (sessionId, userId, tenantId) => {
  try {
    await client.del(`${SESSION_PREFIX}${sessionId}`);
    await client.sRem(`user_sessions:${userId}:${tenantId}`, sessionId);
  } catch (err) {
    console.error('Error revoking session:', err);
  }
};

/**
 * Get all sessions for a user
 */
exports.getUserSessions = async (userId, tenantId) => {
  try {
    const sessionIds = await client.sMembers(`user_sessions:${userId}:${tenantId}`);
    const sessions = [];

    for (const sessionId of sessionIds) {
      const session = await exports.getSession(sessionId);
      if (session) {
        sessions.push({ sessionId, ...session });
      }
    }

    return sessions;
  } catch (err) {
    console.error('Error listing user sessions:', err);
    return [];
  }
};

/**
 * Verify session is still active
 */
exports.verifySession = async (sessionId) => {
  try {
    const session = await exports.getSession(sessionId);
    return session !== null;
  } catch (err) {
    return false;
  }
};

/**
 * Update session activity (touch)
 */
exports.updateSessionActivity = async (sessionId) => {
  try {
    const session = await exports.getSession(sessionId);
    if (session) {
      session.lastActivityAt = new Date().toISOString();
      await client.setEx(
        `${SESSION_PREFIX}${sessionId}`,
        SESSION_EXPIRY,
        JSON.stringify(session)
      );
    }
  } catch (err) {
    console.error('Error updating session activity:', err);
  }
};

module.exports = exports;
