# Audit Logging & Compliance Flow

## 📋 Overview

This document explains the **immutable audit logging system** that provides complete traceability of all user actions, compliance evidence, and forensic analysis capabilities.

---

## 🎯 Why Audit Logs?

### **Business Requirements**

1. **Compliance:** GDPR, HIPAA, PCI-DSS require audit trails for data access
2. **Security:** Detect insider threats, investigate breaches
3. **Forensics:** "Who changed the product price and when?"
4. **Disputes:** Resolve customer billing disputes ("was the discount applied?")
5. **Operational:** Track system usage, adoption metrics, support queries

---

## 📊 Audit Log Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Immutable** | No UPDATE or DELETE allowed (only INSERT) |
| **Rich context** | User, action, resource, before/after snapshots |
| **Tamper-evident** | Append-only; if attacker gets DB access can't modify |
| **Retention policy** | TTL index auto-delete after 90 days |
| **Indexed** | Fast queries by tenant, user, resource, date |
| **Exported** | JSON/CSV export for auditors |

---

## 🏗️ Data Model

**Model:** `AuditLog` (`BACKEND/src/models/AuditLog.js`)

```javascript
const auditLogSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // What happened
  action: {
    type: String,
    enum: [
      // Auth
      'SIGNUP', 'LOGIN', 'LOGOUT', '2FA_ENABLE', '2FA_DISABLE', 'SESSION_REVOKE',
      // Product
      'CREATE_PRODUCT', 'UPDATE_PRODUCT', 'DELETE_PRODUCT',
      // Sale
      'CREATE_SALE', 'UPDATE_SALE', 'DELETE_SALE',
      // Inventory
      'ADJUST_STOCK', 'TRANSFER_STOCK',
      // Settings
      'UPDATE_BUSINESS_INFO', 'UPDATE_BILLING_INFO',
      // Billing
      'SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION_CANCELED', 'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED',
      // User management
      'CREATE_USER', 'UPDATE_USER', 'DELETE_USER',
      // System
      'LOGIN_FAILED', 'AUTHORIZATION_FAILED',
    ],
    required: true,
    index: true,
  },
  resource: {
    type: String,
    required: true,
    index: true,
  },  // 'Product', 'Sale', 'User', 'Tenant', etc.
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },

  // Change tracking (full document snapshots)
  before: mongoose.Schema.Types.Mixed,  // Full doc before update
  after: mongoose.Schema.Types.Mixed,   // Full doc after update/create
  changes: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
  }],  // Optional: computed diff for quick review

  // Outcome
  status: {
    type: String,
    enum: ['success', 'failure'],
    default: 'success',
    index: true,
  },
  errorMessage: String,  // If status=failure

  // Request context
  ipAddress: String,
  userAgent: String,
  requestId: String,  // For correlating across logs

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: { expires: 7776000 },  // TTL: 90 days (90 * 24 * 60 * 60)
    expires: 7776000,
  },
}, { timestamps: true });

// Compound indexes for common queries
auditLogSchema.index({ tenantId: 1, createdAt: -1 });  // Latest logs for tenant
auditLogSchema.index({ userId: 1, createdAt: -1 });    // User's activity timeline
auditLogSchema.index({ resource: 1, resourceId: 1, createdAt: -1 });  // Resource history
auditLogSchema.index({ action: 1, createdAt: -1 });
```

---

## 🔄 Logging Flow

### **Every Mutation is Logged**

```mermaid
graph TD
    A[Controller receives request] --> B[Perform DB operation]
    B --> C[success?]
    C -->|Yes| D[Capture 'after' document]
    C -->|No| E[Capture error message]
    D --> F[Call ActivityLogger.log()]
    E --> F
    F --> G[Insert AuditLog document]
    G --> H[Return response to user]
    E --> H
```

---

### **Example: Product Update**

**Controller (`productController.js:update`)**

```javascript
exports.update = async (req, res) => {
  const tenantId = req.tenantId;
  const productId = req.params.id;
  const updates = req.body;

  // 1. Load existing product (for before snapshot)
  const existing = await Product.findOne({
    _id: productId,
    $or: [{ tenantId }, { tenantId: null }]
  });

  if (!existing) {
    return res.status(404).json({ message: 'Product not found' });
  }

  // 2. Apply updates
  const product = await Product.findOneAndUpdate(
    { _id: productId },
    updates,
    { new: true }
  ).populate('brandId categoryId');

  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  // 3. Log activity
  await ActivityLogger.log(
    req.user.userId,              // Who
    'UPDATE_PRODUCT',             // Action
    'Product',                    // Resource type
    product._id,                  // Resource ID
    existing.toObject(),          // Before (full doc)
    product.toObject()            // After (full doc)
  );

  // 4. Respond
  res.json(normalizeProduct(product));
};
```

