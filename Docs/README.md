# BikeFlow SaaS Platform - Complete System Documentation

## 📋 Table of Contents

1. [System Architecture](01-system-architecture.md)
2. [Request Processing Flow](02-request-flow.md)
3. [User Registration & Onboarding](03-registration-flow.md)
4. [Authentication & 2FA](04-authentication-flow.md)
5. [Authorization (RBAC)](05-authorization-flow.md)
6. [Multi-Tenancy & Data Isolation](06-multi-tenancy-flow.md)
7. [Billing & Subscription Lifecycle](07-billing-flow.md)
8. [Payment Gateway Integration](08-payment-gateways.md)
9. [Rate Limiting & Usage Metering](09-rate-limiting-flow.md)
10. [Audit Logging & Compliance](10-audit-flow.md)
11. [Webhook Processing](11-webhook-flow.md)
12. [Operations Workspace](12-operations-workspace.md)
13. [Deployment & Environment](13-deployment-flow.md)
14. [Testing Strategy](14-testing-flow.md)
15. [Monitoring & Alerting](15-monitoring-flow.md)

---

## 🎯 Quick Reference

### Technology Stack
- **Backend:** Node.js + Express + MongoDB + Redis
- **Frontend:** React 18 + Tailwind CSS + Webpack
- **Desktop:** Electron (optional wrapper)
- **Payments:** Stripe (global) + Razorpay (India)

### Key Ports
- **Backend API:** `http://localhost:4000`
- **Frontend Dev:** `http://localhost:3000`
- **MongoDB:** `localhost:27017`
- **Redis:** `localhost:6379`

### Environment Files
- **Backend:** `BACKEND/.env`
- **Frontend:** `FRONTEND/.env`

### Quick Start
```bash
# Backend
cd BACKEND && npm install && npm run dev

# Frontend (new terminal)
cd FRONTEND && npm install && npm run dev
```

---

## 📊 System Overview

**BikeFlow** is a multi-tenant SaaS platform for auto parts/retail businesses providing:

- ✅ Inventory & Product Management
- ✅ Sales & Billing (POS-style)
- ✅ Supplier & Purchase Management
- ✅ Multi-branch support
- ✅ Subscription billing (Stripe + Razorpay)
- ✅ Role-based access control (RBAC)
- ✅ Real-time usage metering
- ✅ Immutable audit logs
- ✅ 2FA authentication
- ✅ Responsive web dashboard

**Target:** Medium-sized businesses (retail, auto parts, hardware, electronics, wholesale)

**Architecture:** Multi-tenant shared database with tenantId isolation, JWT auth, Redis caching/sessions, microservices-oriented backend.

---

## 🏗️ Core Components

### Backend Services
| Service | Responsibility | Lines |
|---------|----------------|-------|
| AuthService | JWT generation, TOTP 2FA | ~80 |
| SessionService | Redis session store, device tracking | ~120 |
| BillingService | Stripe/Razorpay integration (subscriptions) | ~1600 |
| PermissionService | RBAC matrix checks | ~100 |
| ActivityLogger | Immutable audit trail | ~150 |
| RateLimiterService | Plan-based rate limiting | ~110 |
| UsageMeterService | Monthly usage tracking | ~150 |

### Middleware Chain
Every protected API request passes through:
```
1. rateLimitIP()        → Global IP protection (100/hr)
2. verifyToken()        → JWT validation
3. extractTenant()      → Load tenantId from token
4. verifyTenantAccess() → Check tenant status/trial
5. rateLimitTenant()    → Plan-based limits (Redis)
6. recordUsage()        → Increment counters (Redis)
7. checkUsageAndWarn()  → Warn if >90% used
8. authorize()          → RBAC permission check
```

### Database Models (18 total)
- **Core:** Tenant, User, Product, Inventory, Sale, Purchase, Supplier, Customer, Brand, Category
- **Billing:** Plan, TenantPlan, TenantInvoice, TenantTransaction, Invoice
- **Security:** AuditLog, ActivityLog
- **System:** PlatformSettings

---

## 🔐 Security Highlights

