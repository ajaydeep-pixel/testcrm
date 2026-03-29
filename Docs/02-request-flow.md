# Request Processing Flow

## 📋 Overview

This document details the complete request lifecycle through the BikeFlow backend API, from the moment an HTTP request arrives to the final response. Understanding this flow is critical for debugging, performance optimization, and extending the system.

---

## 🏃 Request Journey

```mermaid
graph LR
    A[HTTP Request<br/>e.g. POST /api/products] --> B[Global Middleware<br/>CORS, Body Parser]
    B --> C[IP Rate Limit<br/>rateLimitIP(100/hr)]
    C --> D{Path Matching}

    D -->|Public Route| E[Auth Routes<br/>/api/auth/*]
    D -->|Public Route| F[Branding/Plans<br/>/api/branding, /api/billing/plans]
    D -->|Superadmin| G[Admin Routes<br/>/api/admin/*]
    D -->|Protected| H[Full Middleware Stack]

    E --> I[Controller]
    F --> I
    G --> J[Controller + No Tenant]
    H --> K[verifyToken]
    K --> L[extractTenant]
    L --> M[verifyTenantAccess]
    M --> N[rateLimitTenant]
    N --> O[recordUsage]
    O --> P[checkUsageAndWarn]
    P --> Q[authorize?]
    Q --> R[Controller]
    R --> S[Services]
    S --> T[MongoDB/Redis]
    T --> U[Response]

    I --> U
    J --> U

    style C fill:#ffebee
    style K fill:#fff3e0
    style N fill:#e8f5e8
    style Q fill:#f3e5f5
```

---

## 📜 Global Middleware (Applied to All `/api/` Routes)

### **1. CORS** (`cors()`)
```javascript
// From app.js
app.use(cors());
```
**Purpose:** Allow cross-origin requests from frontend (localhost:3000)

**Default Behavior:** Allows all origins (development). In production, configure whitelist.

---

### **2. Body Parser** (`express.json()`, `express.urlencoded()`)
```javascript
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
```
**Purpose:** Parse JSON and URL-encoded request bodies

**Size Limit:** 5MB (prevents memory exhaustion attacks)

**Timing:** Applied BEFORE webhook routes (except Stripe needs raw body)

---

### **3. Static Files** (`/uploads`)
```javascript
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```
**Purpose:** Serve uploaded product images, invoice PDFs

**Access:** Publicly accessible (no auth)

---

## 🛡️ Security Middleware Stack

### **Layer 1: Global IP Rate Limit**
```javascript
app.use('/api/', rateLimitIP(100, 3600000)); // 100 requests per hour per IP
```

**File:** `BACKEND/src/middleware/rateLimitMiddleware.js`

**Implementation:**
```javascript
exports.rateLimitIP = (windowMs, max) => {
  return async (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const key = `rate_limit_ip:${ip}`;

    const current = await redis.incr(key);
    if (current === 1) {
      await redis.pexpire(key, windowMs);
    }

    const remaining = max - current;
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(remaining, 0));

    if (current > max) {
      return res.status(429).json({
        message: 'Too many requests from this IP',
        retryAfter: Math.ceil(await redis.ttl(key))
      });
    }

    next();
  };
};
```

**Redis Key Pattern:** `rate_limit_ip:{IP}`

**When Applied:** To all `/api/` routes (before authentication)

**Purpose:**
- Prevent brute force attacks on login/signup
- Throttle abusive IPs
- Protect against DoS (basic)

**Status Code:** `429 Too Many Requests`

**Response Headers:**
- `X-RateLimit-Limit: 100`
- `X-RateLimit-Remaining: 45`
- `Retry-After: 1200` (seconds until reset)

---

## 🚪 Route Classification

After IP rate limit, the router determines which handler to use based on path:

### **Route Groups**

| Group | Path Pattern | Middleware Stack | Auth Required? | Tenant Context |
|-------|--------------|------------------|---------------|----------------|
| **Public Auth** | `/api/auth/*` | IP rate limit only | Yes (except signup/login) | No (creates tenant) |
| **Public Info** | `/api/branding`, `/api/billing/plans` | IP rate limit | No | No |
| **Superadmin** | `/api/admin/*` | IP + verifyToken | Yes (role=superadmin) | No (cross-tenant) |
| **Protected** | `/api/billing`, `/api/products`, `/api/sales`, etc. | Full stack | Yes | Yes |

---

