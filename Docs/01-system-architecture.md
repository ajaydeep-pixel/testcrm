# System Architecture

## 🏗️ High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        FE[React Frontend<br/>Port 3000]
        EL[Electron Desktop<br/>Wrapper]
    end

    subgraph "API Layer"
        LB[Load Balancer<br/>(NGINX)]
        API[Express Backend<br/>Port 4000]
    end

    subgraph "Data Layer"
        MONGO[(MongoDB<br/>Shared DB)]
        REDIS[(Redis<br/>Cache/Sessions)]
    end

    subgraph "External Services"
        STRIPE[Stripe API]
        RAZOR[Razorpay API]
        SMTP[Email Service]
    end

    FE --> LB
    EL --> LB
    LB --> API
    API --> MONGO
    API --> REDIS
    API --> STRIPE
    API --> RAZOR
    API --> SMTP

    style FE fill:#e1f5fe
    style API fill:#f3e5f5
    style MONGO fill:#fff3e0
    style REDIS fill:#e8f5e8
    style STRIPE fill:#fce4ec
```

---

## 📐 C4 Model

### **C4 Level 1: System Context**

```mermaid
graph TB
    USER[End User<br/>Business Staff/Admin]
    TENANT[Tenant Business<br/>(Shop/Location)]
    BIKE[BikeFlow SaaS]

    USER -->|Uses| BIKE
    TENANT -->|Subscribes to| BIKE

    BIKE -->|Integrates| STRIPE[Stripe]
    BIKE -->|Integrates| RAZOR[Razorpay]
    BIKE -->|Stores Data| MONGO[(MongoDB)]
    BIKE -->|Caches/Sessions| REDIS[(Redis)]

    STRIPE -->|Webhooks| BIKE
    RAZOR -->|Webhooks| BIKE

    style BIKE fill:#e1f5fe
    style TENANT fill:#f3e5f5
```

**System Purpose:** Provide inventory management, billing, and operational tools for auto parts/retail businesses in a multi-tenant SaaS model.

**External Interfaces:**
- **Users:** Staff, managers, owners, accountants (via React dashboard)
- **Payment Gateways:** Stripe (global), Razorpay (India)
- **Database:** MongoDB (primary data store)
- **Cache:** Redis (sessions, rate limiting, usage metering)

---

### **C4 Level 2: Container Diagram**

```mermaid
graph TB
    subgraph "BikeFlow SaaS System"
        subgraph "Web Application"
            FE[React SPA<br/>Port 3000]
        end

        subgraph "API Server"
            API[Express.js<br/>Port 4000]
            subgraph "Middleware Stack"
                MW1[IP Rate Limit]
                MW2[JWT Auth]
                MW3[Tenant Extraction]
                MW4[Tenant Validation]
                MW5[Tenant Rate Limit]
                MW6[Usage Metering]
                MW7[RBAC]
            end
        end

        subgraph "Data Stores"
            MONGO[(MongoDB)]
            REDIS[(Redis)]
        end

        subgraph "External APIs"
            STRIPE[Stripe]
            RAZOR[Razorpay]
        end
    end

    FE -->|HTTPS/JSON| API
    API -->|CRUD| MONGO
    API -->|Cache| REDIS
    API -->|Payment API| STRIPE
    API -->|Payment API| RAZOR
    STRIPE -->|Webhook| API
    RAZOR -->|Webhook| API

    MW1 --> MW2 --> MW3 --> MW4 --> MW5 --> MW6 --> MW7

    style FE fill:#e1f5fe
    style API fill:#f3e5f5
    style MONGO fill:#fff3e0
    style REDIS fill:#e8f5e8