---

### **ActivityLogger Helper**

**File:** `BACKEND/src/helpers/activityLogger.js`

```javascript
const AuditLog = require('../models/AuditLog');

/**
 * Log an activity to AuditLog
 * @param {ObjectId} userId - Who performed the action
 * @param {String} action - Action type (from enum)
 * @param {String} resource - Resource type (Product, Sale, etc.)
 * @param {ObjectId} resourceId - ID of affected resource
 * @param {Object} before - Document before change (empty for create)
 * @param {Object} after - Document after change (empty for delete)
 * @param {Object} extra - Additional context (optional)
 */
exports.log = async (userId, action, resource, resourceId, before, after, extra = {}) => {
  try {
    // Derive tenantId from resource or caller context
    const tenantId = deriveTenantId(before, after, extra);

    // Compute diff (optional - for quick viewing)
    const changes = computeDiff(before, after);

    const audit = new AuditLog({
      tenantId,
      userId,
      action,
      resource,
      resourceId,
      before: before || null,
      after: after || null,
      changes,
      status: 'success',
      ipAddress: extra.ipAddress,
      userAgent: extra.userAgent,
      requestId: extra.requestId,
    });

    await audit.save();

    // Emit event for real-time monitoring (future)
    // await emitAuditEvent(audit);

    return audit;
  } catch (err) {
    console.error('ActivityLogger error:', err);
    // Never throw - logging should never break main flow
  }
};

function deriveTenantId(before, after, extra) {
  // Try to extract tenantId from 'after' (if resource has tenantId field)
  if (after?.tenantId) return after.tenantId;
  if (before?.tenantId) return before.tenantId;
  // Fallback to extra.tenantId if provided
  return extra.tenantId;
}

function computeDiff(before, after) {
  if (!before || !after) return [];
  const changes = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    if (!_.isEqual(before[key], after[key])) {
      changes.push({
        field: key,
        oldValue: before[key],
        newValue: after[key],
      });
    }
  }
  return changes;
};
```

---

## 🧐 Reading Audit Logs

### **API Endpoints**

**List logs (paginated, filterable):**
```
GET /api/audit/logs?page=1&limit=50&action=CREATE_PRODUCT&resource=Product&startDate=2024-03-01&endDate=2024-03-15
```

**Response:**
```json
{
  "logs": [
    {
      "_id": "65f4a3d9e4b0987654321ghi",
      "tenantId": "65f4a3b8e4b0123456789xyz",
      "userId": "65f4a3b8e4b0123456789abc",
      "action": "UPDATE_PRODUCT",
      "resource": "Product",
      "resourceId": "65f4c5d2e4b0987654321def",
      "before": {
        "name": "Brake Pad Set",
        "price": 39.99,
        "stock": 80
      },
      "after": {
        "name": "Brake Pad Set",
        "price": 49.99,
        "stock": 80
      },
      "changes": [
        { "field": "price", "oldValue": 39.99, "newValue": 49.99 }
      ],
      "status": "success",
      "ipAddress": "203.0.113.42",
      "createdAt": "2024-03-15T10:30:00Z"
    }
  ],
  "page": 1,
  "limit": 50,
  "total": 1234,
  "totalPages": 25
}
```

---

### **Resource History**

**Get all changes to a specific product:**
```
GET /api/audit/resource-history/Product/65f4c5d2e4b0987654321def
```

**Response:** Ordered list of CREATE → UPDATE → UPDATE → DELETE

---

### **User Activity Timeline**

```
GET /api/audit/user-activity/65f4a3b8e4b0123456789abc
```

**Response:** All actions performed by that user across all resources.

---

### **Export**

```
GET /api/audit/export?format=json  # or ?format=csv
```

**Returns:** Full audit log stream (tenant-scoped, user must have VIEW_AUDIT permission)

---

## 📊 Common Queries

### **Query 1: Who changed Product X price?**

```javascript
db.auditlogs.find({
  resource: 'Product',
  resourceId: ObjectId('65f4c5d2e4b0987654321def'),
  'changes.field': 'price'
}).sort({ createdAt: -1 }).pretty();
```

