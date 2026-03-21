# Payment Flow Readiness Analysis and Migration Spec

## Summary

This document audits the current subscription and payment implementation in the repo and defines a migration-ready target architecture for a production-grade SaaS billing system with `Stripe + Razorpay`.

The repo is technically ready for a redesign because the foundations already exist:

- active plan catalog via `Plan`
- tenant-scoped subscription and usage state on `Tenant`
- billing orchestration in `BillingService` and `billingController`
- invoice persistence via `Invoice`
- webhook entry points for Stripe and Razorpay
- frontend billing surfaces in dashboard, checkout, and API client

However, this is not a small schema swap. Billing state is currently embedded across `Tenant`, `BillingService`, `billingController`, dashboard plan UI, checkout flow, and usage metering. A staged migration is required.

## Current Implementation Truth

### Current source of truth

The current billing model is tenant-centric.

- `Tenant.plan` stores the current plan slug.
- `Tenant.subscription` stores the current subscription snapshot.
- `Tenant.usage` stores metering counters directly on the tenant.
- `Tenant.stripeCustomerId` stores the Stripe customer reference.
- `Plan` stores plan catalog metadata and feature limits.
- `Invoice` exists as a persisted billing record model.

### Active backend orchestration

The current payment and subscription flow is driven by:

- `BACKEND/src/services/BillingService.js`
- `BACKEND/src/controllers/billingController.js`
- `BACKEND/src/routes/billingRoutes.js`

Current supported backend capabilities:

- list active plans
- get current subscription status
- create Stripe checkout session
- verify completed Stripe checkout session
- cancel subscription immediately or at period end
- switch between free plans without checkout
- list tenant invoices
- read a tenant invoice
- record and check usage limits
- accept Stripe and Razorpay webhooks

### Current frontend usage

Current frontend billing surfaces include:

- `FRONTEND/src/services/api.js` for billing API methods
- `FRONTEND/src/pages/Dashboard.jsx` for current plan, cancellation, and plan selection UX
- `FRONTEND/src/pages/CheckoutSuccess.jsx` and `FRONTEND/src/pages/CheckoutCancel.jsx`
- `FRONTEND/src/pages/CheckoutPage.jsx`

The dashboard is aligned with the current backend contract for:

- `/api/billing/plans`
- `/api/billing/subscription`
- `/api/billing/change-plan`
- `/api/billing/cancel`
- `/api/billing/checkout-status`

There is also current implementation drift:

- `PAYMENT_FLOW.md` describes flows and endpoints that do not fully match the live code
- `CheckoutPage.jsx` still references older direct `billingAPI.get(...)` and `billingAPI.post(...)` usage patterns that are not part of the current `billingAPI` helper shape
- invoice persistence exists, but it is not the authoritative recurring billing ledger yet

## Current Gaps

The following gaps are present in the current implementation:

- No dedicated subscription-history model exists.
- No dedicated payment-attempt or transaction model exists.
- No normalized recurring billing ledger exists.
- No clean audit trail exists for upgrades, retries, cancellations, and gateway lifecycle events.
- Plan state is duplicated between `Tenant.plan` and `Tenant.subscription.planSlug`.
- Usage is coupled directly to `Tenant` instead of a subscription-period record.
- `Invoice` exists, but it is not the authoritative recurring billing abstraction.
- Razorpay exists only as order creation and signature verification plumbing, not as a full recurring subscription lifecycle.
- Current Stripe lifecycle updates mutate tenant snapshot state directly, which makes historical reconstruction difficult.
- The checkout-related frontend is partially inconsistent with current backend route contracts.

## Readiness Conclusion

### Are we good to go?

Yes, the repo is good to go for a redesign, but only through a staged migration.

### Why the repo is ready

- `Plan` already provides the commercial catalog.
- `Tenant` already contains enough current-state billing metadata to backfill a new subscription layer.
- `Invoice` already provides a starting point for billing record migration.
- `BillingService` already centralizes most subscription logic.
- Stripe webhook and Razorpay webhook entry points already exist.
- Frontend already consumes subscription, plan, invoice, and cancellation data.

### Why a direct cutover is not safe