### **Group 1: Public Auth Routes** (`/api/auth/*`)

**Routes:** Signup, Login, 2FA setup/confirm/verify/disable, Logout, Sessions

**Middleware:** Only `rateLimitIP()`

**Why No Tenant Middleware?**
- `/auth/signup` CREATES the tenant
- `/auth/login` validates credentials and ISSUES JWT with tenantId
- Tenant context doesn't exist yet

**Controller Flow Example: Login (`authController.login`)**
```javascript
exports.login = async (req, res) => {
  const { email, password } = req.body;

  // 1. Find user (including passwordHash)
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // 2. Verify password
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // 3. Check 2FA if enabled
  if (user.totpEnabled) {
    // Return special response requiring TOTP
    return res.json({
      requires2FA: true,
      tempToken: generateTempToken(user._id)  // Short-lived (2min)
    });
  }

  // 4. Issue JWT
  const token = jwt.sign(
    { userId: user._id, tenantId: user.tenantId, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  // 5. Create session in Redis
  const sessionId = uuidv4();
  await redis.setex(
    `session:${sessionId}`,
    86400 * 30,  // 30 days
    JSON.stringify({
      userId: user._id,
      tenantId: user.tenantId,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    })
  );

  // 6. Update user.lastLoginAt, lastLoginIp, devices[]
  await User.findByIdAndUpdate(user._id, {
    lastLoginAt: new Date(),
    lastLoginIp: req.ip,
    devices: [...user.devices, { deviceId: sessionId, ... }]
  });

  // 7. Log to AuditLog
  await ActivityLogger.log(user._id, 'LOGIN', 'User', user._id, {}, {});

  // 8. Return response
  res.json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    sessionId
  });
};
```

---

### **Group 2: Public Info Routes** (`/api/branding`, `/api/billing/plans`)

**Purpose:** Publicly accessible data needed for checkout/landing page

**No Authentication** - useful for unauthenticated visitors

**Example: Get Plans**
```javascript
// billingController.js
exports.getPlans = async (req, res) => {
  const plans = await Plan.find({ isActive: true }).sort('sortOrder');
  res.json(plans);
};
```

---

### **Group 3: Superadmin Routes** (`/api/admin/*`)

**Middleware Stack:** `rateLimitIP()` → `verifyToken()`

**NOT:** `extractTenant()`, `verifyTenantAccess()`, etc.

**Why?** Superadmin can view/ manage ALL tenants (cross-tenant access)

**Authorization Check in Controller:**
```javascript
// adminController.js
exports.listTenants = async (req, res) => {
  // req.user.role === 'superadmin' already verified by middleware
  const tenants = await Tenant.find({}).sort({ createdAt: -1 });
  res.json(tenants);
};
```

**Access Control:** Only users with JWT containing `role: 'superadmin'` can reach these routes (checked in `verifyToken` middleware).

---

### **Group 4: Protected Routes (Full Stack)**

**All business operations:** Products, Sales, Inventory, Purchases, Suppliers, Customers, Brands, Categories, Billing, Settings, Audit, Usage

**Complete Middleware Chain:**

```javascript
const protectedStack = [
  verifyToken,      // 1. Validate JWT
  extractTenant,    // 2. Extract tenantId from JWT
  verifyTenantAccess, // 3. Load tenant + check status/trial
  rateLimitTenant(),  // 4. Enforce plan-based rate limit
  recordUsage,      // 5. Increment usage counters
  checkUsageAndWarn, // 6. Add warning headers if >90%
  // authorize(resource, action)  // Optional per-route
];
```

Applied to route:
```javascript
app.use('/api/products', protectedStack, require('./src/routes/productRoutes'));
```

---

## 🔍 Deep Dive: Full Stack Execution

Let's trace a realistic request through the full middleware stack:

**Example:** `POST /api/products` (Create product as Manager)

---

### **Step 0: Request Arrives**

```
POST /api/products HTTP/1.1
Host: api.bikeflow.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json
X-Forwarded-For: 203.0.113.42

{
  "name": "Brake Pad Set",
  "sku": "BP-001",
  "brandId": "65f4a3b8e4b0123456789abc",
  "categoryId": "65f4a3b8e4b0123456789def",
  "price": 49.99,
  "cost": 29.99,
  "stock": 100
}
```

---

### **Step 1: IP Rate Limit** (`rateLimitIP(100, 3600000)`)

