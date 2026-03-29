# Billing & Subscription Lifecycle Flow

## 📋 Overview

This document explains the complete subscription lifecycle from trial to paid to cancellation, covering both Stripe and Razorpay payment gateways.

**⚠️ Important:** The billing system is undergoing a 6-phase migration (see [SUBSCRIPTION_REDESIGN_SPEC.md](../../SUBSCRIPTION_REDESIGN_SPEC.md)). This document covers:
- ✅ Current state (Phase 0 - Tenant-embedded subscription)
- 🚧 Migration path (Phase 1-6 - TenantPlan model)
- 🎯 Target state (designed but not fully implemented)

---

## 🎯 Billing Architecture Evolution

### **Current (Phase 0) - Embedded State**

```javascript
Tenant {
  plan: "trial" | "basic" | "pro" | "enterprise",
  subscription: {
    stripeId: "sub_...",
    razorpayId: "order_...",
    status: "active" | "canceled" | "past_due",
    currentPeriod: { start, end }
  },
  usage: { apiCalls, invoices, users, storage },
  stripeCustomerId: "cus_...",
}
```

**Pros:** Simple, single-document lookup
**Cons:** No history, usage tied to tenant (not subscription period), no invoice trail

---

### **Target (Phase 1+) - Normalized Models**

```javascript
// Current state (single row active)
TenantPlan {
  tenantId,
  planId,
  status,
  gatewaySubscriptionId,
  currentPeriodStart, currentPeriodEnd,
  usage: { apiCalls, invoices, users, storage },
}

// Historical records (append-only)
TenantInvoice { tenantId, tenantPlanId, amount, status, paidAt, ... }
TenantTransaction { tenantId, gateway, type, amount, status, ... }
```