**Result:**
```
{
  "userId": "65f4a3b8e4b0123456789abc",
  "action": "UPDATE_PRODUCT",
  "changes": [{ "field": "price", "oldValue": 39.99, "newValue": 49.99 }],
  "createdAt": "2024-03-15T10:30:00Z"
}
```

---

### **Query 2: All failed login attempts (detect brute force)**

```javascript
db.auditlogs.find({
  action: 'LOGIN_FAILED',
  createdAt: { $gte: ISODate('2024-03-15T00:00:00Z') }
}).count();  // 47 attempts
```

**Alert if >20 failed logins/hour from same IP.**

---

### **Query 3: What did user Y do last week?**

```javascript
db.auditlogs.find({
  userId: ObjectId('65f4a3b8e4b0123456789abc'),
  createdAt: { $gte: new Date(Date.now() - 7*24*60*60*1000) }
}).sort({ createdAt: -1 });
```

**Support use case:** "Customer says they didn't delete that product, show me what happened."

---

### **Query 4: When was tenant Z created?**

```javascript
db.auditlogs.find({
  resource: 'Tenant',
  action: 'SIGNUP'
}).sort({ createdAt: -1 }).limit(1);
```

---

## 🔐 Security & Privacy

### **Immutable by Design**

**No UPDATE or DELETE operations on AuditLog collection.**

```javascript
// In controllers: NEVER do this!
await AuditLog.findByIdAndUpdate(id, { errorMessage: 'fixed' });  // ❌ FORBIDDEN

// If you need to correct an error, INSERT a new log with action 'AUDIT_CORRECTION'
```

**Even DBAs cannot modify** (unless they have raw MongoDB access and disable journaling).

---

### **TTL (Time-To-Live)**

**MongoDB auto-deletes after 90 days:**

```javascript
auditLogSchema.set('timestamps', true);
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });  // 90 days
```

**Why 90 days?**
- Compliance requirements (GDPR, SOC2) typically 3-12 months
- Storage cost vs value tradeoff (logs get huge)
- Sufficient for most investigations

**Extendable:** Change TTL to 365 days if needed.

---

### **PII Redaction (Future)**

**Problem:** Audit logs contain full document snapshots, including PII (email, phone, address).

**For GDPR "right to be forgotten":**
- Cannot actually delete audit logs (immutable)
- Can **redact** PII fields from `before`/`after` fields in background job
  - Replace with `"[REDACTED]"`
  - Keep metadata (who, when, what action)

**Implementation:**
```javascript
// Monthly job: find logs with PII, redact specific fields
const logs = await AuditLog.find({
  'after.email': { $exists: true },
  createdAt: { $lt: oneMonthAgo }  // Only old logs (user had chance to delete account)
});

for (const log of logs) {
  if (log.after) {
    log.after.email = '[REDACTED]';
    log.after.phone = '[REDACTED]';
    // ... other PII fields
  }
  await log.save();  // This IS an update - but for redaction only, and done by trusted admin script
}
```

**Warning:** This breaks immutability. Better: store separate redaction log.

---

## 🧪 Testing Audit Logs

### **Test 1: Verify log created on product create**

```bash
# Count before
COUNT_BEFORE=$(mongo aicoding --eval "db.auditlogs.count({resource:'Product'})")

# Create product
curl -X POST /api/products -H "Authorization: Bearer $TOKEN" -d '{"name":"Test","brandId":"...","categoryId":"...","price":10}'

# Count after
COUNT_AFTER=$(mongo aicoding --eval "db.auditlogs.count({resource:'Product'})")

# Should increment by 1
echo $((COUNT_AFTER - COUNT_BEFORE))  # Should be 1
```

---

### **Test 2: Verify before/after snapshots**

```javascript
// Before: Price = $10
// API call: Update price to $15
// After: Price = $15

const log = await AuditLog.findOne({ action: 'UPDATE_PRODUCT' }).sort({ createdAt: -1 });

console.log(log.before.price);  // 10
console.log(log.after.price);   // 15
console.log(log.changes[0]);    // { field: 'price', oldValue: 10, newValue: 15 }
```

---

### **Test 3: Failed action still logged**

```javascript
try {
  // Simulate failing controller
  throw new Error('Database connection lost');
} catch (err) {
  await ActivityLogger.log(
    userId,
    'UPDATE_PRODUCT',
    'Product',
    productId,
    {},
    {},
    { errorMessage: err.message, status: 'failure' }
  );
}

const log = await AuditLog.findOne({ action: 'UPDATE_PRODUCT' }).sort({ createdAt: -1 });
console.log(log.status);  // 'failure'
console.log(log.errorMessage);  // 'Database connection lost'
```