```

**Containers:**

1. **React SPA (Frontend)**
   - Port: 3000 (dev), served statically in prod
   - Tech: React 18, React Router v6, Tailwind CSS, Axios
   - Responsibilities:
     - User interface (dashboard, forms, tables)
     - Client-side routing + auth guard
     - API communication via axios interceptors
   - Communication: HTTPS → Express API

2. **Express API (Backend)**
   - Port: 4000
   - Tech: Node.js, Express.js, MongoDB (Mongoose), Redis
   - Responsibilities:
     - HTTP API (RESTful endpoints)
     - Authentication/Authorization
     - Multi-tenancy enforcement
     - Business logic orchestration
     - External gateway integration
   - Communication:
     - MongoDB for persistence
     - Redis for cache/sessions/rate-limit
     - Stripe/Razorpay APIs for payments
   - **Middleware Chain:**
     1. `rateLimitIP()` - Global IP rate limit (100/hr)
     2. `verifyToken()` - JWT validation
     3. `extractTenant()` - Load tenantId from JWT
     4. `verifyTenantAccess()` - Check tenant status/trial
     5. `rateLimitTenant()` - Plan-based limits (Redis)
     6. `recordUsage()` - Increment usage counters (Redis)
     7. `checkUsageAndWarn()` - Add warning headers
     8. `authorize()` - RBAC permission check (optional)

3. **MongoDB**
   - 18 collections (models)
   - Shared database (multi-tenant via tenantId)
   - TTL indexes (AuditLog auto-delete after 90 days)
   - Indexes on: tenantId, email, status, timestamps

4. **Redis**
   - Session store (device tracking)
   - Rate limiting counters (sliding window)
   - Usage metering (monthly counters by key pattern)
   - Fallback: In-memory store for dev (if Redis unavailable)

5. **Stripe API**
   - Customer creation
   - Checkout sessions
   - Subscriptions (recurring)
   - Webhook events (payment success/failure, subscription updates)

6. **Razorpay API**
   - Order creation
   - Payment capture
   - Webhook events
   - Note: Recurring subscriptions partially implemented

---

### **C4 Level 3: Component Diagram (Express API)**

```mermaid
graph TB
    subgraph "Express API"
        ROUTES[Routes<br/>14 route files]
        MIDDLEWARE[Middleware<br/>5 modules]
        CONTROLLERS[Controllers<br/>14 controllers]
        SERVICES[Services<br/>7 service classes]
        MODELS[Models<br/>18 Mongoose models]
        HELPERS[Helpers/Utils<br/>Utility modules]
    end

    ROUTES --> MIDDLEWARE
    MIDDLEWARE --> CONTROLLERS
    CONTROLLERS --> SERVICES
    SERVICES --> MODELS
    SERVICES --> HELPERS
    HELPERS --> EXTERNAL[External APIs]

    MODELS --> MONGO[(MongoDB)]
    SERVICES --> REDIS[(Redis)]
    SERVICES --> EXTERNAL

    style ROUTES fill:#e1f5fe
    style CONTROLLERS fill:#f3e5f5
    style SERVICES fill:#fff3e0
    style MODELS fill:#e8f5e8
```

**Component Details:**

#### **Routes (14 files)**
- `authRoutes.js` - Authentication endpoints
- `billingRoutes.js` - Subscription & invoices
- `productRoutes.js` - Products CRUD
- `saleRoutes.js` - Sales/invoices
- `purchaseRoutes.js` - Purchase orders
- `inventoryRoutes.js` - Stock management
- `supplierRoutes.js` - Supplier CRUD
- `customerRoutes.js` - Customer CRUD
- `brandRoutes.js` - Brand management
- `categoryRoutes.js` - Category management
- `settingsRoutes.js` - Tenant settings
- `usageRoutes.js` - Usage metrics
- `auditRoutes.js` - Audit logs
- `adminRoutes.js` - Superadmin only

**Pattern:** Each route file imports controller methods and wires them to HTTP verbs + paths.

#### **Controllers (14 files)**
- Thin request handling layer
- Validate inputs (minimal currently)
- Call service methods
- Format responses (JSON)
- Handle errors (try-catch)

**Examples:**
- `authController.js` - signup, login, 2FA, sessions
- `billingController.js` - checkout, webhook handlers, invoices
- `productController.js` - list, search, create, update, delete

#### **Services (7 classes)**
- **Business logic layer**
- Reusable across controllers
- Complex operations (e.g., Stripe subscription creation)
- State machines (e.g., subscription lifecycle)
- External API integration

**Service Responsibilities:**

| Service | Key Methods | External APIs | Lines |
|---------|-------------|---------------|-------|
| AuthService | issueToken(), verifyTOTP(), generateBackupCodes() | - | ~80 |
| SessionService | createSession(), getUserSessions(), revokeSession() | Redis | ~120 |
| BillingService | createStripeSubscription(), changePlan(), handleStripeWebhook() | Stripe, Razorpay | ~1600 |
| PermissionService | checkPermission(), getAccessibleResources() | - | ~100 |
| ActivityLogger | log(), getLogs(), exportLogs() | MongoDB | ~150 |
| RateLimiterService | checkLimit(), getUsage(), reset() | Redis | ~110 |
| UsageMeterService | incrementMetric(), getMonthlyUsage(), syncToDatabase() | Redis, MongoDB | ~150 |

#### **Middleware (5 modules)**
| Middleware | File | Purpose | Applied To |
|------------|------|---------|------------|
| `rateLimitIP()` | `rateLimitMiddleware.js` | Global IP limit (100/hr) | All `/api/` |
| `verifyToken()` | `authMiddleware.js` | JWT validation | All protected |
| `extractTenant()` | `tenantMiddleware.js` | Load tenantId | All protected |
| `verifyTenantAccess()` | `tenantMiddleware.js` | Check status/trial | All protected |
| `rateLimitTenant()` | `rateLimitMiddleware.js` | Plan-based limits | All protected |
| `recordUsage()` | `usageMeteringMiddleware.js` | Increment counters | All protected |
| `checkUsageAndWarn()` | `usageMeteringMiddleware.js` | Warn if >90% | All protected |
| `authorize()` | `permissionMiddleware.js` | RBAC check | Optional per route |

---

### **C4 Level 4: Code (Key Files)**

#### **Application Entry Point: `app.js`**
```javascript
// 1. Setup
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');
const seedDatabase = require('./src/scripts/seed');

