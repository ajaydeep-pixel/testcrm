# Payment Flow Documentation

## Overview
This is a multi-tenant SaaS payment system supporting both **Stripe** (global) and **Razorpay** (India), with automatic invoicing, usage metering, rate limiting, and proration support.

---

## Subscription Plans

```javascript
PLANS = {
  trial: {
    price: 0,
    currency: 'usd',
    interval: null,
    description: '14-day free trial'
  },
  basic: {
    price: 2999,     // $29.99
    currency: 'usd',
    interval: 'month',
    description: 'Basic Plan - $29.99/month'
  },
  pro: {
    price: 7999,     // $79.99
    currency: 'usd',
    interval: 'month',
    description: 'Pro Plan - $79.99/month'
  },
  enterprise: {
    price: 0,        // Custom pricing
    currency: 'usd',
    interval: null,
    description: 'Enterprise - Custom pricing'
  }
}
```

### Plan Features & Limits

| Plan | Monthly Invoices | API Calls/Month | Active Users | Storage | Price |
|------|------------------|-----------------|--------------|---------|-------|
| Trial | 5 | 100 | 1 | 100 MB | Free (14 days) |
| Basic | 100 | 5,000 | 5 | 5 GB | $29.99 |
| Pro | 1,000 | 50,000 | 50 | 100 GB | $79.99 |
| Enterprise | Unlimited | Unlimited | Unlimited | Unlimited | Custom |

---

## Frontend Payment Flow

### Step 1: User Selects Plan
```
1. User navigates to /pricing or plan selection page
2. Selects a plan tier (Basic, Pro, Enterprise)
3. Clicks "Subscribe" button
4. Redirected to /checkout with query param: ?plan=planName
```

### Step 2: Checkout Form
User enters billing details:
```javascript
{
  email: string,
  firstName: string,
  lastName: string,
  company: string,
  address: string,
  country: number,        // Country ID
  state: number,          // State ID
  city: string,
  zipCode: string,
  
  // Payment details (if Stripe)
  cardNumber: string,
  expiryDate: string,     // MM/YY
  cvv: string,
  
  // Or payment profile ID (if saved card)
  paymentProfileId: string
}
```

### Step 3: Payment Gateway Selection
User selects payment method:
- **Stripe** (for global, card payments)
- **Razorpay** (for India, UPI/card/netbanking)

### Step 4: Form Submission
```
submitCheckout()
├─ Validate billing details
├─ Validate card (if Stripe)
├─ Prepare subscription data
└─ Call backend payment endpoint
```

---

## Backend Payment Processing

### Stripe Subscription Flow

**Endpoint:** `POST /api/billing/subscribe`

**Request:**
```json
{
  "planName": "pro",
  "gateway": "stripe"
}
```

**Process:**
```javascript
async createStripeSubscription(tenantId, planName) {
  1. Fetch tenant from database
  2. Get plan pricing from PLANS
  3. Get or create Stripe customer
     ├─ If tenant.stripeCustomerId exists → retrieve customer
     └─ Else → create new customer
  4. Create subscription in Stripe
     {
       customer: customer.id,
       items: [{ price_data: { ... } }],
       payment_behavior: 'default_incomplete',  // Requires payment confirmation
       expand: ['latest_invoice.payment_intent']
     }
  5. Store subscription in Tenant document:
     {
       plan: 'pro',
       subscription: {
         id: 'sub_xxx',
         status: 'trialing' | 'active' | 'past_due' | 'canceled',
         currentPeriodEnd: Date
       },
       stripeCustomerId: 'cus_xxx'
     }
  6. Return subscription object with payment intent
}
```

**Response:**
```json
{
  "message": "Subscription initiated",
  "subscription": {
    "id": "sub_xxx",
    "status": "trialing",
    "current_period_end": 1234567890,
    "latest_invoice": {
      "payment_intent": {
        "client_secret": "pi_xxx_secret_yyy",
        "status": "requires_action"
      }
    }
  },
  "gateway": "stripe"
}
```

**Frontend handles:**
- 3D Secure redirect if needed
- Confirms payment with `stripe.confirmPayment()`
- Waits for webhook confirmation

---

### Razorpay Order Flow

