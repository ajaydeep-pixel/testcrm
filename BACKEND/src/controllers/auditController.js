/**
 * Audit Log Controller
 * Provides read-only access to audit logs for compliance and troubleshooting
 */

const ActivityLogger = require('../services/ActivityLogger');

/**
 * GET /api/audit/logs
 * Get audit logs for tenant
 * Query: { resource?, action?, status?, startDate?, endDate?, limit?, page? }
 */
exports.getLogs = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { resource, action, status, startDate, endDate, limit, page } = req.query;

    const filters = { resource, action, status, startDate, endDate, limit: parseInt(limit) || 100, page: parseInt(page) || 1 };

    const result = await ActivityLogger.getLogs(tenantId, filters);
    res.json(result);
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ message: 'Failed to fetch audit logs', error: err.message });
  }
};

/**
 * GET /api/audit/user/:userId
 * Get activity for a specific user
 * Query: { days? }
 */
exports.getUserActivity = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { userId } = req.params;
    const { days = 30 } = req.query;

    const logs = await ActivityLogger.getUserActivity(tenantId, userId, parseInt(days));
    res.json({ userId, days, logs });
  } catch (err) {
    console.error('Error fetching user activity:', err);
    res.status(500).json({ message: 'Failed to fetch user activity', error: err.message });
  }
};

/**
 * GET /api/audit/resource/:resourceId
 * Get change history for a specific resource
 */
exports.getResourceHistory = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { resourceId } = req.params;

    const logs = await ActivityLogger.getResourceHistory(tenantId, resourceId);
    res.json({ resourceId, logs });
  } catch (err) {
    console.error('Error fetching resource history:', err);
    res.status(500).json({ message: 'Failed to fetch resource history', error: err.message });
  }
};

/**
 * GET /api/audit/export
 * Export audit logs (JSON or CSV)
 * Query: { format: 'json' | 'csv', resource?, startDate?, endDate? }
 */
exports.exportLogs = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { format = 'json', resource, startDate, endDate } = req.query;

    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({ message: 'Invalid format. Use json or csv' });
    }

    const filters = { resource, startDate, endDate };
    const data = await ActivityLogger.exportLogs(tenantId, format, filters);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=audit_logs.csv');
      res.send(data);
    } else {
      res.json({ logs: data });
    }
  } catch (err) {
    console.error('Error exporting audit logs:', err);
    res.status(500).json({ message: 'Failed to export audit logs', error: err.message });
  }
};

/**
 * GET /api/audit/summary
 * Get summary statistics
 */
exports.getSummary = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { startDate, endDate } = req.query;

    const filters = { startDate, endDate };
    const result = await ActivityLogger.getLogs(tenantId, { ...filters, limit: 10000 });

    const logs = result.logs;

    // Calculate stats
    const summary = {
      totalActions: logs.length,
      successCount: logs.filter((l) => l.status === 'success').length,
      failureCount: logs.filter((l) => l.status === 'failure').length,
      actionBreakdown: {},
      resourceBreakdown: {},
      topUsers: {},
    };

    logs.forEach((log) => {
      summary.actionBreakdown[log.action] = (summary.actionBreakdown[log.action] || 0) + 1;
      summary.resourceBreakdown[log.resource] = (summary.resourceBreakdown[log.resource] || 0) + 1;
      const userKey = log.userEmail || log.userId;
      summary.topUsers[userKey] = (summary.topUsers[userKey] || 0) + 1;
    });

    res.json(summary);
  } catch (err) {
    console.error('Error getting audit summary:', err);
    res.status(500).json({ message: 'Failed to get audit summary', error: err.message });
  }
};