// 2. Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 3. Webhooks (raw body for Stripe - MUST be before express.json)
app.post('/api/billing/webhook/stripe', express.raw({ type: 'application/json' }), stripeWebhook);
app.post('/api/billing/webhook/razorpay', express.json(), razorpayWebhook);

// 4. Connect DB + Seed
connectDB().then(() => seedDatabase());

// 5. Global Middlewares
app.use('/api/', rateLimitIP(100, 3600));

// 6. Public Routes
app.use('/api/auth', require('./src/routes/authRoutes'));
app.get('/api/branding', getPublicBranding);
app.get('/api/billing/plans', getPlans);

// 7. Superadmin Routes
app.use('/api/admin', require('./src/routes/adminRoutes'));

// 8. Protected Routes (with full middleware stack)
const protectedStack = [
  verifyToken,
  extractTenant,
  verifyTenantAccess,
  rateLimitTenant(),
  recordUsage,
  checkUsageAndWarn
];

app.use('/api/billing', protectedStack, require('./src/routes/billingRoutes'));
app.use('/api/products', protectedStack, require('./src/routes/productRoutes'));
// ... other protected routes

// 9. Start Server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

**Key Points:**
- Webhook route registered **before** `express.json()` (Stripe needs raw body)
- Protected routes use **composed middleware array** (order matters)
- `app.use('/uploads', ...)` serves static files (product images, PDFs)
- Database seeded on startup (creates default plans, superadmin)

---

#### **Middleware Execution Order (Per Request)**

```javascript
// Example: POST /api/products (authenticated route)

// Step 1: Global IP Rate Limit
rateLimitIP(100, 3600)
  ↓
// Step 2: JWT Validation
verifyToken()
  → Extract token from Authorization header
  → Verify with JWT_SECRET
  → Set req.user = decoded payload
  ↓
// Step 3: Tenant Extraction
extractTenant()
  → Read req.user.tenantId (except superadmin)
  → Set req.tenantId
  → Set req.userId = req.user.id
  ↓
// Step 4: Tenant Validation
verifyTenantAccess()
  → Load Tenant.findById(req.tenantId)
  → Check status (suspended?)
  → Load current TenantPlan
  → Check trial expiry (if trial)
  → Set req.tenant, req.tenantPlan, req.planDetails
  ↓
// Step 5: Tenant Rate Limit
rateLimitTenant()
  → Read plan tier from req.planSlug
  → Check Redis key: rate_limit:{tenantId}
  → 429 if limit exceeded
  → Set remaining count in response headers
  ↓
// Step 6: Usage Metering
recordUsage()
  → Increment Redis key: usage:{tenantId}:api_calls:{YYYYMM}
  → Set warning header if >90%
  ↓
// Step 7: Authorization (optional per route)
authorize('Product', 'CREATE')
  → Load user permissions
  → Check if user.role allows Product CREATE
  → 403 if denied
  ↓
// Step 8: Route Handler
productController.create(req, res)
  → Controller logic
  → Service calls
  → Database queries (with tenantId filter!)
  → JSON response
```