**Endpoint:** `POST /api/billing/subscribe`

**Request:**
```json
{
  "planName": "pro",
  "gateway": "razorpay"
}
```

**Process:**
```javascript
async createRazorpayOrder(tenantId, planName) {
  1. Fetch tenant and plan pricing
  2. Create order on Razorpay:
     {
       amount: 79999,              // In paise (₹799.99)
       currency: 'INR',
       receipt: 'tenant_{id}_{timestamp}',
       notes: {
         tenantId: tenantId,
         planName: 'pro'
       }
     }
  3. Return order object to frontend
  4. Frontend opens Razorpay payment modal
}
```

**Response:**
```json
{
  "message": "Subscription initiated",
  "subscription": {
    "id": "order_xxx",
    "amount": 79999,
    "amount_paid": 0,
    "currency": "INR",
    "receipt": "tenant_abc_123456",
    "status": "created"
  },
  "gateway": "razorpay"
}
```

**Frontend handles:**
- Opens Razorpay modal with order ID
- User completes payment (card/UPI/netbanking)
- Razorpay redirects with payment ID & signature
- Frontend calls webhook verification endpoint

---

## Webhook Handling

### Stripe Webhooks

**Events handled:**
- `payment_intent.succeeded` — Payment confirmed
- `customer.subscription.updated` — Plan changed or renewed
- `customer.subscription.deleted` — Subscription canceled
- `invoice.payment_succeeded` — Invoice paid
- `invoice.payment_failed` — Payment failed (past due)

**Endpoint:** `POST /api/billing/webhook/stripe`

**Process:**
```javascript
exports.stripeWebhook = async (req, res) => {
  1. Extract stripe-signature header
  2. Verify signature using STRIPE_WEBHOOK_SECRET
  3. Construct event from raw body
  4. Handle event type:
     
     case 'payment_intent.succeeded':
       ├─ Find tenant by stripe customer ID
       ├─ Update subscription.status = 'active'
       ├─ Set plan features
       └─ Send confirmation email
     
     case 'customer.subscription.updated':
       ├─ Update subscription metadata
       ├─ Store new currentPeriodEnd
       └─ Log audit entry
     
     case 'invoice.payment_failed':
       ├─ Set subscription.status = 'past_due'
       ├─ Send retry email
       └─ Log failed payment
  
  5. Return { received: true }
}
```

---

### Razorpay Webhooks

**Endpoint:** `POST /api/billing/webhook/razorpay`

**Request:**
```json
{
  "orderId": "order_xxx",
  "paymentId": "pay_yyy",
  "signature": "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a",
  "email": "user@example.com"
}
```

**Process:**
```javascript
exports.razorpayWebhook = async (req, res) => {
  1. Extract orderId, paymentId, signature
  2. Verify signature:
     ├─ Create HMAC: sha256(orderId|paymentId, RAZORPAY_KEY_SECRET)
     ├─ Compare with webhook signature
     └─ Reject if mismatch
  3. If valid:
     ├─ Fetch order from Razorpay API
     ├─ Verify payment status
     ├─ Find tenant by receipt (contains tenantId)
     ├─ Update subscription:
     │  └─ status = 'active'
     │  └─ currentPeriodEnd = Date + 30 days
     ├─ Create invoice in MongoDB
     └─ Send confirmation email
  4. Return { received: true }
}
```

**Signature Verification:**
```javascript
verifyRazorpayPayment(orderId, paymentId, signature) {
  const body = orderId + '|' + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  
  return expectedSignature === signature;
}
```

---

## Subscription State Machine

### States and Transitions

```
┌─────────────┐
│    TRIAL    │  (14 days free)
└──────┬──────┘
       │ User subscribes
       ↓
┌─────────────┐
│  TRIALING   │  (on Stripe, before first payment)
└──────┬──────┘
       │ Payment confirmed
       ↓
┌─────────────┐
│   ACTIVE    │  (full access, auto-renewal enabled)
└──────┬──────┘
       │
       ├─ Payment fails → PAST_DUE
       ├─ User upgrades → ACTIVE (prorated)
       ├─ User cancels → CANCELED
       └─ Renewal → ACTIVE
       ↓
┌─────────────┐
│  PAST_DUE   │  (payment failed, retry after 7 days)
└──────┬──────┘
       │
       ├─ Payment succeeds → ACTIVE
       └─ Grace period expired → CANCELED
       ↓
┌─────────────┐
│  CANCELED   │  (reverted to trial)
└─────────────┘
```

