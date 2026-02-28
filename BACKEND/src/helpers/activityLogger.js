const ActivityLog = require('../models/ActivityLog');

/**
 * Log an activity to the database
 * @param {string} userId - ID of the user performing the action
 * @param {string} action - Action name (e.g., 'CREATE_PRODUCT', 'DELETE_SALE')
 * @param {string} details - Additional information about the action
 */
exports.logActivity = async (userId, action, details) => {
  try {
    const log = new ActivityLog({
      user: userId,
      action,
      details
    });
    await log.save();
  } catch (err) {
    console.error('Failed to save activity log:', err);
  }
};