---

#### **Database Schema Highlights**

**Tenant Model (Multi-tenant Root)**
```javascript
{
  _id: ObjectId,
  name: String,              // "Acme Bike Shop"
  email: String,             // unique
  phone: String,
  address: String,
  country, state, city, zip: String,
  status: 'active' | 'suspended' | 'inactive',

  // Branches (multi-location support)
  branches: [{
    _id: ObjectId,
    name: "Downtown Store",
    address, city, state, zip, phone, timezone: String,
  }],

  // Settings
  settings: {
    timezone: 'UTC' | 'America/New_York',
    currency: 'USD' | 'EUR' | 'INR',
    gst_enabled: Boolean,
    gst_number: String,
    vat_enabled: Boolean,
    vat_number: String,
  },

  // Billing (legacy - to be migrated)
  stripeCustomerId: String,
  stripePlanId: String,
  plan: 'trial' | 'basic' | 'pro' | 'enterprise',
  subscription: { stripeId, status, currentPeriod: {} },
  usage: { apiCallsThisMonth, invoiceCount, activeUsers, storageMB },

  // Timestamps
  createdAt, updatedAt: Date
}
```

**User Model (Multi-tenant Aware)**
```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,        // Required (except superadmin)
  name, email: String,
  passwordHash: String,      // bcrypt hash
  role: 'superadmin' | 'owner' | 'manager' | 'accountant' | 'staff',

  // 2FA (TOTP)
  totpEnabled: Boolean,
  totpSecret: String,        // encrypted
  backupCodes: [String],     // 10 one-time codes

  // Account
  status: 'active' | 'inactive' | 'locked',

  // Device Tracking
  lastLoginAt: Date,
  lastLoginIp: String,
  devices: [{
    deviceId: String,        // UUID
    userAgent: String,
    ipAddress: String,
    lastUsedAt: Date,
    isActive: Boolean,
  }],

  // Permissions
  customPermissions: [String], // overrides role-based

  createdAt, updatedAt: Date
}
```

**Product Model (Tenant-Scoped + Global)**
```javascript
{
  _id: ObjectId,
  tenantId: ObjectId | null,  // null = global shared product

  // Identity
  name: String,               // "Brake Pad Set"
  sku: String,                // "BP-001"
  barcode: String,            // "123456789"
  oemNumber: String,          // "OE-7654"

  // Classification
  brandId: ObjectId,          // ref Brand
  categoryId: ObjectId,       // ref Category
  brand: String,              // denormalized (populated)
  category: String,           // denormalized

  // Commerce
  cost: Number,               // purchase price
  price: Number,              // selling price
  taxRate: Number,            // percentage
  discountPercent: Number,

  // Inventory
  stock: Number,              // current quantity
  reorderPoint: Number,       // low stock threshold
  minStock: Number,

  // Metadata
  description: String,
  model: String,
  imageUrl: String,
  weight, dimensions: Mixed,

  createdAt, updatedAt: Date
}

// Indexes:
// { tenantId: 1, sku: 1 } (unique if tenantId not null)
// { tenantId: 1, barcode: 1 }
// { tenantId: 1, name: 1 } (text index for search)
```

**TenantPlan Model (New - Subscription Lifecycle)**
```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  planId: ObjectId,           // ref Plan (catalog)

  // Lifecycle
  status: 'trialing' | 'active' | 'past_due' | 'canceling' |
          'canceled' | 'expired' | 'incomplete' | 'suspended',
  gateway: 'stripe' | 'razorpay' | null,
  gatewayCustomerId: String,     // Stripe customer ID
  gatewaySubscriptionId: String, // Stripe subscription ID

  // Billing Periods
  startDate: Date,
  endDate: Date,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  nextBillingDate: Date,
  cancelAtPeriodEnd: Boolean,
  canceledAt: Date,
  endedAt: Date,

  // Recurring
  renewalInterval: 'monthly' | 'yearly' | 'one-time' | 'free',

  // Usage (snapshot at subscription level)
  usage: {
    invoiceCount: Number,
    apiCallsThisMonth: Number,
    activeUsers: Number,
    storageMB: Number,
  },

  // Historical lineage
  previousTenantPlanId: ObjectId,
  nextPlannedPlanId: ObjectId,

  metadata: Mixed,             // Gateway-specific data

  createdAt, updatedAt: Date
}

// Indexes:
// { tenantId: 1, createdAt: -1 }
// { tenantId: 1, status: 1 }
// { tenantId: 1, currentPeriodEnd: 1 }
// { gateway: 1, gatewaySubscriptionId: 1 } (unique)
```