**Redis Check:**
```
key: rate_limit_ip:203.0.113.42
current = INCR(key)
if current == 1: EXPIRE(key, 3600s)
```

**Assumptions:**
- IP has made 80 requests in past hour
- `current = 81`
- `remaining = 19`

**Headers Set:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 19
```

**Pass:** Continue to next middleware

**Fail (if current > 100):**
```json
{
  "message": "Too many requests from this IP",
  "retryAfter": 1200
}
```
Status: `429`

---

### **Step 2: JWT Validation** (`verifyToken`)

**Code:** `BACKEND/src/middleware/authMiddleware.js:4-25`

```javascript
exports.verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Superadmin bypass
    if (decoded.role === 'superadmin') {
      req.user = decoded;
      return next();
    }

    // Validate tenantId exists
    if (!decoded.tenantId || !decoded.userId) {
      return res.status(403).json({ message: 'Invalid token: missing tenantId or userId' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(401).json({ message: 'Invalid token' });
  }
};
```

**JWT Payload (decoded):**
```json
{
  "userId": "65f4a3b8e4b0123456789abc",
  "tenantId": "65f4a3b8e4b0123456789xyz",
  "role": "manager",
  "iat": 1711699200,
  "exp": 1711702800  // 15 minutes later
}
```

**Pass:** Set `req.user = decoded`, continue

**Fail:**
- `401` if no token, invalid signature, expired
- `403` if tenantId/userId missing

---

### **Step 3: Tenant Extraction** (`extractTenant`)

**Purpose:** Copy tenantId from `req.user` to `req.tenantId` (standard location)

```javascript
// BACKEND/src/middleware/tenantMiddleware.js:13-28
exports.extractTenant = (req, res, next) => {
  try {
    if (!req.user || !req.user.tenantId) {
      return res.status(403).json({
        message: 'Tenant ID not found in token. User not properly onboarded.'
      });
    }

    req.tenantId = req.user.tenantId;
    req.userId = req.user.userId || req.user.id;
    next();
  } catch (err) {
    res.status(500).json({ message: 'Error extracting tenant', error: err.message });
  }
};
```

**No database lookup yet** - just copying values

**Pass:** `req.tenantId` now set, `req.userId` set

---

### **Step 4: Tenant Access Validation** (`verifyTenantAccess`)

**Purpose:** Load Tenant document, check status, trial expiry, attach to req

**Code:** `BACKEND/src/middleware/tenantMiddleware.js:33-64`

```javascript
exports.verifyTenantAccess = async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.tenantId);

    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    // Check if tenant is suspended
    if (tenant.status === 'suspended') {
      return res.status(403).json({ message: 'Tenant account is suspended' });
    }

    // Load current subscription (TenantPlan)
    const tenantPlan = await getCurrentTenantPlan(tenant._id);
    const plan = await resolvePlanForTenantPlan(tenantPlan);

    // Check trial expiry
    if (tenantPlan && isTrialExpired(tenantPlan)) {
      return res.status(403).json({
        message: 'Trial period expired. Please upgrade to a paid plan.'
      });
    }

    // Attach to request
    req.tenant = tenant;
    req.tenantPlan = tenantPlan || null;
    req.planDetails = plan || null;
    req.planSlug = getPlanSlug(tenantPlan, plan) || 'trial';

    next();
  } catch (err) {
    res.status(500).json({ message: 'Error verifying tenant access', error: err.message });
  }
};
```

**Database Queries (2):**
1. `Tenant.findById(req.tenantId)`
2. `TenantPlan.findOne({ tenantId, status: { $in: ['active', 'trialing'] } })`

**Assumptions:**
- Tenant exists, status = 'active'
- Trial not expired (or on paid plan)

**Pass:** `req.tenant`, `req.tenantPlan`, `req.planDetails`, `req.planSlug` all set

**Fail:**
- `404` if tenant not found
- `403` if suspended or trial expired
- `500` on DB error

---

### **Step 5: Tenant Rate Limit** (`rateLimitTenant`)

**Purpose:** Enforce plan-based API limits

**Code:** `BACKEND/src/middleware/rateLimitMiddleware.js:44-99` (simplified)

```javascript
exports.rateLimitTenant = (windowMs = 3600000, getMaxRequests) => {
  return async (req, res, next) => {
    const tenantId = req.tenantId;
    const planSlug = req.planSlug;  // from verifyTenantAccess

    // Determine limit based on plan
    const maxRequests = getMaxRequests
      ? getMaxRequests(planSlug)
      : getPlanLimit(planSlug);  // trial=100, basic=1000, pro=10000, enterprise=Infinity

    if (maxRequests === Infinity) {
      return next();  // No limit for enterprise
    }

    const key = `rate_limit:${tenantId}`;

    const current = await redis.incr(key);
    if (current === 1) {
      await redis.pexpire(key, windowMs);
    }

    const remaining = maxRequests - current;
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(remaining, 0));

    if (current > maxRequests) {
      return res.status(429).json({
        message: 'API rate limit exceeded. Please upgrade your plan.',
        retryAfter: Math.ceil(await redis.ttl(key)),
        currentUsage: current,
        limit: maxRequests
      });
    }

    next();
  };
};
```

**Plan Limits (from RateLimiterService.js):**
```javascript
const PLAN_LIMITS = {
  trial: 100,      // 100 requests per hour
  basic: 1000,     // 1,000 per hour
  pro: 10000,      // 10,000 per hour
  enterprise: null // unlimited
};
```

**Redis Key:** `rate_limit:{tenantId}`

**Assumptions:**
- Manager on Pro plan: limit = 10,000/hr
- Already used 8,500 requests this hour
- `current = 8501`, `remaining = 1499`

**Headers Set:**
```
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 1499
```

**Pass:** Continue

**Fail:** `429` if exceeded (with upgrade hint)

---

### **Step 6: Usage Metering** (`recordUsage`)

**Purpose:** Track API usage against plan quotas

**Code:** `BACKEND/src/middleware/usageMeteringMiddleware.js:15-62`

```javascript
exports.recordUsage = async (req, res, next) => {
  const tenantId = req.tenantId;
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Increment API calls counter
  const apiCallsKey = `usage:${tenantId}:api_calls:${monthKey}`;
  await redis.incr(apiCallsKey);

  // Set expiry if not already set (expires at month end)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const secondsRemaining = daysInMonth * 86400 - (now.getDate() * 86400 + now.getHours() * 3600);
  await redis.expire(apiCallsKey, secondsRemaining);

  // Mark that we've metered this request (for warning header later)
  req.metered = true;

  next();
};
```

**Redis Keys Created:**
```
usage:{tenantId}:api_calls:2024-03
usage:{tenantId}:invoices:2024-03  (when invoice created)
usage:{tenantId}:storage:2024-03   (when file uploaded)
```

**Note:** Other metrics (invoices, users, storage) are incremented by specific controllers, not this middleware.

**Pass:** Continue (no response change)

---

### **Step 7: Usage Warning** (`checkUsageAndWarn`)

**Purpose:** Check if tenant is approaching plan limits, add warning headers

**Code:** `BACKEND/src/middleware/usageMeteringMiddleware.js:64-110`

```javascript
exports.checkUsageAndWarn = async (req, res, next) => {
  if (!req.metered || !req.tenantPlan) {
    return next();  // Skip if not metered or no plan
  }

  const usage = req.tenantPlan.usage || {};
  const limits = req.planDetails?.limits || {};

  // Calculate percentages
  const metrics = [
    { key: 'apiCalls', label: 'API Calls' },
    { key: 'invoiceCount', label: 'Invoices' },
    { key: 'activeUsers', label: 'Active Users' },
    { key: 'storageMB', label: 'Storage (MB)' },
  ];

  const warnings = [];

  metrics.forEach(({ key, label }) => {
    const current = usage[key] || 0;
    const limit = limits[key];
    if (limit && current / limit > 0.9) {
      warnings.push(`${label}: ${current}/${limit} (${Math.round(current/limit*100)}%)`);
    }
  });

  if (warnings.length > 0) {
    res.setHeader('X-Usage-Warning', `Plan limits approaching: ${warnings.join('; ')}`);
    res.setHeader('X-Usage-Warning-Url', `${process.env.FRONTEND_URL}/settings/billing`);
  }

  next();
};
```

**Response Headers (if >90% used):**
```
X-Usage-Warning: Plan limits approaching: API Calls: 950/1000 (95%); Storage (MB): 4500/5000 (90%)
X-Usage-Warning-Url: https://app.bikeflow.com/settings/billing
```

**Frontend can read these headers** and display upgrade banner on dashboard.

---

### **Step 8: Authorization** (`authorize(resource, action)`) - Optional

**Applied per-route** using route-specific middleware or controller-level check

**Example - Protect Product Create:**
```javascript
// productRoutes.js
router.post(
  '/',
  authorize('Product', 'CREATE'),  // RBAC check
  productController.create
);
```

**Code:** `BACKEND/src/middleware/permissionMiddleware.js`

```javascript
exports.authorize = (resource, action) => {
  return async (req, res, next) => {
    const userId = req.user.userId;
    const tenantId = req.tenantId;

    // Load user with permissions
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check permission
    const allowed = await PermissionService.checkPermission(
      user.role,
      resource,
      action,
      user.customPermissions
    );

    if (!allowed) {
      // Audit the failed attempt
      await ActivityLogger.log(
        userId,
        'AUTHORIZATION_FAILED',
        resource,
        null,
        { resource, action },
        {}
      );

      return res.status(403).json({
        message: `Insufficient permissions. Role '${user.role}' cannot ${action} ${resource}.`
      });
    }

    next();
  };
};
```

**RBAC Matrix** (from `PermissionService.js`):
```javascript
const PERMISSIONS = {
  owner: {
    Product: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
    Sale: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
    // ... all resources full access
  },
  manager: {
    Product: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
    Sale: ['CREATE', 'READ', 'UPDATE'],
    // ... mostly full access, no delete users
  },
  accountant: {
    Product: ['READ'],
    Sale: ['CREATE', 'READ', 'UPDATE'],
    Invoice: ['READ', 'CREATE'],
    // ... financial access only
  },
  staff: {
    Product: ['READ'],
    Sale: ['CREATE', 'READ'],
    // ... minimal read + create sales
  }
};
```

**Pass:** User has permission

**Fail:** `403 Forbidden` with message:
```json
{
  "message": "Insufficient permissions. Role 'staff' cannot CREATE Product."
}
```

---

### **Step 9: Controller Execution**

**File:** `BACKEND/src/controllers/productController.js`

**Method:** `create()`

```javascript
exports.create = async (req, res) => {
  try {
    const payload = { ...req.body };
    const tenantId = req.tenantId;  // From middleware
    const { brandId, categoryId } = payload;

    // Validation
    if (!brandId || !categoryId) {
      return res.status(400).json({ message: 'brandId and categoryId are required' });
    }

    // Validate brand belongs to tenant (or is global)
    const [brandDoc, categoryDoc] = await Promise.all([
      Brand.findOne({ _id: brandId, $or: [{ tenantId }, { tenantId: null }] }),
      Category.findOne({ _id: categoryId, $or: [{ tenantId }, { tenantId: null }] })
    ]);

    if (!brandDoc) return res.status(400).json({ message: 'Invalid brandId' });
    if (!categoryDoc) return res.status(400).json({ message: 'Invalid categoryId' });

    // Denormalize brand/category names
    payload.brand = brandDoc.name;
    payload.category = categoryDoc.name;
    payload.tenantId = tenantId;

    // Create product
    const product = new Product(payload);
    await product.save();

    // Audit log
    await logActivity(
      req.user.userId,
      'CREATE_PRODUCT',
      `Created product: ${product.name} (${product.barcode || 'No barcode'})`,
      {},  // before
      product  // after
    );

    // Respond with populated product
    const hydrated = await Product.findById(product._id)
      .populate([{ path: 'brandId' }, { path: 'categoryId' }]);

    res.status(201).json(normalizeProduct(hydrated));
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: 'Invalid data', error: err.message });
  }
};
```

**Key Points:**
- Uses `req.tenantId` from middleware (never trust `req.body.tenantId`)
- Validates foreign keys (brandId, categoryId) exist in tenant scope
- `normalizeProduct()` converts Mongoose doc to clean JSON (removes _id, adds brandName, etc.)
- Error handling catches validation errors, returns `400`

---

### **Step 10: Service Layer** (Optional)

**When Would Controller Call a Service?**

If logic is complex or reused across multiple controllers:

```javascript
// Example from billingController.js
exports.createCheckoutSession = async (req, res) => {
  const { planSlug } = req.body;
  const tenantId = req.tenantId;
  const userId = req.userId;

  // Delegate to BillingService (1600 lines of complex logic)
  const session = await BillingService.createCheckoutSession({
    tenantId,
    userId,
    planSlug,
    successUrl: `${process.env.FRONT_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${process.env.FRONT_URL}/checkout/cancel`
  });

  res.json({ sessionId: session.id, url: session.url });
};
```

**BillingService Responsibilities:**
- Load Plan from catalog
- Create Stripe customer if needed
- Create Stripe checkout session with line items
- Handle Razorpay order creation
- Webhook event processing
- Subscription state transitions
- Invoice generation (PDF)
- Error recovery (idempotency)

---

### **Step 11: Database Operations**

**Typical Query Pattern:**
```javascript
// All queries MUST include tenantId filter
const products = await Product.find({
  $or: [
    { tenantId },           // Tenant-specific
    { tenantId: null }     // Global shared
  ]
})
.populate('brandId categoryId')
.sort({ createdAt: -1 })
.skip((page - 1) * limit)
.limit(limit);
```

**Index Usage:**
```
Query: { $or: [{ tenantId: "..." }, { tenantId: null }], name: { $regex: "brake" } }
Index: { tenantId: 1, name: 1 }  or { tenantId: 1, createdAt: -1 }
```

**Explain Plan:** Always verify with `.explain('executionStats')` in dev

---

### **Step 12: Audit Logging**

**Every mutation (CREATE/UPDATE/DELETE) logs to AuditLog:**

```javascript
await ActivityLogger.log(
  userId,                 // Who
  'CREATE_PRODUCT',       // Action
  'Product',              // Resource type
  product._id,            // Resource ID
  {},                     // before (empty for create)
  product                 // after (full doc)
);
```

**AuditLog Document:**
```json
{
  "_id": "...",
  "tenantId": "65f4a3b8e4b0123456789xyz",
  "userId": "65f4a3b8e4b0123456789abc",
  "action": "CREATE_PRODUCT",
  "resource": "Product",
  "resourceId": "65f4c5d2e4b0987654321def",
  "before": {},
  "after": { "name": "Brake Pad Set", "sku": "BP-001", ... },
  "status": "success",
  "createdAt": "2024-03-15T10:30:00Z",
  "ipAddress": "203.0.113.42"
}
```

**TTL Index:** Auto-delete after 90 days

---

### **Step 13: Response**

**Success (201 Created):**
```json
{
  "id": "65f4c5d2e4b0987654321def",
  "name": "Brake Pad Set",
  "sku": "BP-001",
  "brand": "ACME",
  "brandId": "65f4a3b8e4b0123456789abc",
  "category": "Brakes",
  "categoryId": "65f4a3b8e4b0123456789def",
  "price": 49.99,
  "cost": 29.99,
  "stock": 100,
  "createdAt": "2024-03-15T10:30:00Z"
}
```

**Response Headers:**
```
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 1499
X-Usage-Warning: Plan limits approaching: API Calls: 950/1000 (95%)  (if >90%)
Content-Type: application/json
```

**Error (400 Bad Request):**
```json
{
  "message": "Invalid data",
  "error": "brandId is required"
}
```

---

## 🔄 Complete Flow Diagram (Mermaid Sequence)

```mermaid
sequenceDiagram
    actor Client as Frontend (React)
    participant LB as NGINX/Load Balancer
    participant API as Express App
    participant MW1 as rateLimitIP()
    participant MW2 as verifyToken()
    participant MW3 as extractTenant()
    participant MW4 as verifyTenantAccess()
    participant MW5 as rateLimitTenant()
    participant MW6 as recordUsage()
    participant MW7a as checkUsageAndWarn()
    participant MW7b as authorize()
    participant Ctrl as productController.create()
    participant Svc as BillingService (if used)
    participant DB as MongoDB
    participant Redis as Redis
    participant Audit as AuditLog

    Client->>LB: POST /api/products (with JWT)
    LB->>API: Forward request
    API->>MW1: Check IP rate limit (Redis)
    MW1-->>API: Pass/429
    API->>MW2: verifyToken()
    MW2->>MW2: jwt.verify()
    MW2-->>API: req.user set / 401
    API->>MW3: extractTenant()
    MW3-->>API: req.tenantId set
    API->>MW4: verifyTenantAccess()
    MW4->>DB: Tenant.findById(tenantId)
    DB-->>MW4: tenant document
    MW4->>DB: TenantPlan.findOne(...)
    DB-->>MW4: tenantPlan
    MW4-->>API: req.tenant, req.planSlug set
    API->>MW5: rateLimitTenant()
    MW5->>Redis: INCR rate_limit:{tenantId}
    Redis-->>MW5: current count
    MW5-->>API: Pass / 429
    API->>MW6: recordUsage()
    MW6->>Redis: INCR usage:{tenantId}:api_calls:{YYYYMM}
    Redis-->>MW6: OK
    MW6-->>API: req.metered = true
    API->>MW7a: checkUsageAndWarn()
    MW7a->>Redis: GET usage keys
    Redis-->>MW7a: values
    MW7a-->>API: Set X-Usage-Warning header if needed
    API->>MW7b: authorize('Product', 'CREATE')
    MW7b->>DB: User.findById(userId)
    DB-->>MW7b: user with customPermissions
    MW7b-->>API: Pass / 403

    alt Passed all middleware
        API->>Ctrl: productController.create(req, res)
        Ctrl->>DB: Brand.findById(brandId)
        DB-->>Ctrl: brand
        Ctrl->>DB: Category.findById(categoryId)
        DB-->>Ctrl: category
        Ctrl->>DB: Product.insert(payload)
        DB-->>Ctrl: product._id
        Ctrl->>Audit: log(userId, 'CREATE_PRODUCT', ...)
        Audit->>DB: AuditLog.insert()
        DB-->>Audit: auditId
        Ctrl->>DB: Product.findById(product._id).populate(...)
        DB-->>Ctrl: product with populated refs
        Ctrl-->>API: 201 + JSON
        API-->>LB: 201 + headers + body
        LB-->>Client: 201 + response
    else Failed middleware
        API-->>LB: 401/403/429 + error JSON
        LB-->>Client: Same status + body
    end
