/**
 * Billing Controller
 * Subscription management with Stripe Checkout Sessions
 */

const BillingService = require('../services/BillingService');
const Tenant = require('../models/Tenant');
const Invoice = require('../models/Invoice');
const Plan = require('../models/Plan');
const TenantPlan = require('../models/TenantPlan');
const TenantInvoice = require('../models/TenantInvoice');

const mapTenantInvoiceResponse = (invoice) => {
  const raw = typeof invoice.toObject === 'function' ? invoice.toObject() : invoice;
  return {
    ...raw,
    pdfUrl: raw.invoiceUrl || raw.pdfUrl || '',
    plan: raw.metadata?.planSlug || raw.plan || '',
  };
};

const mapLegacyInvoiceResponse = (invoice) => {
  const raw = typeof invoice.toObject === 'function' ? invoice.toObject() : invoice;
  return {
    ...raw,
    pdfUrl: raw.pdfUrl || '',
    invoiceUrl: raw.pdfUrl || raw.invoiceUrl || '',
    billingSnapshot: raw.billingSnapshot || null,
  };
};

/**
 * GET /api/billing/plans (public)
 */
exports.getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ sortOrder: 1 });
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get plans', error: err.message });
  }
};

/**
 * GET /api/billing/subscription
 * Full subscription status for the current tenant
 */
exports.getSubscriptionStatus = async (req, res) => {
  try {
    const status = await BillingService.getSubscriptionStatus(req.tenantId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ message: 'Failed to get subscription status', error: err.message });
  }
};

/**
 * POST /api/billing/create-checkout-session
 * Body: { planSlug }
 * Creates a Stripe Checkout Session and returns the URL
 */
exports.createCheckoutSession = async (req, res) => {
  try {
    const { planSlug } = req.body;
    if (!planSlug) return res.status(400).json({ message: 'planSlug is required' });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const successUrl = `${clientUrl}/checkout/success`;
    const cancelUrl = `${clientUrl}/checkout/cancel`;

    const result = await BillingService.createCheckoutSession(req.tenantId, planSlug, successUrl, cancelUrl);
    res.json(result);
  } catch (err) {
    console.error('Checkout session error:', err.message);
    res.status(400).json({ message: err.message });
  }
};

/**
 * GET /api/billing/checkout-status?session_id=xxx
 * Verify a completed checkout session
 */
exports.getCheckoutStatus = async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ message: 'session_id required' });

    const result = await BillingService.verifyCheckoutSession(session_id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Failed to verify checkout', error: err.message });
  }
};

/**
 * POST /api/billing/cancel
 * Body: { immediate?: boolean }
 * Cancel the current subscription (at period end by default)
 */
exports.cancelSubscription = async (req, res) => {
  try {
    const { immediate = false } = req.body || {};
    const result = await BillingService.cancelSubscription(req.tenantId, immediate);
    res.json(result);
  } catch (err) {
    console.error('Cancel subscription error:', err.message);
    res.status(400).json({ message: err.message });
  }
};

/**
 * POST /api/billing/change-plan
 * Body: { newPlanName }
 * Only for switching between free plans (no payment required)
 * Paid plans must go through checkout flow
 */
exports.changePlan = async (req, res) => {
  try {
    const { newPlanName } = req.body;
    if (!newPlanName) return res.status(400).json({ message: 'newPlanName required' });

    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const plan = await Plan.findOne({ slug: newPlanName, isActive: true });
    if (!plan) return res.status(400).json({ message: 'Invalid plan' });

    // Paid plans require the checkout flow
    if (plan.price > 0) {
      return res.status(400).json({
        message: 'Paid plans require checkout. Use the Subscribe button to go through payment.',
        requiresCheckout: true,
      });
    }

    const currentTenantPlan = await TenantPlan.findOne({
      tenantId: req.tenantId,
      status: { $in: ['active', 'canceling', 'past_due', 'incomplete'] },
    }).sort({ createdAt: -1 });

    // Cannot switch to free/custom one-time plan if a recurring paid subscription is still active
    if (currentTenantPlan?.gatewaySubscriptionId) {
      return res.status(400).json({ message: 'Cancel your current subscription before switching plans' });
    }

    const now = new Date();
    if (currentTenantPlan) {
      currentTenantPlan.status = currentTenantPlan.status === 'trialing' ? 'expired' : 'canceled';
      currentTenantPlan.endedAt = now;
      currentTenantPlan.cancelAtPeriodEnd = false;
      await currentTenantPlan.save();
    }

    const durationDays = plan.cycleType === 'custom' ? Number(plan.customDays || 0) : plan.cycleType === 'yearly' ? 365 : 30;
    const currentPeriodEnd = durationDays ? new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000) : null;

    const tenantPlan = new TenantPlan({
      tenantId: tenant._id,
      planId: plan._id,
      status: plan.price === 0 ? 'active' : 'incomplete',
      gateway: null,
      startDate: now,
      currentPeriodStart: now,
      currentPeriodEnd,
      nextBillingDate: null,
      renewalInterval: plan.cycleType === 'custom' ? 'custom' : plan.paymentType === 'subscription' ? plan.cycleType : 'one-time',
      previousTenantPlanId: currentTenantPlan?._id || null,
      usage: currentTenantPlan?.usage || undefined,
      metadata: {
        planSlug: plan.slug,
        source: 'billing_change_plan',
      },
    });

    await tenantPlan.save();

    res.json({ message: 'Plan changed successfully', plan: plan.slug });
  } catch (err) {
    res.status(500).json({ message: 'Failed to change plan', error: err.message });
  }
};