**AuditLog Model (Immutable)**
```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  userId: ObjectId,           // Who performed action

  // What happened
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | '2FA_ENABLE' | etc,
  resource: 'Product' | 'Sale' | 'User' | 'Tenant' | etc,
  resourceId: ObjectId,

  // Change tracking
  before: Object,             // Full document before change
  after: Object,              // Full document after change
  changes: [{ field: String, oldValue: Any, newValue: Any }],

  // Outcome
  status: 'success' | 'failure',
  errorMessage: String,

  // Metadata
  ipAddress: String,
  userAgent: String,

  createdAt: Date
}

// TTL Index: { createdAt: 1 } → expire after 90 days
// Other indexes: { tenantId: 1 }, { userId: 1 }, { resource: 1 }, { createdAt: -1 }
```

---

## 🔄 Component Interactions

### **Authentication Flow**
See [04-authentication-flow.md](04-authentication-flow.md) for detailed sequence.

**Summary:**
1. User submits email/password → `POST /api/auth/login`
2. Backend validates password (bcrypt compare)
3. JWT issued (15min expiry) with payload: `{ userId, tenantId, role }`
4. Session created in Redis (device tracking)
5. Frontend stores JWT in `localStorage`
6. Axios interceptor adds `Authorization: Bearer <token>` to all requests
7. 401 responses trigger logout + redirect to `/login`

---

### **Multi-Tenancy Enforcement**

**Every data query includes tenantId filter:**

```javascript
// Example: Product search in productController.js (BACKEND/src/controllers/productController.js:28-69)
exports.list = async (req, res) => {
  const tenantId = req.tenantId;  // Set by extractTenant middleware
  const filter = {
    $or: [
      { tenantId },           // Tenant-specific products
      { tenantId: null }     // Global shared products
    ]
  };

  // Add search query if present
  if (q) {
    filter.$and = [
      { $or: [{ tenantId }, { tenantId: null }] },
      { $or: [{ name: regex }, { sku: regex }, ...] }
    ];
  }

  const items = await Product.find(filter)  // ⚠️ tenantId ALWAYS in query
    .populate('brandId categoryId')
    .skip(skip)
    .limit(limit);
};
```

**Why `tenantId: null` for global data?**
- Allows system-wide shared catalogs (e.g., universal brands/categories)
- Tenant admin can choose from global options or create tenant-specific
- Query pattern ensures tenant can see both

---

### **Rate Limiting**

**Two-tier system:**

1. **Global IP Rate Limit** (applied to `/api/` before auth)
   - 100 requests per hour per IP
   - Protects against brute force and DoS
   - Redis key: `rate_limit_ip:{IP}`

2. **Tenant Rate Limit** (after tenant extraction)
   - Tiered by plan:
     - Trial: 100/hr
     - Basic: 1,000/hr
     - Pro: 10,000/hr
     - Enterprise: unlimited (skip check)
   - Redis key: `rate_limit:{tenantId}`
   - Sliding window algorithm

**Middleware Implementation:**
```javascript
// rateLimitTenant() from BACKEND/src/middleware/rateLimitMiddleware.js
const rateLimitTenant = (windowMs = 3600000, max = 1000) => {
  return async (req, res, next) => {
    const tenantId = req.tenantId;
    const key = `rate_limit:${tenantId}`;

    const current = await redis.incr(key);
    if (current === 1) {
      await redis.pexpire(key, windowMs);
    }

    const remaining = max - current;
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(remaining, 0));

    if (current > max) {
      return res.status(429).json({
        message: 'Too many requests',
        retryAfter: Math.ceil(await redis.ttl(key))
      });
    }

    next();
  };
};
```