```

---

## 🧪 Testing the Flow

### **Manual Test with cURL**

```bash
# 1. Signup (creates tenant + user)
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "tenantName": "Acme Bike Shop",
    "email": "admin@acmebikes.com",
    "password": "SecurePass123!",
    "branchName": "Main Street",
    "timezone": "America/New_York",
    "currency": "USD",
    "planSlug": "trial"
  }'

# Response: { token, user, sessionId }
# Save token to variable:
TOKEN="eyJhbGciOiJIUzI1NiIs..."

# 2. Create product (authenticated)
curl -X POST http://localhost:4000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Brake Pad Set",
    "sku": "BP-001",
    "brandId": "65f4a3b8e4b0123456789abc",
    "categoryId": "65f4a3b8e4b0123456789def",
    "price": 49.99,
    "cost": 29.99,
    "stock": 100
  }'

# Observe response headers:
# X-RateLimit-Limit: 10000
# X-RateLimit-Remaining: 9999
# (if usage >90%) X-Usage-Warning: ...

# 3. Check rate limit (exceed)
# Make 10,001 requests quickly (or reduce limits in dev)
# Should get: 429 Too Many Requests
```

---

### **Check Redis State**

```bash
# Connect to Redis CLI
redis-cli

# Check rate limit key
GET rate_limit:{tenantId}