- subscription state is embedded directly on `Tenant`
- usage state is embedded directly on `Tenant`
- current invoice model does not yet model full transaction attempts
- transaction history is missing entirely
- some docs and some checkout code are stale relative to live APIs

The safest path is to add the new billing domain models first, backfill from current tenant snapshot state, and keep existing API contracts stable during phase 1.

## Target Architecture

### Tenant

`Tenant` should keep only the current commercial snapshot and account identity.

Recommended responsibilities:

- business identity and account state
- current plan snapshot for fast reads
- active subscription pointer
- primary admin and settings
- optional derived billing summary fields only if needed for performance

Recommended commercial fields:

- `current_plan_id`
- `active_tenant_plan_id`
- optional summary usage snapshot if needed for dashboard speed

Legacy fields to deprecate after migration parity:

- `plan`
- `subscription`
- `usage`

### TenantPlan

`TenantPlan` becomes the subscription lifecycle source of truth.

Proposed schema:

```js
TenantPlan {
  _id: ObjectId,
  tenantId: ObjectId,
  planId: ObjectId,
  status: 'trialing' | 'active' | 'past_due' | 'canceling' | 'canceled' | 'expired' | 'incomplete' | 'suspended',
  gateway: 'stripe' | 'razorpay' | null,
  gatewaySubscriptionId: String,
  gatewayCustomerId: String,
  startDate: Date,
  endDate: Date,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  nextBillingDate: Date,
  cancelAtPeriodEnd: Boolean,
  canceledAt: Date,
  endedAt: Date,
  renewalInterval: 'monthly' | 'yearly' | 'one-time' | 'free',
  previousTenantPlanId: ObjectId,
  nextPlannedPlanId: ObjectId,
  usage: {
    invoiceCount: Number,
    apiCallsThisMonth: Number,
    activeUsers: Number,
    storageMB: Number
  },
  metadata: Mixed,
  createdAt: Date,
  updatedAt: Date
}
```

Recommended indexes:

```js
{ tenantId: 1, createdAt: -1 }
{ tenantId: 1, status: 1 }
{ tenantId: 1, currentPeriodEnd: 1 }
{ gateway: 1, gatewaySubscriptionId: 1 }
```

Responsibilities:

- current active subscription state
- historical subscription records
- upgrade and downgrade lineage
- billing period ownership
- usage ownership per subscription period

### TenantInvoice

`TenantInvoice` becomes the billing-period and charge-record source of truth.

Note: the current `Invoice` model can either be evolved into this shape or wrapped by an adapter in phase 1. The migration spec assumes logical separation even if the physical collection is initially reused.

Proposed schema:

```js
TenantInvoice {
  _id: ObjectId,
  tenantId: ObjectId,
  tenantPlanId: ObjectId,
  invoiceNumber: String,
  type: 'subscription' | 'overage' | 'manual' | 'adjustment' | 'proration',
  status: 'draft' | 'pending' | 'paid' | 'failed' | 'void' | 'canceled',
  currency: String,
  amount: Number,
  subtotal: Number,
  taxAmount: Number,
  discountAmount: Number,
  billingDate: Date,
  dueDate: Date,
  paidAt: Date,
  gatewayInvoiceId: String,
  invoiceUrl: String,
  lineItems: [{
    description: String,
    quantity: Number,
    unitAmount: Number,
    totalAmount: Number,
    type: String
  }],
  metadata: Mixed,
  createdAt: Date,
  updatedAt: Date
}
```

Recommended indexes:

```js
{ tenantId: 1, createdAt: -1 }
{ tenantPlanId: 1, createdAt: -1 }
{ tenantId: 1, status: 1 }
{ invoiceNumber: 1 }
{ gatewayInvoiceId: 1 }
```

Responsibilities:

- monthly or yearly billing records
- proration and adjustment visibility
- invoice download and reporting source
- accounting and reconciliation source

### TenantTransaction

`TenantTransaction` tracks payment attempts and gateway outcomes.

Proposed schema:

```js
TenantTransaction {
  _id: ObjectId,
  tenantId: ObjectId,
  tenantPlanId: ObjectId,
  tenantInvoiceId: ObjectId,
  gateway: 'stripe' | 'razorpay',
  type: 'charge' | 'refund' | 'authorization' | 'payment_attempt' | 'webhook_event',
  gatewayTransactionId: String,
  gatewayPaymentIntentId: String,
  gatewayOrderId: String,
  amount: Number,
  currency: String,
  status: 'pending' | 'success' | 'failed' | 'refunded' | 'canceled',
  failureCode: String,
  failureMessage: String,
  idempotencyKey: String,
  rawEventRef: String,
  processedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

Recommended indexes:

```js
{ tenantId: 1, createdAt: -1 }
{ tenantInvoiceId: 1, createdAt: -1 }
{ tenantPlanId: 1, createdAt: -1 }
{ gateway: 1, gatewayTransactionId: 1 }
{ gateway: 1, gatewayOrderId: 1 }
{ status: 1, createdAt: -1 }
```

Responsibilities:

- payment-attempt history
- success and failure tracking
- retry visibility
- gateway reconciliation
- event-level auditability

## Ownership and Lifecycle Rules

### Current plan pointers

- `Tenant.current_plan_id` points to the current plan catalog entry.
- `Tenant.active_tenant_plan_id` points to the active `TenantPlan`.
- `TenantPlan.planId` is the immutable historical plan reference for that lifecycle row.

### Renewal and period ownership

- `TenantPlan.currentPeriodStart` and `TenantPlan.currentPeriodEnd` define the active billing window.
- `TenantPlan.nextBillingDate` is the next expected billing attempt date.
- Usage resets belong to the active `TenantPlan` record, not the tenant root.

### Cancellation

- `cancel_at_period_end` maps to `TenantPlan.cancelAtPeriodEnd`.
- If `true`, the record stays active or canceling until `currentPeriodEnd`.
- At period end, the record transitions to `canceled` or `expired` and `Tenant.active_tenant_plan_id` is updated.

### Upgrades and downgrades

Recommended default:

- immediate upgrade with proration
- scheduled downgrade at next billing date unless explicitly immediate

Modeling rule:

- create a new `TenantPlan` record for every plan lifecycle transition
- link transitions with `previousTenantPlanId`
- optional `nextPlannedPlanId` is used for scheduled future changes

### Historical retention

- `TenantPlan`, `TenantInvoice`, and `TenantTransaction` are append-first records
- historical rows should not be overwritten except for idempotent state reconciliation
- current tenant snapshot may be updated freely because it is only a read optimization layer

### Webhook event persistence

Webhook processing should become event-backed through transaction or event references.

Minimum expectation:

- persist each gateway payment outcome through `TenantTransaction`
- persist subscription-period changes through `TenantPlan`
- persist invoice outcomes through `TenantInvoice`
- make webhook handlers idempotent using gateway IDs and stored transaction or event references

## Gateway Mapping Notes

### Stripe

Current Stripe flow already supports:

- checkout session creation
- subscription creation
- renewal success handling
- payment failure handling
- subscription update sync
- subscription deletion handling

Target mapping:

- Stripe customer ID -> `TenantPlan.gatewayCustomerId`
- Stripe subscription ID -> `TenantPlan.gatewaySubscriptionId`
- Stripe invoice ID -> `TenantInvoice.gatewayInvoiceId`
- Stripe payment or invoice outcome -> `TenantTransaction`

### Razorpay

Current Razorpay support is limited to:

- order creation
- signature verification
- webhook endpoint presence

Target mapping:

- Razorpay order ID -> `TenantTransaction.gatewayOrderId`
- Razorpay recurring subscription identifier, if adopted, -> `TenantPlan.gatewaySubscriptionId`
- each Razorpay payment attempt -> `TenantTransaction`
- invoice linkage stays internal in `TenantInvoice`

Important note:

Razorpay is not yet implemented as a true recurring subscription lifecycle in the current code. This must be built as part of the redesign and should not be assumed to match current Stripe parity.

## API and Interface Impact

### Current endpoints to preserve in phase 1

These endpoints should remain externally stable during the first migration phase:

- `GET /api/billing/plans`
- `GET /api/billing/subscription`
- `POST /api/billing/create-checkout-session`
- `GET /api/billing/checkout-status`
- `POST /api/billing/cancel`
- `POST /api/billing/change-plan`
- `GET /api/billing/invoices`
- `GET /api/billing/invoices/:invoiceId`
- `GET /api/billing/usage`
- `POST /api/billing/usage`

### Compatibility expectations

Phase 1 should preserve current frontend response expectations even if backend reads move to new models.

Examples:

- `/api/billing/subscription` should still return current plan plus active subscription snapshot
- `/api/billing/invoices` should still return tenant invoice list in the shape expected by the current frontend
- dashboard plan banner and cancellation UI should continue to work without immediate frontend rewrite

### Frontend contracts to inventory

Current frontend billing consumers that must remain compatible:

- dashboard plan and cancellation banner
- plan selection modal on dashboard
- checkout success verification flow
- checkout cancel flow
- billing API helper methods in `FRONTEND/src/services/api.js`

Important current mismatch to correct during migration:

- `CheckoutPage.jsx` is not aligned with the current helper contract and should be updated as part of the broader billing cleanup, but not before the API compatibility layer is established

## Migration Strategy

### Phase 0: Documentation and audit

- create this spec as the canonical redesign reference
- treat `PAYMENT_FLOW.md` as historical and partially stale
- inventory all current readers and writers of tenant billing state

### Phase 1: Add new models without deleting current fields

- add `TenantPlan`
- add `TenantInvoice` or adapt current `Invoice` toward that role
- add `TenantTransaction`
- keep existing `Tenant.plan`, `Tenant.subscription`, and `Tenant.usage` in place

### Phase 2: Backfill and dual-write

- backfill `TenantPlan` from `Tenant.plan` and `Tenant.subscription`
- backfill billing-period invoices from existing `Invoice` data where possible
- start dual-writing tenant snapshot plus new models from billing service operations

### Phase 3: Move reads behind service-layer adapters

- adapt `BillingService` reads to use new models as source of truth
- keep controller response shapes stable
- continue syncing tenant snapshot fields for compatibility

### Phase 4: Migrate usage ownership

- move usage tracking to active `TenantPlan`
- optionally keep summarized tenant-level counters for fast dashboard reads
- ensure renewal resets happen on active plan lifecycle, not directly on tenant root

### Phase 5: Promote new invoice and transaction sources

- make recurring invoice generation authoritative on `TenantInvoice`
- make payment attempts authoritative on `TenantTransaction`
- make webhook handlers persist state transitions idempotently

### Phase 6: Deprecate legacy tenant-embedded billing state

- remove or mark deprecated `Tenant.plan`
- remove or mark deprecated `Tenant.subscription`
- remove or mark deprecated `Tenant.usage`
- only do this after parity has been proven for reads, writes, and webhook recovery

## Risks and Open Items

- Current frontend and docs are not perfectly aligned with live billing APIs.
- Existing `Invoice` semantics may need either renaming or careful adapter logic to avoid breaking reporting.
- Stripe is closer to target-state support than Razorpay.
- Usage migration must preserve current dashboard behavior and rate-limit enforcement.
- Historical reconstruction quality depends on how much legacy invoice and subscription data already exists.

## Test and Validation Plan

The migration must cover current behavior for the following scenarios:

- initial paid subscription checkout
- webhook-driven activation
- renewal success
- payment failure
- cancel at period end
- immediate cancellation
- free-plan switch
- invoice listing
- usage reset on renewal

Compatibility coverage must include:

- existing tenants with only tenant-embedded subscription data
- existing invoices in the current `Invoice` model
- tenants with stored Stripe customer IDs
- tenants on free plans or trial plans
- gateway event replay and idempotency behavior

The final implementation should also verify:

- old API responses still satisfy dashboard and checkout consumers in phase 1
- historical `TenantPlan` records are created for plan changes
- invoice and transaction linkage remains tenant-safe and queryable
- webhook retries do not duplicate business state transitions

## Final Recommendation

Proceed with the redesign, but do it as a staged migration centered on new subscription, invoice, and transaction models.

Do not directly replace tenant-embedded billing state in one cutover. Use the new models as the authoritative domain layer, keep existing API contracts stable through adapters, and deprecate legacy tenant billing fields only after the new system has achieved feature parity and historical correctness.