**Pros:** History tracked, usage per billing period, proper accounting
**Cons:** More complex, need joins (but that's fine with MongoDB references)

---

## 📊 Subscription States

| State | Description | Transition Triggers |
|-------|-------------|---------------------|
| **trialing** | 14-day free trial | `signup` → trial |
| **active** | Paid subscription, current | Checkout completed, webhook activation |
| **past_due** | Payment failed, retrying | `invoice.payment_failed` webhook |
| **canceling** | Canceled but still in paid period | User clicks "Cancel" (cancelAtPeriodEnd = true) |
| **canceled** | No longer active | Period ends after canceling |
| **incomplete** | Checkout started but payment incomplete | `checkout.session.incomplete` |
| **suspended** | Manually suspended by admin | Admin action |

---

## 🔄 Lifecycle Diagram

```mermaid
stateDiagram-v2
    [*] --> Trial: Signup

    Trial --> Active: Checkout (paid) + webhook
    Trial --> Expired: 14 days passed

    Active --> Canceling: User cancels (at period end)
    Active --> PastDue: Payment fails
    Active --> Active: Plan upgrade/downgrade

    Canceling --> Canceled: Period ends
    Canceling --> Active: User cancels cancellation

    PastDue --> Active: Retry succeeds
    PastDue --> Canceled: Retries exhausted

    Expired --> Active: User upgrades

    Canceled --> Active: Resubscribe

    note of Active: Normal running state
    note of Trial: Free 14 days
    note of Canceling: Access until period end
```

---

## 🕐 Current Implementation Flow

### **1. Signup → Trial**

**From:** [03-registration-flow.md](03-registration-flow.md)

**Backend creates:**
```javascript
const trialEndsAt = new Date();
trialEndsAt.setDate(trialEndsAt.getDate() + 14);

const tenantPlan = new TenantPlan({
  tenantId: tenant._id,
  planId: trialPlan._id,
  status: 'trialing',
  startDate: now,
  endDate: trialEndsAt,
  currentPeriodEnd: trialEndsAt,
  renewalInterval: 'monthly',
  usage: { apiCalls: 0, invoiceCount: 0, activeUsers: 1, storageMB: 0 },
});
```

**User sees on dashboard:**
```
💳 Current Plan: Free Trial
Trial expires in 13 days (2024-03-29)
[Upgrade to Basic $29/mo]
```

---

### **2. User Clicks "Upgrade" → Checkout**

**Frontend:** Dashboard → "Upgrade" button → `/checkout/:planSlug`

**Route:** `CheckoutPage.jsx`

**Flow:**
```
1. User selects plan (Basic/Pro/Enterprise)
2. Calls POST /api/billing/create-checkout-session
3. Backend creates Stripe Checkout Session
4. Redirects user to Stripe-hosted payment page
5. User enters card details, pays
6. Stripe redirects to webhook (async) → update subscription
7. Stripe redirects to frontend (/checkout/success or /cancel)
```

---

### **3. Create Checkout Session**

**Endpoint:** `POST /api/billing/create-checkout-session`

**Controller:** `billingController.js:createCheckoutSession`

```javascript
exports.createCheckoutSession = async (req, res) => {
  const { planSlug } = req.body;
  const tenantId = req.tenantId;
  const userId = req.userId;

  // 1. Load plan
  const plan = await Plan.findOne({ slug: planSlug, isActive: true });
  if (!plan) return res.status(404).json({ message: 'Plan not found' });

  // 2. Load tenant
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

  // 3. Delegate to BillingService
  try {
    const session = await BillingService.createCheckoutSession({
      tenantId,
      userId,
      planSlug: plan.slug,
      planName: plan.name,
      planPrice: plan.price,
      successUrl: `${process.env.FRONTEND_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.FRONTEND_URL}/checkout/cancel`,
      metadata: {
        tenantId: tenant._id.toString(),
        userId: userId.toString(),
        planSlug: plan.slug,
      }
    });

    res.json({
      sessionId: session.id,
      url: session.url,
      plan: { slug: plan.slug, name: plan.name, price: plan.price }
    });
  } catch (err) {
    console.error('Checkout session error:', err);
    res.status(500).json({ message: 'Failed to create checkout session' });
  }
};
```

---

### **4. BillingService.createCheckoutSession (Stripe)**

**File:** `BACKEND/src/services/BillingService.js` (~1600 lines)

**Method:**
```javascript
async createCheckoutSession({ tenantId, userId, planSlug, planName, planPrice, successUrl, cancelUrl, metadata }) {
  // 1. Get or create Stripe customer
  let customerId = tenant.stripeCustomerId;
  if (!customerId) {
    const customer = await this.stripe.customers.create({
      email: tenant.email,
      name: tenant.name,
      metadata: { tenantId, userId }
    });
    customerId = customer.id;
    await Tenant.findByIdAndUpdate(tenantId, { stripeCustomerId: customerId });
  }

  // 2. Create Stripe checkout session
  const session = await this.stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: this._getCurrency(tenant),
        product_data: { name: planName },
        unit_amount: planPrice * 100,  // Stripe uses cents
        recurring: plan.cycleType === 'monthly' ? { interval: 'month' } : { interval: 'year' }
      },
      quantity: 1,
    }],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    allow_promotion_codes: true,
  });

  return session;
}
```

**Returns:** `{ id, url, payment_status }`

**Frontend redirects:** `window.location.href = session.url`

---

### **5. User Pays on Stripe**

- Stripe collects payment (card details on Stripe domain)
- If success: `checkout.session.completed` event sent to webhook
- If cancel: redirect to `/checkout/cancel`

---

### **6. Stripe Webhook Processing** (CRITICAL)

**Endpoint:** `POST /api/billing/webhook/stripe`

**Setup:** Express raw body parser, verify signature

```javascript
exports.stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Route event to handler
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object);
      break;
    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event.data.object);
      break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};
```

---

### **7. Checkout Session Completed**

**Handler:** `BillingService.handleCheckoutSessionCompleted(session)`

**Logic:**
```javascript
async handleCheckoutSessionCompleted(session) {
  const tenantId = session.metadata.tenantId;
  const userId = session.metadata.userId;
  const planSlug = session.metadata.planSlug;

  // 1. Get subscription from Stripe
  const subscription = await this.stripe.subscriptions.retrieve(session.subscription);

  // 2. Create or update TenantPlan
  const plan = await Plan.findOne({ slug: planSlug });

  const tenantPlan = new TenantPlan({
    tenantId: mongoose.Types.ObjectId(tenantId),
    planId: plan._id,
    status: this._mapSubscriptionStatus(subscription.status, subscription.cancel_at_period_end),
    gateway: 'stripe',
    gatewayCustomerId: session.customer,
    gatewaySubscriptionId: subscription.id,
    startDate: new Date(subscription.current_period_start * 1000),
    endDate: new Date(subscription.current_period_end * 1000),
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    nextBillingDate: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    renewalInterval: plan.cycleType === 'yearly' ? 'yearly' : 'monthly',
    usage: {
      apiCallsThisMonth: 0,
      invoiceCount: 0,
      activeUsers: 1,
      storageMB: 0,
    },
    metadata: {
      stripeSubscriptionId: subscription.id,
      planName: plan.name,
      planPrice: plan.price,
    },
  });

  await tenantPlan.save();

  // 3. Update Tenant's active_tenant_plan_id (for quick lookup)
  await Tenant.findByIdAndUpdate(tenantId, {
    activeTenantPlanId: tenantPlan._id,
    stripeCustomerId: session.customer,
    stripePlanId: subscription.id,
    status: 'active',  // Ensure active
  });

  // 4. Log activity
  await ActivityLogger.log(userId, 'SUBSCRIPTION_ACTIVATED', 'TenantPlan', tenantPlan._id, {}, { plan: plan.name });
}
```

**Result:** TenantPlan created, Tenant points to it, subscription is active.

---

### **8. Dashboard Shows "Active"**

Frontend calls `GET /api/billing/subscription`:

```javascript
// billingController.js:getSubscription
exports.getSubscription = async (req, res) => {
  const tenant = await Tenant.findById(req.tenantId);
  const tenantPlan = await TenantPlan.findOne({ tenantId: req.tenantId, status: { $in: ['active', 'trialing', 'past_due'] } }).sort({ createdAt: -1 });
  const plan = await Plan.findById(tenantPlan.planId);

  res.json({
    plan: plan.slug,
    planName: plan.name,
    status: tenantPlan.status,
    currentPeriodStart: tenantPlan.currentPeriodStart,
    currentPeriodEnd: tenantPlan.currentPeriodEnd,
    nextBillingDate: tenantPlan.nextBillingDate,
    cancelAtPeriodEnd: tenantPlan.cancelAtPeriodEnd,
    gateway: tenantPlan.gateway,
    usage: tenantPlan.usage,
    limits: plan.limits,
  });
};
```

**Response:**
```json
{
  "plan": "basic",
  "planName": "Basic",
  "status": "active",
  "currentPeriodEnd": "2024-04-15T10:00:00Z",
  "nextBillingDate": "2024-04-15T10:00:00Z",
  "cancelAtPeriodEnd": false,
  "usage": { "apiCallsThisMonth": 1250, "invoiceCount": 15, "activeUsers": 2, "storageMB": 234 },
  "limits": { "apiCalls": 1000, "invoices": 200, "users": 3, "storageMB": 5000 }
}
```

---

### **9. Recurring Billing**

Stripe automatically:
1. Creates invoice 1 hour before `nextBillingDate`
2. Attempts payment
3. Sends webhook: `invoice.payment_succeeded` or `invoice.payment_failed`

**Payment Succeeded:**
- Update `TenantPlan.currentPeriodEnd` +30 days (or yearly)
- Increment billing cycle count (track renewals)
- Create `TenantInvoice` record (paid)
- Reset usage counters? No, usage accumulates month-over-month, but could snapshot at renewal

**Payment Failed:**
- Set `TenantPlan.status = 'past_due'`
- Send email to tenant admin (future)
- Retry Stripe dunning schedule (3 retries over 7 days)
- After 3 failures → subscription canceled automatically by Stripe

---

### **10. Plan Change (Upgrade/Downgrade)**

**Endpoint:** `POST /api/billing/change-plan`

**Frontend:** Dashboard → "Change Plan" modal → select new plan

**Backend:**
```javascript
exports.changePlan = async (req, res) => {
  const { newPlanName } = req.body;
  const tenant = await Tenant.findById(req.tenantId);
  const tenantPlan = await TenantPlan.findOne({ tenantId: req.tenantId, status: 'active' });

  // 1. Load new plan
  const newPlan = await Plan.findOne({ slug: newPlanName });
  if (!newPlan) return 404;

  // 2. Calculate proration (using Stripe)
  const prorationDate = Math.floor(Date.now() / 1000);
  const items = [{
    id: tenantPlan.stripeSubscriptionItemId,  // Stripe subscription line item ID
    plan: newPlan.stripePriceId,  // Stripe price ID
    quantity: 1,
  }];

  // 3. Update Stripe subscription
  const stripeSub = await stripe.subscriptions.update(
    tenantPlan.gatewaySubscriptionId,
    {
      cancel_at_period_end: false,
      proration_date: prorationDate,
      items,
    }
  );

  // 4. Create new TenantPlan record (historical)
  const newTenantPlan = new TenantPlan({
    tenantId,
    planId: newPlan._id,
    status: 'active',
    gateway: 'stripe',
    gatewaySubscriptionId: stripeSub.id,
    startDate: new Date(),
    endDate: new Date(stripeSub.current_period_end * 1000),
    currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
    currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
    previousTenantPlanId: tenantPlan._id,
    usage: { ...tenantPlan.usage, reset: true },  // Optionally reset usage on upgrade? Probably not.
  });

  await newTenantPlan.save();
  await Tenant.findByIdAndUpdate(tenantId, { activeTenantPlanId: newTenantPlan._id });

  res.json({ success: true, newPlan: newPlan.name });
};
```

**Immediate proration:** Stripe calculates credit for unused time on old plan, charges immediately for new plan difference.

---

### **11. Cancel Subscription**

**Endpoint:** `DELETE /api/billing/subscription`

**Request:**
```json
{
  "immediate": false  // If true, cancel now; if false, at period end
}
```

**Controller:**
```javascript
exports.cancelSubscription = async (req, res) => {
  const { immediate } = req.body;
  const tenant = await Tenant.findById(req.tenantId);
  const tenantPlan = await TenantPlan.findOne({ tenantId: req.tenantId, status: 'active' });

  if (!tenantPlan) return 404;

  // 1. Update Stripe
  const stripeSub = await stripe.subscriptions.update(
    tenantPlan.gatewaySubscriptionId,
    { cancel_at_period_end: !immediate }  // true = at period end, false = immediate
  );

  if (immediate) {
    // Immediate cancellation - status = canceled now
    tenantPlan.status = 'canceled';
    tenantPlan.endedAt = new Date();
    await tenantPlan.save();
    await Tenant.findByIdAndUpdate(req.tenantId, { activeTenantPlanId: null });
  } else {
    // Cancel at period end - status = canceling
    tenantPlan.status = 'canceling';
    tenantPlan.cancelAtPeriodEnd = true;
    await tenantPlan.save();
  }

  // 2. Log
  await ActivityLogger.log(req.userId, 'SUBSCRIPTION_CANCEL', 'TenantPlan', tenantPlan._id, {}, { immediate });

  res.json({
    success: true,
    status: immediate ? 'canceled' : 'canceling',
    canceledAt: immediate ? new Date() : null,
  });
};
```

**User experience:**
- **Immediate:** Access ends now (refund prorated amount via Stripe)
- **At period end:** Can use app until `currentPeriodEnd`, then expires

---

### **12. Trial Expiry**

**How detected?**

**Option 1: Daily cron job** (not implemented)
```javascript
// Cron: Every midnight
const expiredTrials = await TenantPlan.find({
  status: 'trialing',
  endDate: { $lt: new Date() }
});

for (const plan of expiredTrials) {
  await TenantPlan.findByIdAndUpdate(plan._id, { status: 'expired' });
  await Tenant.findByIdAndUpdate(plan.tenantId, { status: 'inactive' });
  // Send email: "Your trial has expired. Please upgrade."
}
```

**Option 2: On-access check** (current approach)
`verifyTenantAccess` middleware checks:
```javascript
const tenantPlan = await getCurrentTenantPlan(tenant._id);
if (tenantPlan && isTrialExpired(tenantPlan)) {
  return res.status(403).json({
    message: 'Trial period expired. Please upgrade to a paid plan.'
  });
}
```

**Weakness:** User doesn't know they're expired until they try to use app.

**Better:** Email notification when trial expires (cron job needed).

---

## 📊 Billing Data Model (Current Phase 0)

### **Tenant Collection (Billing Fields)**
```javascript
{
  _id: ObjectId,
  name, email, phone,
  status: 'active' | 'suspended' | 'inactive',

  // Billing (legacy - to be migrated)
  stripeCustomerId: "cus_...",
  stripePlanId: "sub_...",
  plan: "trial",
  subscription: {
    stripeId: "sub_...",
    razorpayId: "order_...",
    status: "active",
    currentPeriod: { start, end }
  },
  usage: { apiCalls, invoices, users, storage },
}
```

---

### **TenantPlan Model (New Target)**

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  planId: ObjectId,  // Ref Plan catalog

  status: 'trialing' | 'active' | 'past_due' | 'canceling' | 'canceled' | 'expired',
  gateway: 'stripe' | 'razorpay',
  gatewaySubscriptionId: "sub_...",  // Stripe subscription ID
  gatewayCustomerId: "cus_...",

  startDate: Date,
  endDate: Date,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  nextBillingDate: Date,
  cancelAtPeriodEnd: Boolean,
  canceledAt: Date,
  renewalInterval: 'monthly' | 'yearly',

  usage: {
    apiCallsThisMonth: Number,
    invoiceCount: Number,
    activeUsers: Number,
    storageMB: Number,
  },

  previousTenantPlanId: ObjectId,  // For plan change history
  nextPlannedPlanId: ObjectId,     // For scheduled upgrades

  createdAt, updatedAt: Date
}
```

---

### **TenantInvoice Model (New Target)**

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  tenantPlanId: ObjectId,

  invoiceNumber: String,  // "SUB-1711699200000-1234"
  type: 'subscription' | 'overage' | 'manual' | 'adjustment' | 'proration',
  status: 'draft' | 'pending' | 'paid' | 'failed' | 'void' | 'canceled',

  currency: 'USD',
  amount: Number,       // Total amount (cents)
  subtotal: Number,
  taxAmount: Number,
  discountAmount: Number,

  billingDate: Date,    // When invoice created
  dueDate: Date,        // Payment due
  paidAt: Date,         // When payment completed

  gatewayInvoiceId: "in_...",  // Stripe invoice ID
  invoiceUrl: String,   // PDF download URL from Stripe

  lineItems: [{
    description: "Basic Plan - Monthly",
    quantity: 1,
    unitAmount: 2900,  // $29.00 in cents
    totalAmount: 2900,
    type: 'subscription'
  }],

  metadata: Mixed,
  createdAt, updatedAt: Date
}
```