# Check usage counters
KEYS usage:{tenantId}:*
GET usage:{tenantId}:api_calls:2024-03

# Check session
GET session:{sessionId}
```

---

### **Check MongoDB**

```bash
# Connect to MongoDB
mongosh aicoding

# View recent products
db.products.find({ tenantId: ObjectId("65f4a3b8e4b0123456789xyz") }).pretty()

# View audit log for product creation
db.auditlogs.find({
  resource: "Product",
  resourceId: ObjectId("65f4c5d2e4b0987654321def")
}).pretty()

# View tenant with current usage
db.tenants.find({ _id: ObjectId("65f4a3b8e4b0123456789xyz") }).pretty()
```

---

## 🐛 Common Error Scenarios

### **1. Missing or Invalid JWT**
```
401 Unauthorized
{ "message": "No token provided" }
```
**Cause:** No `Authorization: Bearer <token>` header
**Fix:** Ensure frontend axios interceptor is adding token

---

### **2. Token Expired**
```
401 Unauthorized
{ "message": "Token expired" }
```
**Cause:** JWT older than 15 minutes
**Fix:** Frontend should redirect to `/login` on 401 (already in interceptor)

---

### **3. Tenant Suspended**
```
403 Forbidden
{ "message": "Tenant account is suspended" }
```
**Cause:** `Tenant.status === 'suspended'` (payment failure, abuse)
**Fix:** Tenant must contact support to reinstate

---

### **4. Trial Expired**
```
403 Forbidden
{ "message": "Trial period expired. Please upgrade to a paid plan." }
```
**Cause:** `TenantPlan.endDate < now` and plan is trial
**Fix:** User must checkout for paid plan

---

### **5. Rate Limit Exceeded**
```
429 Too Many Requests
{
  "message": "API rate limit exceeded. Please upgrade your plan.",
  "retryAfter": 1200,
  "currentUsage": 10001,
  "limit": 10000
}
```
**Cause:** Plan limit reached for the hour
**Fix:** Wait for window to reset or upgrade plan

---

### **6. Insufficient Permissions**
```
403 Forbidden
{
  "message": "Insufficient permissions. Role 'staff' cannot CREATE Product."
}
```
**Cause:** RBAC check failed
**Fix:** Assign elevated role or custom permission

---

### **7. Tenant Isolation Breach Attempt**
**Query:** `GET /api/products/{id}` where Product exists but `tenantId !== req.tenantId`

**Result:** `404 Not Found` (not 403 - don't leak existence)

**Implementation:**
```javascript
const product = await Product.findOne({
  _id: req.params.id,
  $or: [{ tenantId: req.tenantId }, { tenantId: null }]
});
// If product exists but tenantId mismatch → returns null → 404
```

---

## 📊 Performance Characteristics

| Operation | DB Queries | Redis Access | Typical Latency |
|-----------|------------|--------------|-----------------|
| **IP Rate Limit** | 0 | 1 (INCR + EXPIRE) | ~2ms |
| **JWT Verify** | 0 | 0 (stateless) | ~1ms |
| **Tenant Load** | 1 (Tenant.findById) | 0 | ~5ms (indexed _id) |
| **TenantPlan Load** | 1 (TenantPlan.findOne) | 0 | ~5ms |
| **Tenant Rate Limit** | 0 | 1 (INCR + EXPIRE) | ~2ms |
| **Usage Record** | 0 | 1 (INCR + EXPIRE) | ~2ms |
| **RBAC Check** | 1 (User.findById + permissions) | 0 | ~5ms (cached in future?) |
| **Total Middleware Overhead** | ~2 DB queries + ~3 Redis ops | ~10-15ms |

**Controller+DB:**
- Simple find: ~5ms
- Create with validation: ~10ms
- Complex with population: ~15-20ms

**Total API Latency (p50):** ~20-50ms for simple operations
**Total API Latency (p95):** ~100-200ms for complex operations

---

## 🔧 Custom Middleware Development

**To add new global middleware:**

1. **Create file:** `BACKEND/src/middleware/yourMiddleware.js`

```javascript
exports.yourMiddleware = async (req, res, next) => {
  // Your logic
  console.log(`Request from ${req.ip} to ${req.method} ${req.path}`);
  next();
};
```

2. **Register in app.js** (order matters!)

```javascript
// After CORS, before IP rate limit (or wherever appropriate)
app.use(yourMiddleware);
// OR for specific route group:
app.use('/api/products', yourMiddleware, productRoutes);
```

3. **Add error handling:**
```javascript
exports.yourMiddleware = async (req, res, next) => {
  try {
    // logic
    next();
  } catch (err) {
    next(err);  // Pass to error handler
  }
};
```

---

## 📝 Middleware Error Handling

**All middleware should:**
- Use try-catch for async operations
- Call `next(err)` on failure (lets Express handle it)
- OR send response immediately and return

**Example:**
```javascript
exports.safeMiddleware = async (req, res, next) => {
  try {
    const result = await someAsyncOp();
    req.result = result;
    next();
  } catch (err) {
    console.error('Middleware error:', err);
    next(err);  // Express error handler will send 500
  }
};
```

**Global Error Handler** (in app.js):
```javascript
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;
  res.status(status).json({ message, error: err.stack });
});
```

---

## 🎯 Key Takeaways

1. **Middleware Order is Sacred** - Changing order can break security
2. **TenantId is Sacred** - Never trust client-provided tenantId; always use from JWT
3. **All Queries Scoped** - Every DB query must include `$or: [{tenantId}, {tenantId: null}]`
4. **Idempotency** - Stripe/Razorpay ops use idempotency keys to prevent duplicates
5. **Observability** - Rate limit headers, usage warnings, audit logs provide transparency
6. **Graceful Degradation** - Redis unavailable? Fallback to in-memory (dev only, not for prod)

---

**Next:** [03-registration-flow.md](03-registration-flow.md) - Tenant signup & onboarding
