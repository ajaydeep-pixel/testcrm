/**
 * Activity Logger Service
 * Records all user actions for audit trails, compliance, and troubleshooting
 */

const AuditLog = require('../models/AuditLog');

class ActivityLogger {
  /**
   * Log an action
   * @param {Object} context - { tenantId, userId, userEmail, userName, action, resource, resourceId, resourceName, description, ipAddress, userAgent, deviceId, branchId }
   * @param {Object} changes - { before, after } for update operations
   * @param {String} status - 'success' or 'failure'
   * @param {String} errorMessage - error details if failed
   */
  static async log(context, changes = null, status = 'success', errorMessage = null) {
    try {
      const log = new AuditLog({
        tenantId: context.tenantId,
        userId: context.userId,
        userEmail: context.userEmail,
        userName: context.userName,
        action: context.action,
        resource: context.resource,
        resourceId: context.resourceId,
        resourceName: context.resourceName,
        description: context.description,
        changes: changes ? { before: changes.before, after: changes.after } : undefined,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        deviceId: context.deviceId,
        branchId: context.branchId,
        status,
        errorMessage,
        timestamp: new Date(),
      });

      await log.save();
      return log;
    } catch (err) {
      console.error('Error logging activity:', err);
      // Don't throw - logging should not break the main flow
    }
  }

  /**
   * Get audit logs for a tenant
   */
  static async getLogs(tenantId, filters = {}) {
    try {
      const query = { tenantId };

      if (filters.userId) query.userId = filters.userId;
      if (filters.resource) query.resource = filters.resource;
      if (filters.action) query.action = filters.action;
      if (filters.status) query.status = filters.status;

      // Date range
      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
        if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate);
      }

      const limit = filters.limit || 100;
      const page = filters.page || 1;
      const skip = (page - 1) * limit;

      const logs = await AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit);

      const total = await AuditLog.countDocuments(query);

      return {
        logs,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      throw err;
    }
  }

  /**
   * Get user activity timeline
   */
  static async getUserActivity(tenantId, userId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const logs = await AuditLog.find({
        tenantId,
        userId,
        timestamp: { $gte: startDate },
      }).sort({ timestamp: -1 });

      return logs;
    } catch (err) {
      console.error('Error fetching user activity:', err);
      throw err;
    }
  }

  /**
   * Get resource change history
   */
  static async getResourceHistory(tenantId, resourceId) {
    try {
      const logs = await AuditLog.find({
        tenantId,
        resourceId,
      }).sort({ timestamp: -1 });

      return logs;
    } catch (err) {
      console.error('Error fetching resource history:', err);
      throw err;
    }
  }

  /**
   * Export audit logs (for compliance)
   */
  static async exportLogs(tenantId, format = 'json', filters = {}) {
    try {
      const query = { tenantId };

      if (filters.resource) query.resource = filters.resource;
      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
        if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate);
      }

      const logs = await AuditLog.find(query).sort({ timestamp: -1 }).lean();

      if (format === 'csv') {
        return this.convertToCSV(logs);
      }

      return logs;
    } catch (err) {
      console.error('Error exporting audit logs:', err);
      throw err;
    }
  }

  /**
   * Convert logs to CSV format
   */
  static convertToCSV(logs) {
    const headers = ['timestamp', 'user', 'email', 'action', 'resource', 'resourceId', 'status', 'ipAddress'];
    const rows = logs.map((log) => [
      log.timestamp?.toISOString() || '',
      log.userName || '',
      log.userEmail || '',
      log.action || '',
      log.resource || '',
      log.resourceId || '',
      log.status || '',
      log.ipAddress || '',
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

    return csv;
  }
}

module.exports = ActivityLogger;