---

### **TenantTransaction Model (New Target)**

```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  tenantPlanId: ObjectId,
  tenantInvoiceId: ObjectId,  // Null if no invoice (authentication attempt?)

  gateway: 'stripe' | 'razorpay',
  type: 'charge' | 'refund' | 'authorization' | 'payment_attempt' | 'webhook_event',

  gatewayTransactionId: "pi_...",   // Stripe PaymentIntent ID
  gatewayPaymentIntentId: "pi_...",
  gatewayOrderId: "order_...",      // Razorpay order ID

  amount: Number,
  currency: 'USD',

  status: 'pending' | 'success' | 'failed' | 'refunded' | 'canceled',
  failureCode: "card_declined",
  failureMessage: "Your card was declined.",

  idempotencyKey: "unique-key",  // Prevent duplicate processing
  rawEventRef: "evt_...",         // Stripe event ID for traceability

  processedAt: Date,
  createdAt, updatedAt: Date
}
```

---

## 🔄 Migration Strategy (6 Phases)

**See [SUBSCRIPTION_REDESIGN_SPEC.md](../../SUBSCRIPTION_REDESIGN_SPEC.md) for complete details.**

### **Phase 0 → Phase 1: Add New Models**
- Create `TenantPlan`, `TenantInvoice`, `TenantTransaction` models
- No deletion of old fields (`Tenant.plan`, `Tenant.subscription`, `Tenant.usage`)
- Keep both systems running in parallel

