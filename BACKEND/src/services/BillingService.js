/**
 * Billing Service
 * Handles subscription management via Stripe Checkout Sessions
 * Supports Stripe (global) and Razorpay (India)
 */

const Stripe = require('stripe');
const Tenant = require('../models/Tenant');
const Plan = require('../models/Plan');

class BillingService {
  constructor() {
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
    this.stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      const Razorpay = require('razorpay');
      this.razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
    }
  }

  get isStripeConfigured() {
    return !!this.stripe;
  }

  // ─── STRIPE CUSTOMER ───────────────────────────────────

  async getOrCreateStripeCustomer(tenant) {
    if (tenant.stripeCustomerId) {
      try {
        const existing = await this.stripe.customers.retrieve(tenant.stripeCustomerId);
        if (!existing.deleted) return existing;
      } catch (err) {
        // Customer deleted, will create new
      }
    }

    const customer = await this.stripe.customers.create({
      email: tenant.email,
      name: tenant.name,
      metadata: { tenantId: tenant._id.toString() },
    });

    tenant.stripeCustomerId = customer.id;
    await tenant.save();
    return customer;
  }

  // ─── CHECKOUT SESSION ──────────────────────────────────

  async createCheckoutSession(tenantId, planSlug, successUrl, cancelUrl) {
    if (!this.stripe) throw new Error('Stripe is not configured. Add STRIPE_SECRET_KEY to .env');

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    const plan = await Plan.findOne({ slug: planSlug, isActive: true });
    if (!plan) throw new Error('Invalid plan');
    if (plan.price === 0) throw new Error('Cannot checkout for a free plan');

    // Block if tenant already has an active paid subscription
    if (tenant.subscription?.status === 'active' && !tenant.subscription?.cancelAtPeriodEnd) {
      const currentPlan = await Plan.findOne({ slug: tenant.plan, isActive: true });
      if (currentPlan && currentPlan.price > 0) {
        throw new Error('You have an active paid subscription. Cancel it first before subscribing to a new plan.');
      }
    }

    const customer = await this.getOrCreateStripeCustomer(tenant);

    // Map billingCycle → Stripe interval
    const intervalMap = { monthly: 'month', yearly: 'year' };
    const interval = intervalMap[plan.billingCycle] || 'month';

    // Build line items
    let lineItems;
    if (plan.stripePriceId) {
      lineItems = [{ price: plan.stripePriceId, quantity: 1 }];
    } else {
      lineItems = [{
        price_data: {
          currency: plan.currency || 'usd',
          unit_amount: Math.round(plan.price * 100), // dollars → cents
          recurring: { interval },
          product_data: {
            name: `${plan.name} Plan`,
            description: plan.description || `${plan.name} subscription`,
          },
        },
        quantity: 1,
      }];
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        tenantId: tenant._id.toString(),
        planSlug: plan.slug,
      },
      subscription_data: {
        metadata: {
          tenantId: tenant._id.toString(),
          planSlug: plan.slug,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    });

    return { sessionId: session.id, url: session.url };
  }

  // ─── VERIFY CHECKOUT ──────────────────────────────────

  async verifyCheckoutSession(sessionId) {
    if (!this.stripe) throw new Error('Stripe is not configured');

    const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (session.payment_status !== 'paid') {
      return { status: 'pending' };
    }

    const tenantId = session.metadata.tenantId;
    const planSlug = session.metadata.planSlug;
    const subscription = session.subscription;

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    // Only update if not already activated by webhook
    if (tenant.subscription?.id !== subscription.id) {
      const plan = await Plan.findOne({ slug: planSlug });
      tenant.plan = planSlug;
      tenant.subscription = {
        id: subscription.id,
        status: subscription.status,
        gateway: 'stripe',
        planSlug,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: false,
      };
      await tenant.save();
    }

    return {
      status: 'active',
      plan: planSlug,
      subscription: tenant.subscription,
    };
  }

  // ─── CANCEL SUBSCRIPTION ──────────────────────────────

  async cancelSubscription(tenantId, immediate = false) {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new Error('Tenant not found');
    if (!tenant.subscription?.id) throw new Error('No active subscription to cancel');

    if (this.stripe && tenant.subscription.gateway === 'stripe') {
      if (immediate) {
        await this.stripe.subscriptions.cancel(tenant.subscription.id);
      } else {
        await this.stripe.subscriptions.update(tenant.subscription.id, {
          cancel_at_period_end: true,
        });
      }
    }

    if (immediate) {
      const freePlan = await Plan.findOne({ price: 0, isActive: true }).sort({ sortOrder: 1 });
      tenant.plan = freePlan?.slug || 'trial';
      tenant.subscription = {
        id: tenant.subscription.id,
        status: 'canceled',
        gateway: tenant.subscription.gateway,
        planSlug: tenant.subscription.planSlug,
        canceledAt: new Date(),
        cancelAtPeriodEnd: false,
      };
    } else {
      tenant.subscription = {
        ...tenant.subscription.toObject(),
        status: 'canceling',
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
      };
    }
    await tenant.save();

    return {
      message: immediate
        ? 'Subscription canceled immediately'
        : 'Subscription will cancel at the end of the current billing period',
      currentPeriodEnd: tenant.subscription.currentPeriodEnd,
      status: tenant.subscription.status,
    };
  }

  // ─── SUBSCRIPTION STATUS ──────────────────────────────

  async getSubscriptionStatus(tenantId) {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    const plan = await Plan.findOne({ slug: tenant.plan, isActive: true });

    return {
      plan: tenant.plan,
      planDetails: plan || null,
      subscription: tenant.subscription || null,
      trialStartAt: tenant.trialStartAt,
      trialEndAt: tenant.trialEndAt,
      usage: tenant.usage,
      hasActiveSubscription: ['active', 'canceling'].includes(tenant.subscription?.status),
      isPaid: plan ? plan.price > 0 : false,
    };
  }

  // ─── STRIPE WEBHOOK HANDLER ───────────────────────────

  async handleStripeWebhook(event) {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.payment_status === 'paid') {
          await this._activateFromCheckout(session);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (invoice.subscription && invoice.billing_reason === 'subscription_cycle') {
          await this._handleRenewal(invoice);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          await this._handlePaymentFailed(invoice);
        }
        break;
      }

      case 'customer.subscription.updated': {
        await this._syncSubscription(event.data.object);
        break;
      }

      case 'customer.subscription.deleted': {
        await this._handleSubscriptionEnded(event.data.object);
        break;
      }

      default:
        console.log('Unhandled Stripe event:', event.type);
    }
  }

  async _activateFromCheckout(session) {
    const tenantId = session.metadata?.tenantId;
    const planSlug = session.metadata?.planSlug;
    if (!tenantId || !planSlug) return;

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return;

    const subscription = await this.stripe.subscriptions.retrieve(session.subscription);

    tenant.plan = planSlug;
    tenant.subscription = {
      id: subscription.id,
      status: subscription.status,
      gateway: 'stripe',
      planSlug,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: false,
    };
    await tenant.save();
    console.log(`[Billing] Subscription activated – tenant ${tenantId} → ${planSlug}`);
  }

  async _handleRenewal(invoice) {
    const tenant = await Tenant.findOne({ stripeCustomerId: invoice.customer });
    if (!tenant || tenant.subscription?.id !== invoice.subscription) return;

    const subscription = await this.stripe.subscriptions.retrieve(invoice.subscription);
    tenant.subscription.status = 'active';
    tenant.subscription.currentPeriodStart = new Date(subscription.current_period_start * 1000);
    tenant.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    tenant.subscription.cancelAtPeriodEnd = false;
    tenant.subscription.canceledAt = undefined;

    // Reset monthly usage counters on renewal
    tenant.usage.apiCallsThisMonth = 0;
    await tenant.save();
    console.log(`[Billing] Renewal succeeded – tenant ${tenant._id}`);
  }

  async _handlePaymentFailed(invoice) {
    const tenant = await Tenant.findOne({ stripeCustomerId: invoice.customer });
    if (!tenant) return;

    tenant.subscription.status = 'past_due';
    await tenant.save();
    console.log(`[Billing] Payment failed – tenant ${tenant._id}`);
  }

  async _syncSubscription(subscription) {
    const tenantId = subscription.metadata?.tenantId;
    let tenant = tenantId
      ? await Tenant.findById(tenantId)
      : await Tenant.findOne({ 'subscription.id': subscription.id });
    if (!tenant) return;

    tenant.subscription.status = subscription.cancel_at_period_end ? 'canceling' : subscription.status;
    tenant.subscription.currentPeriodStart = new Date(subscription.current_period_start * 1000);
    tenant.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    tenant.subscription.cancelAtPeriodEnd = !!subscription.cancel_at_period_end;
    await tenant.save();
    console.log(`[Billing] Subscription synced – tenant ${tenant._id} → ${tenant.subscription.status}`);
  }

  async _handleSubscriptionEnded(subscription) {
    const tenantId = subscription.metadata?.tenantId;
    let tenant = tenantId
      ? await Tenant.findById(tenantId)
      : await Tenant.findOne({ 'subscription.id': subscription.id });
    if (!tenant) return;

    const freePlan = await Plan.findOne({ price: 0, isActive: true }).sort({ sortOrder: 1 });
    tenant.plan = freePlan?.slug || 'trial';
    tenant.subscription = {
      id: subscription.id,
      status: 'canceled',
      gateway: 'stripe',
      planSlug: tenant.subscription?.planSlug,
      canceledAt: new Date(),
      cancelAtPeriodEnd: false,
    };
    await tenant.save();
    console.log(`[Billing] Subscription ended – tenant ${tenant._id} reverted to ${tenant.plan}`);
  }

  // ─── RAZORPAY ─────────────────────────────────────────

  async createRazorpayOrder(tenantId, planSlug) {
    if (!this.razorpay) throw new Error('Razorpay not configured');

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    const plan = await Plan.findOne({ slug: planSlug, isActive: true });
    if (!plan) throw new Error('Invalid plan');
    if (plan.price === 0) throw new Error('Cannot checkout for a free plan');

    const order = await this.razorpay.orders.create({
      amount: Math.round(plan.price * 100),
      currency: 'INR',
      receipt: `tenant_${tenantId}_${Date.now()}`,
      notes: { tenantId: tenantId.toString(), planSlug },
    });
    return order;
  }

  verifyRazorpayPayment(orderId, paymentId, signature) {
    const crypto = require('crypto');
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return false;
    const body = orderId + '|' + paymentId;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return expected === signature;
  }

  // ─── USAGE ────────────────────────────────────────────

  async recordUsage(tenantId, metric, count = 1) {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    if (metric === 'invoiceCount') tenant.usage.invoiceCount += count;
    else if (metric === 'apiCallsThisMonth') tenant.usage.apiCallsThisMonth += count;
    else if (metric === 'activeUsers') tenant.usage.activeUsers = Math.max(tenant.usage.activeUsers || 0, count);
    else if (metric === 'storageMB') tenant.usage.storageMB += count;

    await tenant.save();
    return tenant.usage;
  }

  async checkUsageLimits(tenantId) {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    const plan = await Plan.findOne({ slug: tenant.plan, isActive: true });
    const limits = plan?.features || { maxUsers: 1, maxBranches: 1, maxProducts: 100, maxInvoicesPerMonth: 50 };

    const exceeded = {};
    if (tenant.usage.invoiceCount > limits.maxInvoicesPerMonth) exceeded.invoiceCount = true;
    if (tenant.usage.activeUsers > limits.maxUsers) exceeded.activeUsers = true;

    return {
      plan: tenant.plan,
      usage: tenant.usage,
      limits,
      exceeded,
      isOverLimit: Object.keys(exceeded).length > 0,
    };
  }
}

module.exports = new BillingService();