---

## 🏢 Deployment Architecture

### **Development Environment**
```
┌─────────────────┐
│   Developer     │
│   Machine       │
├─────────────────┤
│  Frontend:3000  │ ──HTTP──> ┌──────────────┐
│  Backend:4000   │ ──HTTP──> │  MongoDB     │
│  Redis:6379     │           │  (local)     │
│  Node 16+       │           └──────────────┘
└─────────────────┘
```

- Frontend: Webpack Dev Server with HMR
- Backend: Nodemon with auto-restart
- Database: Local MongoDB or Atlas cloud
- Redis: Local or disabled (falls back to in-memory)

---

### **Production Environment**
```
┌─────────────────┐
│    Load         │  (NGINX/CloudFlare)
│    Balancer     │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│   Express       │  (PM2/Node clusters)
│   App Server    │  Port 3000 or 80/443
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│MongoDB│ │ Redis │
│(Atlas)│ │(Cloud)│
└───────┘ └───────┘
         │
         ▼
   ┌─────────────┐
   │ Stripe/Razor│
   │ pay APIs    │
   └─────────────┘
```

**Production Setup:**
- **Process Manager:** PM2 (clusters for multi-core)
- **Reverse Proxy:** NGINX (SSL termination, static files, gzip)
- **Database:** MongoDB Atlas (managed, backups, replicas)
- **Cache:** Redis Cloud/ElastiCache
- **SSL:** Let's Encrypt or commercial cert
- **CDN:** CloudFlare (static assets, DDoS protection)
- **Monitoring:** Sentry (errors), UptimeRobot (health checks)
- **Logging:** Papertrail/Loggly (centralized logs)

---

## 📊 Data Flow Patterns

### **Create Product Flow**
```mermaid
sequenceDiagram
    actor User as User (Manager)
    participant FE as Frontend
    participant API as Express API
    participant Mid as Middleware Chain
    participant Ctrl as productController
    participant Svc as AuthService
    participant DB as MongoDB
    participant Audit as AuditLog

    User->>FE: Fill "Add Product" form
    FE->>API: POST /api/products (with JWT)
    API->>Mid: rateLimitIP()
    Mid->>Mid: verifyToken()
    Mid->>Mid: extractTenant()
    Mid->>Mid: verifyTenantAccess()
    Mid->>Mid: rateLimitTenant()
    Mid->>Mid: recordUsage()
    Mid->>Mid: authorize('Product', 'CREATE')
    Mid->>Ctrl: create(req, res)
    Ctrl->>Svc: (optional validation)
    Ctrl->>DB: Product.insert({...tenantId})
    DB-->>Ctrl: product._id
    Ctrl->>Audit: log(userId, 'CREATE_PRODUCT', {before, after})
    Audit->>DB: AuditLog.insert()
    DB-->>Ctrl: auditId
    Ctrl-->>API: 201 JSON (product)
    API-->>FE: Product created
    FE-->>User: Success toast + redirect
```

---

## 🔐 Security Architecture

### **Defense in Depth**

```
Layer 1: Network
├── HTTPS (TLS 1.3)
├── CORS (whitelist origins)
├── Rate Limiting (IP-based)
└── DDoS protection (CloudFlare)

Layer 2: Authentication
├── JWT (signed, short expiry)
├── bcrypt password hashing (10 rounds)
├── TOTP 2FA (optional but enforced for owners)
└── Backup codes (10 one-time)

Layer 3: Authorization
├── RBAC matrix (role × resource × action)
├── Tenant isolation (tenantId filter on every query)
├── Superadmin bypass (can see all tenants)
└── Custom permissions (per-user overrides)

Layer 4: Session Security
├── Redis session store (not localStorage)
├── Device tracking (deviceId, userAgent, IP)
├── Session revocation (logout anywhere)
└── Concurrent session limits (future)

Layer 5: Operational Security
├── Audit logs (immutable, 90-day TTL)
├── Request logging (all API calls)
├── Error sanitization (no stack traces in prod)
└── Secret management (.env, never committed)

Layer 6: Payment Security
├── Stripe signature verification (webhooks)
├── Razorpay signature verification
├── No card data stored locally
├── Idempotency keys (prevent double billing)
└── PCI DSS compliance (via Stripe/Razorpay)
```