- **Authentication:** JWT (15min expiry) + bcryptjs password hashing
- **2FA:** TOTP (speakeasy) with backup codes
- **Authorization:** RBAC matrix (5 roles × 12 resources)
- **Multi-tenancy:** TenantId enforced in every query
- **Rate Limiting:** Plan-based tiers + IP-based fallback
- **Audit:** Immutable logs with before/after snapshots (90-day TTL)
- **Session Security:** Redis-based session store with device tracking
- **Webhook Security:** Stripe signature verification, Razorpay signature check

---

## 💳 Billing Architecture

### Payment Gateways
- **Stripe:** Full recurring subscription support, checkouts, webhooks
- **Razorpay:** India payments, recurring subscriptions (partial implementation)

### Subscription Models (3-Layer Design)

**Current (Phase 0 - Legacy):**
```javascript
Tenant {
  plan: String,              // trial/basic/pro/enterprise
  subscription: Object,      // { stripeId, status, currentPeriod }
  usage: Object,            // { apiCalls, invoices, users, storage }
}
```

**Target (Phase 1+ - Redesigned):**
```javascript
TenantPlan {         // Subscription lifecycle
  tenantId, planId,
  status, gateway, gatewaySubscriptionId,
  startDate, endDate, currentPeriodStart, currentPeriodEnd,
  cancelAtPeriodEnd, cancelAt,
  usage: { apiCalls, invoices, users, storage },
  previousPlanId, nextPlannedPlanId
}

TenantInvoice {      // Billing records
  tenantId, tenantPlanId,
  invoiceNumber, type, status,
  amount, taxAmount, dueDate, paidAt,
  lineItems[], gatewayInvoiceId, invoiceUrl
}

TenantTransaction {  // Payment attempts
  tenantId, tenantPlanId, tenantInvoiceId,
  gateway, type, gatewayTransactionId,
  amount, status, failureCode, idempotencyKey
}
```

**Migration:** 6-phase dual-write strategy (see SUBSCRIPTION_REDESIGN_SPEC.md)

---

## 📈 Current Status

**Phase 0 MVP:** ✅ Complete (March 7, 2026)

**Completion:** 10/18 todos (55% of 18-month roadmap)

**What's Working:**
- ✅ Multi-tenant foundation
- ✅ JWT + 2FA + RBAC
- ✅ Stripe/Razorpay integration
- ✅ Audit logs
- ✅ Rate limiting + usage metering
- ✅ Dashboard with widgets
- ✅ Product/Inventory/Sales CRUD
- ✅ Responsive UI

**In Progress:**
- 🔄 Operations workspace (CRM_UI_DIRECTION.md)
- 🔄 Billing migration to new models

**Blocked:**
- ❌ No automated tests
- ❌ Frontend-backend contract drift (CheckoutPage)
- ❌ Monitoring/alerting not set up
- ❌ Input validation missing

---

## 🚀 Next Steps

1. **Complete Operations Workspace** (per CRM_UI_DIRECTION.md)
   - Add Operations top-nav
   - Build sidebar navigation
   - Implement Customers, Billing, Inventory modules

2. **Execute Billing Migration** (per SUBSCRIPTION_REDESIGN_SPEC.md)
   - Add TenantPlan/TenantInvoice/TenantTransaction models
   - Backfill historical data
   - Dual-write with compatibility layer

3. **Add Automated Tests**
   - Unit tests for services (BillingService, AuthService)
   - Integration tests for API endpoints
   - E2E tests for critical flows

4. **Production Readiness**
   - Monitoring & alerting (Sentry, uptime checks)
   - Input validation (Joi/Yup)
   - Webhook retry logic + DLQ
   - Request logging middleware
   - Database backup strategy

---

## 📚 Documentation Conventions

- **Flow diagrams:** Mermaid.js syntax
- **Code snippets:** Actual code from codebase (with file:line references)
- **Architecture:** C4 model (Context, Containers, Components, Code)
- **Sequences:** UML sequence diagrams for flows
- **Status indicators:** ✅ Complete 🔄 In Progress ❌ Not Started ⚠️ Needs Work

All flows include:
- 📍 Entry points
- 🔄 Step-by-step process
- ✅ Success paths
- ❌ Error paths
- 🔐 Security checks
- 📝 Data persistence points
- 🔗 External integrations

---

**Start with:** [01-system-architecture.md](01-system-architecture.md)