---

## 📈 Volume Estimation

**For 100 tenants:**

| Logs per day per tenant | Total daily | Total 90 days |
|------------------------|-------------|---------------|
| 100 (light) | 10,000 | 900,000 |
| 500 (medium) | 50,000 | 4.5M |
| 1,000 (heavy) | 100,000 | 9M |

**Storage size:**
- Avg document size: 1KB (including before/after snapshots)
- 9M logs × 1KB = ~9 GB
- Indexes add ~50% overhead = ~13.5 GB

**MongoDB Atlas:** $15-30/month for M10 cluster (readily handles this)

---

## 🔍 Searching Audit Logs (Frontend UI)

**Settings → Security → Activity Log** page:

**Features:**
- Date range picker (default: last 7 days)
- Resource filter dropdown (Product, Sale, User, etc.)
- Action filter (Create, Update, Delete)
- User search (by name/email)
- Table with columns: Date, User, Action, Resource, Details
- Click row → modal with full before/after JSON
- Export button (CSV/JSON for auditors)

**Example query:**
```
GET /api/audit/logs?
  page=1&limit=25&
  resource=Product&
  startDate=2024-03-01&
  endDate=2024-03-15
```

---

## 🐛 Common Issues

### **Issue: Audit logs not appearing**

**Check:**
1. Is `ActivityLogger.log()` called in controller?
2. Is there a try-catch swallowing errors? (logger should never throw)
3. Check MongoDB: `db.auditlogs.count()` - is it increasing?
4. Check logs: `ActivityLogger error: ...`

---

### **Issue: `tenantId` missing in log**

**Cause:** `deriveTenantId()` couldn't find tenantId from before/after/extra

**Fix:** Controller should pass `tenantId` in `extra` param:
```javascript
await ActivityLogger.log(
  userId,
  action,
  resource,
  resourceId,
  before,
  after,
  { tenantId: req.tenantId }  // Add this
);
```

---

### **Issue: Logs growing too large**

**Symptom:** Collection size >50GB, slow queries

**Mitigation:**
1. Reduce TTL (70 days instead of 90)
2. Archive old logs to S3 via cron job
3. Add partial index: `{ tenantId: 1, createdAt: -1 }` only (not full text)
4. Don't store full `before`/`after` for low-value resources (only store `changes` diff)

---

## 📊 Monitoring Alerting

### **Alerts to Configure**

1. **AuditLog insert failures** - >5 errors/minute → issue
2. **Collection size growth** - >10GB/week → storage planning
3. **Query latency** - p99 > 500ms → missing index
4. **Missing logs** - If expected log not found within 5min of action → investigate

---

## 🚀 Future Enhancements

1. **Real-time stream**
   - WebSocket feed of audit events (superadmin dashboard)
   - Kafka topic for external SIEM integration

2. **Advanced search**
   - Elasticsearch integration for full-text search across logs
   - Fuzzy matching on user names/actions

3. **Compliance reports**
   - Automatic SOC2 report generation
   - GDPR data access log (who viewed PII)
   - PCI DSS report (payment-related actions)

4. **Anomaly detection**
   - Machine learning: detect unusual activity spikes
   - Alert: "10x normal DELETE operations in last hour"

5. **Log signing (advanced)**
   - Hash chain each log with previous log's hash
   - Tamper evidence: changing any log breaks chain

---

## 📝 Code References

| Component | File | Purpose |
|-----------|------|---------|
| Model | `BACKEND/src/models/AuditLog.js` | Schema definition |
| Helper | `BACKEND/src/helpers/activityLogger.js` | Logging utility |
| Controller | `BACKEND/src/controllers/auditController.js` | GET endpoints for reading |
| Routes | `BACKEND/src/routes/auditRoutes.js` | /api/audit/* |
| Middleware | N/A | Called from controllers |

---

## 🔗 Related Documents

- [02-request-flow.md](02-request-flow.md) - Where logging fits in request lifecycle
- [04-authentication-flow.md](04-authentication-flow.md) - Auth events (LOGIN, 2FA)
- [05-authorization-flow.md](05-authorization-flow.md) - AUTHORIZATION_FAILED events
- [10-audit-flow.md](10-audit-flow.md) - This document

---

**Best Practice:** Log **everything** (defensively). Cost of storage is cheap; cost of not having a log when you need it is huge (legal, support, security incidents).

---

**Next:** [12-operations-workspace.md](12-operations-workspace.md) - Operational UI workspace