---

## 📈 Scalability Considerations

### **Current Design for Scale**

1. **Stateless API Servers**
   - JWT auth means any server can handle any request
   - Horizontal scaling via load balancer
   - No sticky sessions required

2. **Redis Centralization**
   - Single Redis instance (or cluster)
   - All rate limiting/usage goes through Redis
   - Can scale Redis separately (Redis Cluster, ElastiCache)

3. **MongoDB Shared Database**
   - All tenants in same DB (cost-effective for <1000 tenants)
   - TenantId indexes ensure performance
   - Can migrate to sharding or DB-per-tenant later

4. **BillingService Idempotency**
   - All gateway operations use idempotency keys
   - Webhooks deduplicated by gateway event ID
   - Safe to retry on failure

---

### **Bottlenecks & Mitigations**

| Bottleneck | Current Approach | Mitigation at Scale |
|------------|------------------|---------------------|
| **Database queries** | tenantId indexes on all models | Add compound indexes, read replicas |
| **Redis throughput** | Single Redis instance | Redis Cluster, connection pooling |
| **API throughput** | Single Node process | PM2 clusters, multiple instances behind LB |
| **File uploads** | Local filesystem (`/uploads`) | AWS S3 / Cloudinary CDN |
| **Invoice PDFs** | Synchronous generation | BullMQ job queue + storage |

---

## 🔧 Configuration Management

### **Backend .env (BACKEND/.env)**

```env
# Server
PORT=4000
NODE_ENV=development  # or production

# Database
MONGO_URI=mongodb://localhost:27017/aicoding
# or MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname

# JWT
JWT_SECRET=your-super-secret-random-string-min-32-chars
JWT_EXPIRY=15m  # 15 minutes

# Redis (optional for dev, required for prod)
REDIS_URL=redis://localhost:6379
# or REDIS_URL=redis://:password@redis-12345.cloud.redislabs.com:12345

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLIC_KEY=pk_test_...

# Razorpay
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
# or FRONTEND_URL=https://yourdomain.com

# Email (future)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...

# Logging
LOG_LEVEL=info  # error, warn, info, debug
```

### **Frontend .env (FRONTEND/.env)**

```env
REACT_APP_API_URL=http://localhost:4000/api
REACT_APP_STRIPE_PUBLIC_KEY=pk_test_...
REACT_APP_GOOGLE_ANALYTICS_ID=  # future
```

---

## 📋 Design Principles

1. **Multi-tenancy First**
   - Every query must include tenantId
   - Never trust client-provided tenantId
   - Global data (brands/categories) use tenantId: null

2. **Security by Default**
   - All new routes require auth unless explicitly public
   - Rate limit everything
   - Validate all inputs (future improvement)
   - Log all mutations to AuditLog

3. **Service Layer Pattern**
   - Controllers stay thin (request/response only)
   - Business logic in services
   - Models stay dumb (no business logic)

4. **Graceful Degradation**
   - Redis unavailable? Fall back to in-memory (dev only)
   - Stripe down? Allow read-only operations
   - Webhook failure? Retry with exponential backoff

5. **Idempotency Where Possible**
   - Stripe/Razorpay operations use idempotency keys
   - Webhook handlers check gateway event ID before processing
   - PUT updates are safe to retry

6. **Observability**
   - All API calls logged (future: to DB)
   - Audit trail for every mutation
   - Rate limit headers for transparency
   - Usage warnings before hitting limits

---

## 🔮 Future Architecture Evolution

### **Phase 1 (3-6 months)**
- Add BullMQ job queue (PDF generation, imports)
- Admin panel (separate from superadmin)
- Advanced reporting (cached aggregates)

### **Phase 2 (6-12 months)**
- Database-per-tenant option (enterprise)
- SAML/OIDC SSO integration
- Read replicas for reporting
- API versioning (`/api/v1/`, `/api/v2/`)

### **Phase 3+ (12-18 months)**
- Microservices split (auth, billing, inventory as separate services)
- Event sourcing for audit logs
- GraphQL API layer (optional)
- Mobile backend (PWA + React Native)

---

**Next:** [02-request-flow.md](02-request-flow.md) - Detailed request processing
