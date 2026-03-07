/**
 * Billing Service
 * Handles subscription management, invoicing, and payment processing
 * Supports multiple gateways: Stripe (global) and Razorpay (India)
 */

const Stripe = require('stripe');
const Tenant = require('../models/Tenant');

class BillingService {
  constructor() {
    // Initialize Stripe
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    this.stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // Razorpay (initialize if credentials provided)
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      const Razorpay = require('razorpay');
      this.razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
    }
  }

  /**
   * SUBSCRIPTION PRICING
   */
  PLANS = {
    trial: { name: 'trial', price: 0, currency: 'usd', interval: null, description: '14-day free trial' },
    basic: { name: 'basic', price: 2999, currency: 'usd', interval: 'month', description: 'Basic Plan - $29.99/month' },
    pro: { name: 'pro', price: 7999, currency: 'usd', interval: 'month', description: 'Pro Plan - $79.99/month' },
    enterprise: { name: 'enterprise', price: 0, currency: 'usd', interval: null, description: 'Enterprise - Custom pricing' },
  };

  /**
   * Create or retrieve Stripe customer
   */
  async getOrCreateStripeCustomer(tenant) {
    try {
      if (tenant.stripeCustomerId) {
        return await this.stripe.customers.retrieve(tenant.stripeCustomerId);
      }

      // Create new customer
      const customer = await this.stripe.customers.create({
        email: tenant.email,
        name: tenant.name,
        metadata: {
          tenantId: tenant._id.toString(),
        },
      });

      // Save customer ID to tenant
      tenant.stripeCustomerId = customer.id;
      await tenant.save();

      return customer;
    } catch (err) {
      console.error('Error managing Stripe customer:', err);
      throw err;
    }
  }

  /**
   * Create subscription in Stripe
   */
  async createStripeSubscription(tenantId, planName) {
    try {
      const tenant = await Tenant.findById(tenantId);
      if (!tenant) throw new Error('Tenant not found');

      const plan = this.PLANS[planName];
      if (!plan) throw new Error('Invalid plan');

      // Get or create customer
      const customer = await this.getOrCreateStripeCustomer(tenant);

      // Create subscription
      const subscription = await this.stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price_data: { currency: plan.currency, unit_amount: plan.price, recurring: { interval: plan.interval }, product_data: { name: plan.description } } }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });

      // Update tenant
      tenant.plan = planName;
      tenant.subscription = {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      };
      await tenant.save();

      return subscription;
    } catch (err) {
      console.error('Error creating Stripe subscription:', err);
      throw err;
    }
  }

  /**
   * Create Razorpay order
   */
  async createRazorpayOrder(tenantId, planName) {
    try {
      if (!this.razorpay) throw new Error('Razorpay not configured');

      const tenant = await Tenant.findById(tenantId);
      if (!tenant) throw new Error('Tenant not found');

      const plan = this.PLANS[planName];
      if (!plan) throw new Error('Invalid plan');

      // Create order
      const order = await this.razorpay.orders.create({
        amount: plan.price, // in paise (cents)
        currency: 'INR',
        receipt: `tenant_${tenantId}_${Date.now()}`,
        notes: {
          tenantId: tenantId.toString(),
          planName,
        },
      });

      return order;
    } catch (err) {
      console.error('Error creating Razorpay order:', err);
      throw err;
    }
  }

  /**
   * Verify Razorpay payment
   */
  verifyRazorpayPayment(orderId, paymentId, signature, secret = this.razorpay?.key_secret) {
    try {
      const crypto = require('crypto');
      const body = orderId + '|' + paymentId;
      const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');
      return expectedSignature === signature;
    } catch (err) {
      console.error('Error verifying Razorpay payment:', err);
      return false;
    }
  }

  /**
   * Upgrade or downgrade plan
   */
  async changePlan(tenantId, newPlanName) {
    try {
      const tenant = await Tenant.findById(tenantId);
      if (!tenant) throw new Error('Tenant not found');

      if (!tenant.subscription?.id) throw new Error('No active subscription');

      const newPlan = this.PLANS[newPlanName];
      if (!newPlan) throw new Error('Invalid plan');

      // Update Stripe subscription
      const updatedSubscription = await this.stripe.subscriptions.update(tenant.subscription.id, {
        items: [{ id: (await this.stripe.subscriptions.retrieve(tenant.subscription.id)).items.data[0].id, price_data: { currency: newPlan.currency, unit_amount: newPlan.price, recurring: { interval: newPlan.interval }, product_data: { name: newPlan.description } } }],
        proration_behavior: 'create_prorations',
      });

      // Update tenant
      tenant.plan = newPlanName;
      tenant.subscription.status = updatedSubscription.status;
      await tenant.save();

      return updatedSubscription;
    } catch (err) {
      console.error('Error changing plan:', err);
      throw err;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(tenantId) {
    try {
      const tenant = await Tenant.findById(tenantId);
      if (!tenant) throw new Error('Tenant not found');

      if (!tenant.subscription?.id) throw new Error('No active subscription');

      // Cancel in Stripe
      await this.stripe.subscriptions.del(tenant.subscription.id);

      // Update tenant
      tenant.plan = 'trial'; // Revert to trial
      tenant.subscription = {
        status: 'canceled',
        canceledAt: new Date(),
      };
      await tenant.save();

      return { message: 'Subscription canceled' };
    } catch (err) {
      console.error('Error canceling subscription:', err);
      throw err;
    }
  }

  /**
   * Get subscription status
   */
  async getSubscriptionStatus(tenantId) {
    try {
      const tenant = await Tenant.findById(tenantId);
      if (!tenant) throw new Error('Tenant not found');

      return {
        plan: tenant.plan,
        status: tenant.subscription?.status || 'none',
        currentPeriodEnd: tenant.subscription?.currentPeriodEnd,
        trialEndAt: tenant.trialEndAt,
        usage: tenant.usage,
      };
    } catch (err) {
      console.error('Error getting subscription status:', err);
      throw err;
    }
  }

  /**
   * Record usage for metering
   */
  async recordUsage(tenantId, metric, count = 1) {
    try {
      const tenant = await Tenant.findById(tenantId);
      if (!tenant) throw new Error('Tenant not found');

      if (metric === 'invoiceCount') {
        tenant.usage.invoiceCount += count;
      } else if (metric === 'apiCallsThisMonth') {
        tenant.usage.apiCallsThisMonth += count;
      } else if (metric === 'activeUsers') {
        tenant.usage.activeUsers = Math.max(tenant.usage.activeUsers || 0, count);
      } else if (metric === 'storageMB') {
        tenant.usage.storageMB += count;
      }

      await tenant.save();
      return tenant.usage;
    } catch (err) {
      console.error('Error recording usage:', err);
      throw err;
    }
  }

  /**
   * Check if tenant has exceeded limits for plan
   */
  async checkUsageLimits(tenantId) {
    try {
      const tenant = await Tenant.findById(tenantId);
      if (!tenant) throw new Error('Tenant not found');

      const limits = {
        basic: { invoiceCount: 1000, storageMB: 5000, activeUsers: 5 },
        pro: { invoiceCount: 50000, storageMB: 50000, activeUsers: 50 },
        enterprise: { invoiceCount: Infinity, storageMB: Infinity, activeUsers: Infinity },
      };

      const tenantLimits = limits[tenant.plan] || limits.basic;
      const exceeded = {};

      if (tenant.usage.invoiceCount > tenantLimits.invoiceCount) {
        exceeded.invoiceCount = true;
      }
      if (tenant.usage.storageMB > tenantLimits.storageMB) {
        exceeded.storageMB = true;
      }
      if (tenant.usage.activeUsers > tenantLimits.activeUsers) {
        exceeded.activeUsers = true;
      }

      return {
        plan: tenant.plan,
        usage: tenant.usage,
        limits: tenantLimits,
        exceeded,
        isOverLimit: Object.keys(exceeded).length > 0,
      };
    } catch (err) {
      console.error('Error checking usage limits:', err);
      throw err;
    }
  }

  /**
   * Handle Stripe webhook event
   */
  async handleStripeWebhook(event) {
    try {
      switch (event.type) {
        case 'invoice.payment_succeeded':
          console.log('Payment succeeded:', event.data.object.id);
          break;
        case 'invoice.payment_failed':
          console.log('Payment failed:', event.data.object.id);
          break;
        case 'customer.subscription.updated':
          console.log('Subscription updated:', event.data.object.id);
          break;
        case 'customer.subscription.deleted':
          console.log('Subscription canceled:', event.data.object.id);
          break;
        default:
          console.log('Unhandled event type:', event.type);
      }
    } catch (err) {
      console.error('Error handling Stripe webhook:', err);
      throw err;
    }
  }
}

module.exports = new BillingService();