### Status Tracking in Database

```javascript
Tenant document:
{
  _id: ObjectId,
  name: string,
  email: string,
  plan: 'trial' | 'basic' | 'pro' | 'enterprise',
  
  subscription: {
    id: string,            // Stripe sub_xxx or Razorpay order_xxx
    status: 'trialing' | 'active' | 'past_due' | 'canceled',
    currentPeriodEnd: Date,
    canceledAt: Date       // null if active
  },
  
  stripeCustomerId: string,    // For recurring charges
  trialEndAt: Date,
  
  usage: {
    invoiceCount: number,
    apiCallsThisMonth: number,
    activeUsers: number,
    storageMB: number
  }
}
```

---

## Usage Metering & Rate Limiting

### Recording Usage

**Endpoint:** `POST /api/billing/usage`

**When to record:**
- Invoice created → increment `invoiceCount`
- API call made → increment `apiCallsThisMonth`
- User logs in → update `activeUsers`
- File uploaded → increment `storageMB`

**Request:**
```json
{
  "metric": "invoiceCount",
  "count": 1
}
```

**Process:**
```javascript
async recordUsage(tenantId, metric, count) {
  1. Fetch tenant
  2. Update usage counter:
     if (metric === 'invoiceCount') tenant.usage.invoiceCount += count
     else if (metric === 'apiCallsThisMonth') tenant.usage.apiCallsThisMonth += count
     else if (metric === 'activeUsers') tenant.usage.activeUsers = Math.max(...)
     else if (metric === 'storageMB') tenant.usage.storageMB += count
  3. Save tenant
  4. Return updated usage
}
```

---

### Checking Usage Limits

**Endpoint:** `GET /api/billing/usage`

**Response:**
```json
{
  "plan": "pro",
  "current": {
    "invoiceCount": 45,
    "apiCallsThisMonth": 12000,
    "activeUsers": 3,
    "storageMB": 2500
  },
  "limits": {
    "invoiceCount": 1000,
    "apiCallsThisMonth": 50000,
    "activeUsers": 50,
    "storageMB": 102400
  },
  "percentageUsed": {
    "invoiceCount": 4.5,
    "apiCallsThisMonth": 24.0,
    "activeUsers": 6.0,
    "storageMB": 2.4
  },
  "warnings": []
}
```

---

### Rate Limiting by Plan

**Middleware:** `rateLimitTenant()`

**Plan Limits:**
```javascript
planLimits = {
  trial: { requests: 100, window: 3600 },        // 100/hour
  basic: { requests: 1000, window: 3600 },       // 1000/hour
  pro: { requests: 10000, window: 3600 },        // 10000/hour
  enterprise: { requests: 100000, window: 3600 } // 100000/hour
}
```

**Rate Limit Check:**
```javascript
rateLimitTenant() {
  1. Extract plan from req.tenant
  2. Get limits for plan
  3. Create rate limit key: 'ratelimit:tenant:{tenantId}'
  4. Check Redis (or in-memory store)
     ├─ Current count in sliding window
     ├─ If count >= limit → return 429 Too Many Requests
     └─ Else → continue
  5. Set response headers:
     - X-RateLimit-Limit: 1000
     - X-RateLimit-Current: 45
     - X-RateLimit-ResetAt: 1678108800
}
```