### **Phase 2: Backfill**
- For each existing tenant:
  - Read `Tenant.plan` + `Tenant.subscription`
  - Create corresponding `TenantPlan` (historical)
  - Backfill `Invoice` → `TenantInvoice`
- Proof: `TenantPlan.count() === Tenant.count()`

### **Phase 3: Dual-Write**
- `BillingService` writes to both old (Tenant) and new (TenantPlan, TenantInvoice) models
- All reads still from old fields for compatibility
- Verify new data matches old data

### **Phase 4: Read Adapter**
- Change `BillingService.getSubscription()` to read from `TenantPlan` instead of `Tenant.subscription`
- Keep writing to both until verified
- Frontend API response unchanged (adapter layer)

### **Phase 5: Promote New Models**
- All billing reads use `TenantPlan` as source of truth
- All invoice queries use `TenantInvoice`
- Webhooks write to `TenantTransaction` with idempotency checks

### **Phase 6: Deprecate Legacy**
- Remove `Tenant.plan`, `Tenant.subscription`, `Tenant.usage` fields
- Update all controllers to use new models directly
- Clean up old code paths

**Timeline:** 4-8 weeks for full migration (assuming 2-3 engineers)

---

## 🧪 Testing Billing Flows

### **Test 1: Trial Signup**
```bash
curl -X POST /api/auth/signup -d '{"planSlug":"trial",...}'
# → TenantPlan status = "trialing"
# → endDate = now + 14 days
```

