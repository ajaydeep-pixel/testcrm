/**
 * Billing Controller
 * Handles subscription, invoicing, and payment operations
 */

const BillingService = require('../services/BillingService');
const Tenant = require('../models/Tenant');
const Invoice = require('../models/Invoice');

/**
 * GET /api/billing/subscription
 * Get current subscription status for tenant
 */
exports.getSubscriptionStatus = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const status = await BillingService.getSubscriptionStatus(tenantId);
    res.json(status);
  } catch (err) {
    console.error('Error getting subscription status:', err);
    res.status(500).json({ message: 'Failed to get subscription status', error: err.message });
  }
};

/**
 * POST /api/billing/subscribe
 * Create a subscription to a plan
 * Body: { planName, gateway: 'stripe' | 'razorpay' }
 */
exports.createSubscription = async (req, res) => {
  try {
    const { planName, gateway = 'stripe' } = req.body;
    const tenantId = req.tenantId;

    if (!planName) {
      return res.status(400).json({ message: 'planName required' });
    }

    let subscription;
    if (gateway === 'stripe') {
      subscription = await BillingService.createStripeSubscription(tenantId, planName);
    } else if (gateway === 'razorpay') {
      subscription = await BillingService.createRazorpayOrder(tenantId, planName);
    } else {
      return res.status(400).json({ message: 'Invalid payment gateway' });
    }

    res.json({
      message: 'Subscription initiated',
      subscription,
      gateway,
    });
  } catch (err) {
    console.error('Error creating subscription:', err);
    res.status(500).json({ message: 'Failed to create subscription', error: err.message });
  }
};

/**
 * POST /api/billing/change-plan
 * Upgrade or downgrade to a different plan
 * Body: { newPlanName }
 */
exports.changePlan = async (req, res) => {
  try {
    const { newPlanName } = req.body;
    const tenantId = req.tenantId;

    if (!newPlanName) {
      return res.status(400).json({ message: 'newPlanName required' });
    }

    const updatedSubscription = await BillingService.changePlan(tenantId, newPlanName);

    const tenant = await Tenant.findById(tenantId);
    res.json({
      message: 'Plan changed successfully',
      plan: tenant.plan,
      subscription: updatedSubscription,
    });
  } catch (err) {
    console.error('Error changing plan:', err);
    res.status(500).json({ message: 'Failed to change plan', error: err.message });
  }
};

/**
 * POST /api/billing/cancel
 * Cancel current subscription
 */
exports.cancelSubscription = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const result = await BillingService.cancelSubscription(tenantId);
    res.json(result);
  } catch (err) {
    console.error('Error canceling subscription:', err);
    res.status(500).json({ message: 'Failed to cancel subscription', error: err.message });
  }
};

/**
 * GET /api/billing/invoices
 * List all invoices for tenant
 * Query: { status?, limit = 20, page = 1 }
 */
exports.listInvoices = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { status, limit = 20, page = 1 } = req.query;

    const query = { tenantId };
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Invoice.countDocuments(query);

    res.json({
      invoices,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Error listing invoices:', err);
    res.status(500).json({ message: 'Failed to list invoices', error: err.message });
  }
};

/**
 * GET /api/billing/invoices/:invoiceId
 * Get specific invoice
 */
exports.getInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const tenantId = req.tenantId;

    const invoice = await Invoice.findOne({ _id: invoiceId, tenantId });
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (err) {
    console.error('Error getting invoice:', err);
    res.status(500).json({ message: 'Failed to get invoice', error: err.message });
  }
};

/**
 * POST /api/billing/usage
 * Record usage metric for tenant
 * Body: { metric: 'invoiceCount' | 'apiCallsThisMonth' | 'activeUsers' | 'storageMB', count }
 */
exports.recordUsage = async (req, res) => {
  try {
    const { metric, count = 1 } = req.body;
    const tenantId = req.tenantId;

    if (!metric) {
      return res.status(400).json({ message: 'metric required' });
    }

    const usage = await BillingService.recordUsage(tenantId, metric, parseInt(count));
    res.json({ message: 'Usage recorded', usage });
  } catch (err) {
    console.error('Error recording usage:', err);
    res.status(500).json({ message: 'Failed to record usage', error: err.message });
  }
};

/**
 * GET /api/billing/usage
 * Get current usage and check limits
 */
exports.checkUsageLimits = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const limits = await BillingService.checkUsageLimits(tenantId);
    res.json(limits);
  } catch (err) {
    console.error('Error checking usage limits:', err);
    res.status(500).json({ message: 'Failed to check usage limits', error: err.message });
  }
};

/**
 * POST /api/billing/webhook/stripe
 * Handle Stripe webhook events
 * Header: stripe-signature
 * Body: raw event JSON
 */
exports.stripeWebhook = async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    if (!sig) {
      return res.status(400).json({ message: 'Missing stripe-signature header' });
    }

    // Verify and construct event (in production, use Stripe's library)
    const event = JSON.parse(req.body);

    await BillingService.handleStripeWebhook(event);
    res.json({ received: true });
  } catch (err) {
    console.error('Error processing Stripe webhook:', err);
    res.status(400).json({ message: 'Webhook error', error: err.message });
  }
};

/**
 * POST /api/billing/webhook/razorpay
 * Handle Razorpay webhook events
 * Body: { orderId, paymentId, signature }
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

    // Mark as paid in local DB
    console.log('Razorpay payment verified:', paymentId);

    res.json({ received: true });
  } catch (err) {
    console.error('Error processing Razorpay webhook:', err);
    res.status(400).json({ message: 'Webhook error', error: err.message });
  }
};

/**
 * GET /api/billing/plans
 * Get available plans and pricing
 */
exports.getPlans = async (req, res) => {
  try {
    const plans = BillingService.PLANS;
    res.json({ plans });
  } catch (err) {
    console.error('Error getting plans:', err);
    res.status(500).json({ message: 'Failed to get plans', error: err.message });
  }
};