**Response Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Current: 45
X-RateLimit-ResetAt: 1678108800
```

---

## Plan Management

### Get Available Plans

**Endpoint:** `GET /api/billing/plans`

**Response:**
```json
{
  "plans": {
    "trial": {
      "name": "trial",
      "price": 0,
      "currency": "usd",
      "interval": null,
      "description": "14-day free trial"
    },
    "basic": {
      "name": "basic",
      "price": 2999,
      "currency": "usd",
      "interval": "month",
      "description": "Basic Plan - $29.99/month"
    },
    ...
  }
}
```

---

### Get Subscription Status

**Endpoint:** `GET /api/billing/subscription`

**Response:**
```json
{
  "plan": "pro",
  "status": "active",
  "currentPeriodEnd": "2026-04-07T00:00:00Z",
  "trialEndAt": null,
  "usage": {
    "invoiceCount": 45,
    "apiCallsThisMonth": 12000,
    "activeUsers": 3,
    "storageMB": 2500
  }
}
```

---

## Plan Changes (Upgrade/Downgrade)

**Endpoint:** `POST /api/billing/change-plan`

**Request:**
```json
{
  "newPlanName": "enterprise"
}
```

**Process (Stripe):**
```javascript
async changePlan(tenantId, newPlanName) {
  1. Fetch tenant and verify active subscription
  2. Get price for new plan
  3. Update subscription in Stripe:
     {
       items: [{ id: 'si_xxx', price_data: { ... } }],
       proration_behavior: 'create_prorations'
     }
  4. Stripe auto-calculates prorated charge/credit:
     - If upgrading: charge difference for remaining cycle
     - If downgrading: credit difference to account
  5. Update Tenant.plan
  6. Return updated subscription with prorated amount
}
```

**Response:**
```json
{
  "message": "Plan changed successfully",
  "plan": "enterprise",
  "subscription": {
    "id": "sub_xxx",
    "status": "active",
    "current_period_end": 1234567890,
    "items": [
      {
        "billing_cycle_anchor": 1234567890,
        "billing_thresholds": null,
        "created": 1234567890,
        "price": { ... }
      }
    ]
  }
}
```

---

## Cancellation

**Endpoint:** `POST /api/billing/cancel`

**Process:**
```javascript
async cancelSubscription(tenantId) {
  1. Fetch tenant with active subscription
  2. Cancel in Stripe:
     await stripe.subscriptions.del(subscription.id)
  3. Update Tenant:
     {
       plan: 'trial',
       subscription: {
         status: 'canceled',
         canceledAt: new Date()
       }
     }
  4. Access revoked effective immediately
     (or at currentPeriodEnd based on policy)
  5. Send cancellation confirmation email
}
```

**Response:**
```json
{
  "message": "Subscription canceled",
  "plan": "trial",
  "subscription": {
    "status": "canceled",
    "canceledAt": "2026-03-07T12:30:00Z"
  }
}
```

---

## Invoicing

### Invoice Document Schema

```javascript
Invoice {
  _id: ObjectId,
  tenantId: ObjectId,
  invoiceNo: string,          // INV-2026030712301234
  
  amount: number,             // Total amount in cents
  currency: string,           // 'usd' or 'inr'
  
  status: 'draft' | 'open' | 'paid' | 'void',
  
  lineItems: [{
    description: string,      // Plan name, usage charges, etc.
    quantity: number,
    unitPrice: number,
    totalPrice: number
  }],
  
  subscription: {
    id: string,
    planName: string,
    periodStart: Date,
    periodEnd: Date
  },
  
  discounts: [{
    code: string,
    amount: number,
    description: string
  }],
  
  taxAmount: number,
  
  paidAt: Date,
  dueDate: Date,
  
  stripeInvoiceId: string,    // Reference to Stripe
  
  pdfUrl: string,             // S3 or CDN URL
  
  createdAt: Date,
  updatedAt: Date
}
```

### Get Invoices

**Endpoint:** `GET /api/billing/invoices?status=paid&limit=20&page=1`

**Response:**
```json
{
  "invoices": [
    {
      "_id": "inv_xxx",
      "invoiceNo": "INV-20260307-001",
      "amount": 7999,
      "currency": "usd",
      "status": "paid",
      "paidAt": "2026-03-07T10:30:00Z",
      "lineItems": [
        {
          "description": "Pro Plan",
          "quantity": 1,
          "unitPrice": 7999,
          "totalPrice": 7999
        }
      ]
    }
  ],
  "pagination": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

### Get Specific Invoice

**Endpoint:** `GET /api/billing/invoices/:invoiceId`

**Response:**
```json
{
  "_id": "inv_xxx",
  "invoiceNo": "INV-20260307-001",
  "tenantId": "tenant_xxx",
  "amount": 7999,
  "currency": "usd",
  "status": "paid",
  "lineItems": [...],
  "paidAt": "2026-03-07T10:30:00Z",
  "pdfUrl": "https://s3.amazonaws.com/invoices/inv_xxx.pdf",
  "createdAt": "2026-03-07T09:00:00Z"
}
```

---

## Environment Variables

Create a `.env` file with:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx
STRIPE_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx

# Razorpay Configuration (optional)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx

# Application
MONGO_URI=mongodb://localhost:27017/aicoding
REDIS_URL=redis://localhost:6379
PORT=4000
```

---

## API Endpoints Summary

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/billing/plans` | GET | Get available plans | Public |
| `/api/billing/subscription` | GET | Check subscription status | Private |
| `/api/billing/subscribe` | POST | Create new subscription | Private |
| `/api/billing/change-plan` | POST | Upgrade/downgrade plan | Private |
| `/api/billing/cancel` | POST | Cancel subscription | Private |
| `/api/billing/usage` | GET | Check usage & limits | Private |
| `/api/billing/usage` | POST | Record usage metric | Private |
| `/api/billing/invoices` | GET | List invoices (paginated) | Private |
| `/api/billing/invoices/:id` | GET | Get specific invoice | Private |
| `/api/billing/webhook/stripe` | POST | Stripe webhook handler | Public* |
| `/api/billing/webhook/razorpay` | POST | Razorpay webhook handler | Public* |

*Public endpoints but require signature verification

---

## Testing the Payment Flow

### Test Stripe Subscription

```bash
# 1. Start both servers
npm run dev        # Terminal 1: Backend
npm run dev        # Terminal 2: Frontend

# 2. Navigate to http://localhost:3000/subscribe?plan=pro

# 3. Fill checkout form with test card:
Card Number: 4242 4242 4242 4242
Expiry: 12/26
CVC: 123

# 4. Check database for subscription creation
db.tenants.findOne({ email: "test@example.com" })

# 5. Verify webhook in Stripe Dashboard
# Settings → Webhooks → Recent events
```

### Test Razorpay Subscription

```bash
# 1. Switch gateway to Razorpay in frontend

# 2. Use test credentials from Razorpay dashboard

# 3. Complete payment with test UPI/card

# 4. Verify webhook callback handling:
# POST /api/billing/webhook/razorpay
# with orderId, paymentId, signature

# 5. Check tenant subscription updated in DB
```

---

## Error Handling

### Common Errors

| Scenario | Status | Response |
|----------|--------|----------|
| Invalid plan | 400 | `{ message: "Invalid plan" }` |
| Already subscribed | 400 | `{ message: "Already have active subscription" }` |
| Payment failed | 402 | `{ message: "Payment declined" }` |
| Rate limit exceeded | 429 | `{ message: "Too many requests" }` |
| Subscription not found | 404 | `{ message: "Subscription not found" }` |
| Invalid signature | 401 | `{ message: "Invalid webhook signature" }` |

---

## Security Considerations

1. **PCI Compliance**: Never log card details; use Stripe/Razorpay tokenization
2. **Webhook Verification**: Always verify signature before processing
3. **Idempotency**: Webhook handlers should be idempotent (handle duplicate events)
4. **Rate Limiting**: Implemented per-tenant to prevent abuse
5. **CORS**: Frontend domain must be whitelisted for Stripe requests
6. **Environment Variables**: Never commit secrets; use `.env.local` or secrets manager

---

## Monitoring & Debugging

### Logs to Check

```bash
# Stripe subscription creation
tail -f logs/billing.log | grep "subscription"

# Failed payments
tail -f logs/billing.log | grep "payment_failed"

# Rate limit violations
tail -f logs/ratelimit.log | grep "429"

# Usage metering
tail -f logs/usage.log | grep "recordUsage"
```

### Dashboard Checks

1. **Stripe Dashboard**
   - Subscriptions tab → View active/past due subscriptions
   - Invoices tab → Generated invoices and payment status
   - Webhooks tab → Event logs and failures

2. **Razorpay Dashboard**
   - Orders → Order status and payment details
   - Payments → Payment transaction logs
   - Webhooks → Event delivery logs

3. **MongoDB**
   - Check `tenants` collection for subscription fields
   - Check `invoices` collection for payment records