### **Test 2: Checkout Session Creation**
```bash
TOKEN=$(login as owner)

curl -X POST /api/billing/create-checkout-session \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"planSlug":"basic"}'

# Expected: { sessionId, url, plan }
```

### **Test 3: Stripe Webhook (Simulated)**
```bash
# Use Stripe CLI to forward webhook to localhost
stripe listen --forward-to localhost:4000/api/billing/webhook/stripe

# Trigger test event
stripe trigger checkout.session.completed

# Check DB:
# - TenantPlan created with status "active"
# - Tenant.activeTenantPlanId updated
# - Invoice created (if applicable)
```

---

## 🔐 Security Considerations

1. **Idempotency**: Stripe webhooks may duplicate. Use `gatewaySubscriptionId` and `gatewayInvoiceId` to deduplicate.
2. **Signature verification**: Stripe webhook signature MUST be verified (using `STRIPE_WEBHOOK_SECRET`).
3. **Access control**: Only owner/accountant can call billing endpoints (`authorize('Billing', '*')`).
4. **PCI compliance**: No card data touches our servers (Stripe handles).
5. **Tenant isolation**: Billing data filtered by `tenantId` in all queries.

---

## 🐛 Known Issues

1. **Razorpay recurring subscriptions not fully implemented** - Only one-time orders exist
2. **Invoice PDF generation not implemented** - `Invoice` model has no PDF generation
3. **Usage reset on renewal not implemented** - Usage counters accumulate forever
4. **No dunning emails** - When payment fails, no customer notification
5. **No trial expiry email** - User surprised by expiration
6. **Frontend-backend contract drift** - CheckoutPage doesn't use standard `billingAPI` methods

---

## 📚 Related Documents

- [SUBSCRIPTION_REDESIGN_SPEC.md](../../SUBSCRIPTION_REDESIGN_SPEC.md) - Complete migration spec
- [PAYMENT_FLOW.md](../../PAYMENT_FLOW.md) - Legacy payment documentation (partially stale)
- [02-request-flow.md](02-request-flow.md) - Webhook handling in request flow
- [11-webhook-flow.md](11-webhook-flow.md) - Detailed webhook processing

---

**Next:** [08-payment-gateways.md](08-payment-gateways.md) - Stripe & Razorpay integration details