/**
 * POST /api/billing/webhook/stripe
 * Stripe webhook handler (raw body, no auth, verified by signature)
 */
exports.stripeWebhook = async (req, res) => {
  try {
    let event;
    const sig = req.headers['stripe-signature'];

    if (BillingService.stripeWebhookSecret && sig && BillingService.stripe) {
      event = BillingService.stripe.webhooks.constructEvent(
        req.body,
        sig,
        BillingService.stripeWebhookSecret
      );
    } else {
      // Dev mode: parse body directly
      event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }

    await BillingService.handleStripeWebhook(event);
    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook error:', err.message);
    res.status(400).json({ message: 'Webhook error', error: err.message });
  }
};

/**
 * POST /api/billing/webhook/razorpay
 */
exports.razorpayWebhook = async (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body;
    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ message: 'Missing required webhook fields' });
    }

    const isValid = BillingService.verifyRazorpayPayment(orderId, paymentId, signature);
    if (!isValid) {
      return res.status(400).json({ message: 'Invalid payment signature' });
    }

    console.log('Razorpay payment verified:', paymentId);
    res.json({ received: true });
  } catch (err) {
    console.error('Razorpay webhook error:', err.message);
    res.status(400).json({ message: 'Webhook error', error: err.message });
  }
};

/**
 * GET /api/billing/invoices
 */
exports.listInvoices = async (req, res) => {
  try {
    const { status, limit = 20, page = 1 } = req.query;
    const query = { tenantId: req.tenantId };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const tenantInvoices = await TenantInvoice.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
    if (tenantInvoices.length > 0) {
      const total = await TenantInvoice.countDocuments(query);
      return res.json({
        invoices: tenantInvoices.map(mapTenantInvoiceResponse),
        pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
      });
    }

    const invoices = await Invoice.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
    const total = await Invoice.countDocuments(query);

    res.json({
      invoices: invoices.map(mapLegacyInvoiceResponse),
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to list invoices', error: err.message });
  }
};

/**
 * GET /api/billing/invoices/:invoiceId
 */
exports.getInvoice = async (req, res) => {
  try {
    const tenantInvoice = await TenantInvoice.findOne({ _id: req.params.invoiceId, tenantId: req.tenantId });
    if (tenantInvoice) {
      return res.json(mapTenantInvoiceResponse(tenantInvoice));
    }

    const invoice = await Invoice.findOne({ _id: req.params.invoiceId, tenantId: req.tenantId });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(mapLegacyInvoiceResponse(invoice));
  } catch (err) {
    res.status(500).json({ message: 'Failed to get invoice', error: err.message });
  }
};

/**
 * POST /api/billing/usage
 */
exports.recordUsage = async (req, res) => {
  try {
    const { metric, count = 1 } = req.body;
    if (!metric) return res.status(400).json({ message: 'metric required' });
    const usage = await BillingService.recordUsage(req.tenantId, metric, parseInt(count));
    res.json({ message: 'Usage recorded', usage });
  } catch (err) {
    res.status(500).json({ message: 'Failed to record usage', error: err.message });
  }
};

/**
 * GET /api/billing/usage
 */
exports.checkUsageLimits = async (req, res) => {
  try {
    const limits = await BillingService.checkUsageLimits(req.tenantId);
    res.json(limits);
  } catch (err) {
    res.status(500).json({ message: 'Failed to check usage limits', error: err.message });
  }
};
