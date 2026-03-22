/**
 * Billing Service
 * Handles subscription management via Stripe Checkout Sessions
 * Supports Stripe (global) and Razorpay (India)
 */

const fs = require('fs');
const path = require('path');
const Stripe = require('stripe');
const Tenant = require('../models/Tenant');
const Plan = require('../models/Plan');
const Invoice = require('../models/Invoice');
const TenantPlan = require('../models/TenantPlan');
const TenantInvoice = require('../models/TenantInvoice');
const TenantTransaction = require('../models/TenantTransaction');

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

  _generateInvoiceNumber(prefix = 'SUB') {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  _resolveRenewalInterval(plan) {
    if (!plan) return 'custom';
    if (plan.paymentType === 'subscription') {
      return plan.cycleType === 'yearly' ? 'yearly' : 'monthly';
    }
    return plan.cycleType === 'custom' ? 'custom' : plan.cycleType;
  }

  _getPlanDurationDays(plan) {
    if (!plan) return 0;
    if (plan.cycleType === 'custom') return Number(plan.customDays || 0);
    if (plan.cycleType === 'yearly') return 365;
    return 30;
  }

  _mapSubscriptionStatus(status, cancelAtPeriodEnd = false) {
    if (cancelAtPeriodEnd && ['active', 'trialing', 'past_due'].includes(status)) {
      return 'canceling';
    }

    switch (status) {
      case 'trialing':
      case 'active':
      case 'past_due':
      case 'canceling':
      case 'canceled':
      case 'incomplete':
      case 'suspended':
        return status;
      case 'unpaid':
        return 'past_due';
      case 'incomplete_expired':
        return 'canceled';
      default:
        return cancelAtPeriodEnd ? 'canceling' : 'active';
    }
  }

  async _getFreeFallbackPlan() {
    return Plan.findOne({ price: 0, isActive: true }).sort({ sortOrder: 1 });
  }

  async _getTenantPlanContext({ tenantId = null, gatewaySubscriptionId = '', stripeCustomerId = '', planSlug = '' } = {}) {
    let tenant = tenantId ? await Tenant.findById(tenantId) : null;
    let tenantPlan = null;

    if (tenant?._id && gatewaySubscriptionId) {
      tenantPlan = await TenantPlan.findOne({
        tenantId: tenant._id,
        gatewaySubscriptionId,
      }).sort({ createdAt: -1 });
    }

    if (!tenantPlan && gatewaySubscriptionId) {
      tenantPlan = await TenantPlan.findOne({ gatewaySubscriptionId }).sort({ createdAt: -1 });
    }

    if (!tenant && tenantPlan) {
      tenant = await Tenant.findById(tenantPlan.tenantId);
    }

    if (!tenant && stripeCustomerId) {
      tenant = await Tenant.findOne({ stripeCustomerId });
    }

    if (!tenant) {
      return { tenant: null, tenantPlan: null, plan: null, planSlug: planSlug || 'trial' };
    }

    if (!tenantPlan) {
      tenantPlan = await this._getCurrentTenantPlan(tenant._id);
    }

    let plan = null;
    if (tenantPlan?.planId) {
      plan = await Plan.findById(tenantPlan.planId);
    }
    if (!plan && planSlug) {
      plan = await Plan.findOne({ slug: planSlug, isActive: true });
    }

    return {
      tenant,
      tenantPlan,
      plan,
      planSlug: plan?.slug || tenantPlan?.metadata?.planSlug || planSlug || 'trial',
    };
  }

  async _ensureTenantPlanRecord(tenant, plan, subscription, overrides = {}) {
    if (!tenant || !plan) return null;

    let tenantPlan = null;
    const gatewaySubscriptionId = subscription?.id || '';

    if (!tenantPlan && gatewaySubscriptionId) {
      tenantPlan = await TenantPlan.findOne({
        tenantId: tenant._id,
        gatewaySubscriptionId,
      }).sort({ createdAt: -1 });
    }

    if (!tenantPlan) {
      tenantPlan = await TenantPlan.findOne({
        tenantId: tenant._id,
        status: { $in: ['trialing', 'active', 'canceling', 'past_due', 'incomplete'] },
      }).sort({ createdAt: -1 });
    }

    if (!tenantPlan) {
      tenantPlan = new TenantPlan({
        tenantId: tenant._id,
        planId: plan._id,
        gateway: subscription?.gateway || overrides.gateway || null,
        gatewaySubscriptionId,
        gatewayCustomerId: tenant.stripeCustomerId || '',
        renewalInterval: this._resolveRenewalInterval(plan),
        usage: {
          invoiceCount: tenant.usage?.invoiceCount || 0,
          apiCallsThisMonth: tenant.usage?.apiCallsThisMonth || 0,
          activeUsers: tenant.usage?.activeUsers || 1,
          storageMB: tenant.usage?.storageMB || 0,
        },
      });
    }

    tenantPlan.planId = plan._id;
    tenantPlan.gateway = subscription?.gateway || overrides.gateway || tenantPlan.gateway || null;
    tenantPlan.gatewaySubscriptionId = gatewaySubscriptionId || tenantPlan.gatewaySubscriptionId;
    tenantPlan.gatewayCustomerId = tenant.stripeCustomerId || tenantPlan.gatewayCustomerId;
    tenantPlan.status = overrides.status || subscription?.status || tenantPlan.status;
    tenantPlan.startDate = overrides.startDate || tenantPlan.startDate || subscription?.currentPeriodStart || new Date();
    tenantPlan.endDate = overrides.endDate || tenantPlan.endDate;
    tenantPlan.currentPeriodStart = overrides.currentPeriodStart || subscription?.currentPeriodStart || tenantPlan.currentPeriodStart;
    tenantPlan.currentPeriodEnd = overrides.currentPeriodEnd || subscription?.currentPeriodEnd || tenantPlan.currentPeriodEnd;
    tenantPlan.nextBillingDate = overrides.nextBillingDate || subscription?.currentPeriodEnd || tenantPlan.nextBillingDate;
    tenantPlan.cancelAtPeriodEnd = overrides.cancelAtPeriodEnd ?? subscription?.cancelAtPeriodEnd ?? tenantPlan.cancelAtPeriodEnd;
    tenantPlan.canceledAt = overrides.canceledAt ?? subscription?.canceledAt ?? tenantPlan.canceledAt;
    tenantPlan.endedAt = overrides.endedAt ?? tenantPlan.endedAt;
    tenantPlan.previousTenantPlanId = overrides.previousTenantPlanId ?? tenantPlan.previousTenantPlanId;
    tenantPlan.nextPlannedPlanId = overrides.nextPlannedPlanId ?? tenantPlan.nextPlannedPlanId;
    tenantPlan.renewalInterval = this._resolveRenewalInterval(plan) || tenantPlan.renewalInterval;
    tenantPlan.metadata = {
      ...(tenantPlan.metadata || {}),
      planSlug: plan.slug,
      tenantPlanSource: 'billing-service-phase1',
      ...(overrides.metadata || {}),
    };

    await tenantPlan.save();

    return tenantPlan;
  }

  async _transitionTenantPlanForCheckout(tenant, plan, subscriptionState, overrides = {}) {
    if (!tenant || !plan) return null;

    const gatewaySubscriptionId = subscriptionState?.id || '';
    if (gatewaySubscriptionId) {
      const existingByGateway = await TenantPlan.findOne({
        tenantId: tenant._id,
        gatewaySubscriptionId,
      }).sort({ createdAt: -1 });

      if (existingByGateway) {
        return this._ensureTenantPlanRecord(tenant, plan, subscriptionState, overrides);
      }
    }

    const currentTenantPlan = await this._getCurrentTenantPlan(tenant._id);
    if (
      currentTenantPlan &&
      (
        currentTenantPlan.planId?.toString() !== plan._id.toString() ||
        currentTenantPlan.status === 'trialing' ||
        currentTenantPlan.gatewaySubscriptionId !== gatewaySubscriptionId
      )
    ) {
      currentTenantPlan.status = currentTenantPlan.status === 'trialing' ? 'expired' : 'canceled';
      currentTenantPlan.cancelAtPeriodEnd = false;
      currentTenantPlan.endedAt = overrides.startDate || subscriptionState?.currentPeriodStart || new Date();
      await currentTenantPlan.save();
    }

    const tenantPlan = new TenantPlan({
      tenantId: tenant._id,
      planId: plan._id,
      gateway: subscriptionState?.gateway || overrides.gateway || null,
      gatewaySubscriptionId,
      gatewayCustomerId: tenant.stripeCustomerId || '',
      status: overrides.status || subscriptionState?.status || 'active',
      startDate: overrides.startDate || subscriptionState?.currentPeriodStart || new Date(),
      endDate: overrides.endDate || null,
      currentPeriodStart: overrides.currentPeriodStart || subscriptionState?.currentPeriodStart || null,
      currentPeriodEnd: overrides.currentPeriodEnd || subscriptionState?.currentPeriodEnd || null,
      nextBillingDate: overrides.nextBillingDate ?? subscriptionState?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: overrides.cancelAtPeriodEnd ?? subscriptionState?.cancelAtPeriodEnd ?? false,
      canceledAt: overrides.canceledAt ?? subscriptionState?.canceledAt ?? null,
      endedAt: overrides.endedAt ?? null,
      renewalInterval: this._resolveRenewalInterval(plan),
      previousTenantPlanId: currentTenantPlan?._id || null,
      usage: {
        invoiceCount: tenant.usage?.invoiceCount || 0,
        apiCallsThisMonth: tenant.usage?.apiCallsThisMonth || 0,
        activeUsers: tenant.usage?.activeUsers || 1,
        storageMB: tenant.usage?.storageMB || 0,
      },
      metadata: {
        planSlug: plan.slug,
        tenantPlanSource: 'billing-service-checkout-transition',
        ...(overrides.metadata || {}),
      },
    });

    await tenantPlan.save();
    return tenantPlan;
  }

  async _getCurrentTenantPlan(tenantId) {
    return TenantPlan.findOne({
      tenantId,
      status: { $in: ['trialing', 'active', 'canceling', 'past_due', 'incomplete'] },
    }).sort({ createdAt: -1 });
  }

  async _getCurrentTenantPlanAndPlan(tenantId) {
    const tenantPlan = await this._getCurrentTenantPlan(tenantId);
    if (!tenantPlan) {
      return { tenantPlan: null, plan: null, planSlug: 'trial' };
    }

    const plan = await Plan.findById(tenantPlan.planId);
    return {
      tenantPlan,
      plan,
      planSlug: plan?.slug || tenantPlan.metadata?.planSlug || 'trial',
    };
  }

  async _ensureInvoiceMirrors({
    tenant,
    tenantPlan,
    plan,
    gatewayInvoiceId = '',
    paymentId = '',
    amount = 0,
    currency = 'usd',
    status = 'paid',
    paidAt = null,
    dueAt = null,
    periodStart = null,
    periodEnd = null,
    pdfUrl = '',
    metadata = {},
  }) {
    if (!tenant || !tenantPlan || !plan) return { legacyInvoice: null, tenantInvoice: null };

    let legacyInvoice = null;
    if (gatewayInvoiceId) {
      legacyInvoice = await Invoice.findOne({ stripeInvoiceId: gatewayInvoiceId });
    }
    if (!legacyInvoice && paymentId) {
      legacyInvoice = await Invoice.findOne({ razorpayPaymentId: paymentId });
    }
    if (!legacyInvoice) {
      legacyInvoice = new Invoice({
        tenantId: tenant._id,
        invoiceNumber: this._generateInvoiceNumber('INV'),
      });
    }

    legacyInvoice.status = status === 'failed' ? 'overdue' : status === 'canceled' ? 'canceled' : 'paid';
    legacyInvoice.type = 'subscription';
    legacyInvoice.plan = plan.slug;
    legacyInvoice.amount = amount;
    legacyInvoice.currency = currency;
    legacyInvoice.period = { start: periodStart, end: periodEnd };
    legacyInvoice.items = [
      {
        description: `${plan.name} subscription`,
        quantity: 1,
        unitPrice: amount,
        total: amount,
      },
    ];
    legacyInvoice.stripeInvoiceId = gatewayInvoiceId || legacyInvoice.stripeInvoiceId;
    legacyInvoice.razorpayPaymentId = paymentId || legacyInvoice.razorpayPaymentId;
    legacyInvoice.paidAt = paidAt || legacyInvoice.paidAt;
    legacyInvoice.dueAt = dueAt || legacyInvoice.dueAt;
    legacyInvoice.pdfUrl = pdfUrl || legacyInvoice.pdfUrl;
    legacyInvoice.notes = metadata?.note || legacyInvoice.notes;
    await legacyInvoice.save();

    let tenantInvoice = null;
    if (gatewayInvoiceId) {
      tenantInvoice = await TenantInvoice.findOne({ gatewayInvoiceId });
    }
    if (!tenantInvoice) {
      tenantInvoice = new TenantInvoice({
        tenantId: tenant._id,
        tenantPlanId: tenantPlan._id,
        invoiceNumber: legacyInvoice.invoiceNumber,
      });
    }

    tenantInvoice.type = 'subscription';
    tenantInvoice.status = status;
    tenantInvoice.currency = currency || 'usd';
    tenantInvoice.amount = amount || 0;
    tenantInvoice.subtotal = amount || 0;
    tenantInvoice.taxAmount = 0;
    tenantInvoice.discountAmount = 0;
    tenantInvoice.billingDate = paidAt || new Date();
    tenantInvoice.dueDate = dueAt || null;
    tenantInvoice.paidAt = paidAt || null;
    tenantInvoice.gatewayInvoiceId = gatewayInvoiceId || tenantInvoice.gatewayInvoiceId;
    tenantInvoice.invoiceUrl = pdfUrl || tenantInvoice.invoiceUrl;
    const billingDetails = this._buildStripeBillingDetails(tenant);
    tenantInvoice.billingSnapshot = {
      name: billingDetails.name || '',
      email: billingDetails.email || '',
      phone: billingDetails.phone || '',
      address: billingDetails.addressText || '',
      city: billingDetails.resolved?.cityName || '',
      state: billingDetails.resolved?.stateName || '',
      zip: billingDetails.zip || '',
      country: billingDetails.resolved?.countryName || '',
    };
    tenantInvoice.lineItems = [
      {
        description: `${plan.name} subscription`,
        quantity: 1,
        unitAmount: amount || 0,
        totalAmount: amount || 0,
        type: 'subscription',
      },
    ];
    tenantInvoice.metadata = {
      ...(tenantInvoice.metadata || {}),
      planSlug: plan.slug,
      legacyInvoiceId: legacyInvoice._id.toString(),
      ...metadata,
    };
    await tenantInvoice.save();

    return { legacyInvoice, tenantInvoice };
  }

  async _recordTransaction({
    tenant,
    tenantPlan,
    tenantInvoice = null,
    gateway,
    type = 'payment_attempt',
    gatewayTransactionId = '',
    gatewayPaymentIntentId = '',
    gatewayOrderId = '',
    amount = 0,
    currency = 'usd',
    status = 'pending',
    failureCode = '',
    failureMessage = '',
    rawEventRef = '',
    metadata = {},
  }) {
    if (!tenant || !gateway) return null;

    let transaction = null;
    if (gatewayTransactionId) {
      transaction = await TenantTransaction.findOne({ gateway, gatewayTransactionId });
    }
    if (!transaction && gatewayPaymentIntentId) {
      transaction = await TenantTransaction.findOne({ gateway, gatewayPaymentIntentId });
    }
    if (!transaction && gatewayOrderId) {
      transaction = await TenantTransaction.findOne({ gateway, gatewayOrderId });
    }
    if (!transaction) {
      transaction = new TenantTransaction({
        tenantId: tenant._id,
        gateway,
      });
    }

    transaction.tenantPlanId = tenantPlan?._id || transaction.tenantPlanId || null;
    transaction.tenantInvoiceId = tenantInvoice?._id || transaction.tenantInvoiceId || null;
    transaction.type = type;
    transaction.gatewayTransactionId = gatewayTransactionId || transaction.gatewayTransactionId;
    transaction.gatewayPaymentIntentId = gatewayPaymentIntentId || transaction.gatewayPaymentIntentId;
    transaction.gatewayOrderId = gatewayOrderId || transaction.gatewayOrderId;
    transaction.amount = amount || 0;
    transaction.currency = currency || 'usd';
    transaction.status = status;
    transaction.failureCode = failureCode;
    transaction.failureMessage = failureMessage;
    transaction.rawEventRef = rawEventRef || transaction.rawEventRef;
    transaction.processedAt = new Date();
    transaction.metadata = {
      ...(transaction.metadata || {}),
      ...metadata,
    };

    await transaction.save();
    return transaction;
  }

  // --- STRIPE CUSTOMER -----------------------------------

  _getLocationsCatalog() {
    if (this.locationsCatalog) return this.locationsCatalog;

    try {
      const locationsPath = path.join(__dirname, '..', '..', '..', 'FRONTEND', 'src', 'data', 'locations.json');
      const raw = fs.readFileSync(locationsPath, 'utf-8');
      this.locationsCatalog = JSON.parse(raw);
    } catch (err) {
      this.locationsCatalog = { countries: [] };
    }

    return this.locationsCatalog;
  }

  _resolveLocationNames(countryId = '', stateId = '', cityId = '') {
    const locations = this._getLocationsCatalog();
    const countries = locations.countries || [];
    const country = countries.find((item) => item.id === countryId);
    const states = country?.states || [];
    const state = states.find((item) => item.id === stateId);
    const cities = state?.cities || [];
    const city = cities.find((item) => item.id === cityId);

    return {
      countryCode: country?.id || (countryId && countryId.length <= 3 ? countryId : ''),
      countryName: country?.name || '',
      stateName: state?.name || '',
      cityName: city?.name || '',
    };
  }

  _buildStripeBillingDetails(tenant) {
    const billing = tenant?.billing || {};
    const source = {
      name: billing.name || tenant?.name || '',
      email: billing.email || tenant?.email || '',
      phone: billing.phone || tenant?.phone || '',
      address: billing.address || tenant?.address || '',
      country: billing.country || tenant?.country || '',
      state: billing.state || tenant?.state || '',
      city: billing.city || tenant?.city || '',
      zip: billing.zip || tenant?.zip || '',
    };

    const resolved = this._resolveLocationNames(source.country, source.state, source.city);
    const address = {
      line1: source.address || undefined,
      city: resolved.cityName || undefined,
      state: resolved.stateName || undefined,
      postal_code: source.zip || undefined,
      country: resolved.countryCode || undefined,
    };

    Object.keys(address).forEach((key) => {
      if (!address[key]) delete address[key];
    });

    return {
      name: source.name,
      email: source.email,
      phone: source.phone,
      addressText: source.address,
      city: source.city,
      state: source.state,
      zip: source.zip,
      country: source.country,
      address,
      resolved,
    };
  }

  async getOrCreateStripeCustomer(tenant) {
    const billingDetails = this._buildStripeBillingDetails(tenant);
    const customerPayload = {
      email: billingDetails.email || tenant.email,
      name: billingDetails.name || tenant.name,
      phone: billingDetails.phone || undefined,
      metadata: { tenantId: tenant._id.toString() },
    };

    if (Object.keys(billingDetails.address || {}).length > 0) {
      customerPayload.address = billingDetails.address;
    }

    if (tenant.stripeCustomerId) {
      try {
        const existing = await this.stripe.customers.retrieve(tenant.stripeCustomerId);
        if (!existing.deleted) {
          return this.stripe.customers.update(tenant.stripeCustomerId, customerPayload);
        }
      } catch (err) {
        // Customer deleted, will create new
      }
    }

    const customer = await this.stripe.customers.create(customerPayload);

    tenant.stripeCustomerId = customer.id;
    await tenant.save();
    return customer;
  }

  // --- CHECKOUT SESSION -----------------------------------

  async createCheckoutSession(tenantId, planSlug, successUrl, cancelUrl) {
    if (!this.stripe) throw new Error('Stripe is not configured. Add STRIPE_SECRET_KEY to .env');

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    const plan = await Plan.findOne({ slug: planSlug, isActive: true });
    if (!plan) throw new Error('Invalid plan');
    if (plan.price === 0) throw new Error('Cannot checkout for a free plan');

    const currentState = await this._getCurrentTenantPlanAndPlan(tenant._id);
    if (
      currentState.tenantPlan &&
      ['active', 'past_due', 'incomplete'].includes(currentState.tenantPlan.status) &&
      !currentState.tenantPlan.cancelAtPeriodEnd &&
      currentState.plan &&
      currentState.plan.price > 0
    ) {
      throw new Error('You have an active paid subscription. Cancel it first before subscribing to a new plan.');
    }

    const customer = await this.getOrCreateStripeCustomer(tenant);

    const isRecurringSubscription = plan.paymentType === 'subscription' && ['monthly', 'yearly'].includes(plan.cycleType);
    const intervalMap = { monthly: 'month', yearly: 'year' };
    const interval = intervalMap[plan.cycleType] || 'month';

    let lineItems;
    if (isRecurringSubscription && plan.stripePriceId) {
      lineItems = [{ price: plan.stripePriceId, quantity: 1 }];
    } else {
      lineItems = [{
        price_data: {
          currency: plan.currency || 'usd',
          unit_amount: Math.round(plan.price * 100),
          ...(isRecurringSubscription ? { recurring: { interval } } : {}),
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
      mode: isRecurringSubscription ? 'subscription' : 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        tenantId: tenant._id.toString(),
        planSlug: plan.slug,
        paymentType: plan.paymentType,
        cycleType: plan.cycleType,
        customDays: String(plan.customDays || ''),
      },
      ...(isRecurringSubscription ? {
        subscription_data: {
          metadata: {
            tenantId: tenant._id.toString(),
            planSlug: plan.slug,
          },
        },
      } : {}),
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      phone_number_collection: {
        enabled: true,
      },
    });

    await this._recordTransaction({
      tenant,
      gateway: 'stripe',
      type: 'payment_attempt',
      gatewayTransactionId: session.id,
      amount: session.amount_total || Math.round(plan.price * 100),
      currency: session.currency || plan.currency || 'usd',
      status: 'pending',
      metadata: {
        event: 'checkout_session_created',
        planSlug: plan.slug,
      },
    });

    return { sessionId: session.id, url: session.url };
  }

  // --- VERIFY CHECKOUT ──────────────────────────────────

  async verifyCheckoutSession(sessionId) {
    if (!this.stripe) throw new Error('Stripe is not configured');

    const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'invoice'],
    });

    if (session.payment_status !== 'paid') {
      return { status: 'pending' };
    }

    const tenantId = session.metadata.tenantId;
    const planSlug = session.metadata.planSlug;
    const subscription = session.subscription;

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    const plan = await Plan.findOne({ slug: planSlug });
    if (!plan) throw new Error('Plan not found');

    const now = new Date();
    const durationDays = this._getPlanDurationDays(plan);
    const periodEnd = subscription?.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : (durationDays ? new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000) : null);
    const subscriptionState = subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          gateway: 'stripe',
          planSlug,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        }
      : {
          id: session.payment_intent || session.id,
          status: 'active',
          gateway: 'stripe',
          planSlug,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        };

    const tenantPlan = await this._transitionTenantPlanForCheckout(tenant, plan, subscriptionState, {
      status: subscription ? subscription.status : 'active',
      startDate: subscriptionState.currentPeriodStart,
      currentPeriodStart: subscriptionState.currentPeriodStart,
      currentPeriodEnd: subscriptionState.currentPeriodEnd,
      nextBillingDate: plan.paymentType === 'subscription' ? subscriptionState.currentPeriodEnd : null,
      metadata: {
        event: 'checkout_session_verified',
        checkoutSessionId: session.id,
        paymentType: plan.paymentType,
        cycleType: plan.cycleType,
      },
    });

    const invoice = session.invoice;
    const mirrored = await this._ensureInvoiceMirrors({
      tenant,
      tenantPlan,
      plan,
      gatewayInvoiceId: invoice?.id || '',
      amount: invoice?.amount_paid ?? session.amount_total ?? Math.round(plan.price * 100),
      currency: invoice?.currency || session.currency || plan.currency || 'usd',
      status: 'paid',
      paidAt: invoice?.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : new Date(),
      dueAt: invoice?.due_date ? new Date(invoice.due_date * 1000) : null,
      periodStart: tenantPlan.currentPeriodStart,
      periodEnd: tenantPlan.currentPeriodEnd,
      pdfUrl: invoice?.invoice_pdf || '',
      metadata: {
        event: 'checkout_session_verified',
        checkoutSessionId: session.id,
      },
    });

    await this._recordTransaction({
      tenant,
      tenantPlan,
      tenantInvoice: mirrored.tenantInvoice,
      gateway: 'stripe',
      type: 'charge',
      gatewayTransactionId: invoice?.charge || invoice?.id || session.payment_intent || session.id,
      gatewayPaymentIntentId: invoice?.payment_intent || session.payment_intent || '',
      amount: invoice?.amount_paid ?? session.amount_total ?? Math.round(plan.price * 100),
      currency: invoice?.currency || session.currency || plan.currency || 'usd',
      status: 'success',
      metadata: {
        event: 'checkout_session_verified',
        planSlug,
        checkoutSessionId: session.id,
      },
    });

    const latestStatus = await this.getSubscriptionStatus(tenantId);
    return {
      status: 'active',
      plan: latestStatus.plan,
      subscription: latestStatus.subscription,
    };
  }

  // ─── CANCEL SUBSCRIPTION ──────────────────────────────

  async cancelSubscription(tenantId, immediate = false) {
    const { tenant, tenantPlan, plan } = await this._getTenantPlanContext({ tenantId });
    if (!tenant) throw new Error('Tenant not found');
    if (!tenantPlan?.gatewaySubscriptionId || tenantPlan.gateway !== 'stripe') {
      throw new Error('No active subscription to cancel');
    }
    if (!plan || plan.paymentType !== 'subscription') {
      throw new Error('Only recurring subscriptions can be canceled');
    }

    if (this.stripe) {
      if (immediate) {
        await this.stripe.subscriptions.cancel(tenantPlan.gatewaySubscriptionId);
      } else {
        await this.stripe.subscriptions.update(tenantPlan.gatewaySubscriptionId, {
          cancel_at_period_end: true,
        });
      }
    }

    const cancellationDate = new Date();
    let updatedTenantPlan = await this._ensureTenantPlanRecord(
      tenant,
      plan,
      {
        id: tenantPlan.gatewaySubscriptionId,
        status: immediate ? 'canceled' : 'canceling',
        gateway: tenantPlan.gateway,
        currentPeriodStart: tenantPlan.currentPeriodStart || tenantPlan.startDate || null,
        currentPeriodEnd: tenantPlan.currentPeriodEnd || tenantPlan.endDate || null,
        cancelAtPeriodEnd: !immediate,
        canceledAt: cancellationDate,
      },
      {
        status: immediate ? 'canceled' : 'canceling',
        startDate: tenantPlan.startDate || tenantPlan.currentPeriodStart || new Date(),
        currentPeriodStart: tenantPlan.currentPeriodStart || tenantPlan.startDate || null,
        currentPeriodEnd: tenantPlan.currentPeriodEnd || tenantPlan.endDate || null,
        nextBillingDate: immediate ? null : (tenantPlan.currentPeriodEnd || tenantPlan.endDate || null),
        cancelAtPeriodEnd: !immediate,
        canceledAt: cancellationDate,
        endedAt: immediate ? cancellationDate : null,
        metadata: {
          event: immediate ? 'subscription_canceled_immediately' : 'subscription_cancel_scheduled',
        },
      }
    );

    let freePlan = null;
    if (immediate) {
      freePlan = await this._getFreeFallbackPlan();
    }

    if (immediate && freePlan) {
      const freeTenantPlan = await this._ensureTenantPlanRecord(
        tenant,
        freePlan,
        {
          status: 'active',
          gateway: null,
          cancelAtPeriodEnd: false,
          currentPeriodStart: cancellationDate,
          currentPeriodEnd: null,
        },
        {
          status: 'active',
          gateway: null,
          startDate: cancellationDate,
          currentPeriodStart: cancellationDate,
          currentPeriodEnd: null,
          nextBillingDate: null,
          cancelAtPeriodEnd: false,
          previousTenantPlanId: updatedTenantPlan?._id || null,
          metadata: {
            event: 'subscription_fallback_to_free',
          },
        }
      );
      updatedTenantPlan = freeTenantPlan || updatedTenantPlan;
    }

    await this._recordTransaction({
      tenant,
      tenantPlan: updatedTenantPlan,
      gateway: tenantPlan.gateway || 'stripe',
      type: 'webhook_event',
      gatewayTransactionId: tenantPlan.gatewaySubscriptionId,
      status: immediate ? 'canceled' : 'pending',
      metadata: {
        event: immediate ? 'subscription_canceled_immediately' : 'subscription_cancel_scheduled',
        planSlug: plan.slug,
        fallbackPlanSlug: freePlan?.slug || null,
      },
    });

    return {
      message: immediate
        ? 'Subscription canceled immediately'
        : 'Subscription will cancel at the end of the current billing period',
      currentPeriodEnd: tenantPlan.currentPeriodEnd || tenantPlan.endDate || null,
      status: immediate ? 'canceled' : 'canceling',
    };
  }

  // ─── SUBSCRIPTION STATUS ──────────────────────────────

  async getSubscriptionStatus(tenantId) {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new Error('Tenant not found');
    const { tenantPlan, plan, planSlug } = await this._getCurrentTenantPlanAndPlan(tenantId);
    const subscription = tenantPlan
      ? {
          id: tenantPlan.gatewaySubscriptionId || null,
          status: tenantPlan.status,
          gateway: tenantPlan.gateway,
          planSlug,
          currentPeriodStart: tenantPlan.currentPeriodStart || tenantPlan.startDate || null,
          currentPeriodEnd: tenantPlan.currentPeriodEnd || tenantPlan.endDate || null,
          cancelAtPeriodEnd: !!tenantPlan.cancelAtPeriodEnd,
          canceledAt: tenantPlan.canceledAt || null,
        }
      : null;

    return {
      plan: planSlug,
      planDetails: plan || null,
      subscription,
      trialStartAt: tenantPlan?.status === 'trialing' ? (tenantPlan.currentPeriodStart || tenantPlan.startDate || null) : null,
      trialEndAt: tenantPlan?.status === 'trialing' ? (tenantPlan.currentPeriodEnd || tenantPlan.endDate || null) : null,
      usage: tenant.usage,
      hasActiveSubscription: ['active', 'canceling', 'past_due', 'trialing'].includes(tenantPlan?.status),
      isPaid: plan ? plan.price > 0 : false,
    };
  }

  // ─── STRIPE WEBHOOK HANDLER ───────────────────────────

  async handleStripeWebhook(event) {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.payment_status === 'paid') {
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
    const plan = await Plan.findOne({ slug: planSlug, isActive: true });
    if (!plan) return;

    const expandedSession = this.stripe
      ? await this.stripe.checkout.sessions.retrieve(session.id, {
          expand: ['subscription', 'invoice'],
        })
      : session;

    const now = new Date();
    const durationDays = this._getPlanDurationDays(plan);
    const subscription = expandedSession.subscription
      ? await this.stripe.subscriptions.retrieve(expandedSession.subscription.id || expandedSession.subscription)
      : null;
    const currentPeriodStart = subscription ? new Date(subscription.current_period_start * 1000) : now;
    const currentPeriodEnd = subscription
      ? new Date(subscription.current_period_end * 1000)
      : (durationDays ? new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000) : null);
    const subscriptionState = subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          gateway: 'stripe',
          planSlug,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd: false,
        }
      : {
          id: session.payment_intent || session.id,
          status: 'active',
          gateway: 'stripe',
          planSlug,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd: false,
        };

    const tenantPlan = await this._transitionTenantPlanForCheckout(tenant, plan, subscriptionState, {
      status: subscription ? subscription.status : 'active',
      startDate: currentPeriodStart,
      currentPeriodStart,
      currentPeriodEnd,
      nextBillingDate: plan.paymentType === 'subscription' ? currentPeriodEnd : null,
      metadata: {
        event: 'checkout.session.completed',
        checkoutSessionId: expandedSession.id,
      },
    });

    const invoice = expandedSession.invoice || null;
    const mirrored = await this._ensureInvoiceMirrors({
      tenant,
      tenantPlan,
      plan,
      gatewayInvoiceId: invoice?.id || '',
      amount: invoice?.amount_paid ?? expandedSession.amount_total ?? Math.round(plan.price * 100),
      currency: invoice?.currency || expandedSession.currency || plan.currency || 'usd',
      status: 'paid',
      paidAt: invoice?.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : new Date(),
      dueAt: invoice?.due_date ? new Date(invoice.due_date * 1000) : null,
      periodStart: tenantPlan.currentPeriodStart,
      periodEnd: tenantPlan.currentPeriodEnd,
      pdfUrl: invoice?.invoice_pdf || '',
      metadata: {
        event: 'checkout.session.completed',
        checkoutSessionId: expandedSession.id,
      },
    });

    await this._recordTransaction({
      tenant,
      tenantPlan,
      tenantInvoice: mirrored.tenantInvoice,
      gateway: 'stripe',
      type: 'charge',
      gatewayTransactionId: invoice?.charge || invoice?.id || expandedSession.payment_intent || expandedSession.id,
      gatewayPaymentIntentId: invoice?.payment_intent || expandedSession.payment_intent || '',
      amount: invoice?.amount_paid ?? expandedSession.amount_total ?? Math.round(plan.price * 100),
      currency: invoice?.currency || expandedSession.currency || plan.currency || 'usd',
      status: 'success',
      rawEventRef: 'checkout.session.completed',
      metadata: {
        event: 'checkout.session.completed',
        planSlug,
      },
    });
    console.log(`[Billing] Subscription activated – tenant ${tenantId} → ${planSlug}`);
  }

  async _handleRenewal(invoice) {
    const { tenant, tenantPlan, plan } = await this._getTenantPlanContext({
      gatewaySubscriptionId: invoice.subscription,
      stripeCustomerId: invoice.customer,
    });
    if (!tenant || !tenantPlan || !plan) return;

    const subscription = await this.stripe.subscriptions.retrieve(invoice.subscription);
    const currentPeriodStart = new Date(subscription.current_period_start * 1000);
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    // Reset monthly usage counters on renewal
    tenant.usage = tenant.usage || {
      invoiceCount: 0,
      apiCallsThisMonth: 0,
      activeUsers: 0,
      storageMB: 0,
    };
    tenant.usage.apiCallsThisMonth = 0;

    const updatedTenantPlan = await this._ensureTenantPlanRecord(tenant, plan, {
      id: invoice.subscription,
      status: this._mapSubscriptionStatus(subscription.status),
      gateway: tenantPlan.gateway || 'stripe',
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
    }, {
      status: 'active',
      startDate: tenantPlan.startDate || currentPeriodStart,
      currentPeriodStart,
      currentPeriodEnd,
      nextBillingDate: currentPeriodEnd,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      metadata: {
        event: 'invoice.payment_succeeded',
        billingReason: invoice.billing_reason,
      },
    });

    if (updatedTenantPlan) {
      updatedTenantPlan.usage.apiCallsThisMonth = 0;
      await updatedTenantPlan.save();
    }

    const mirrored = await this._ensureInvoiceMirrors({
      tenant,
      tenantPlan: updatedTenantPlan,
      plan,
      gatewayInvoiceId: invoice.id || '',
      amount: invoice.amount_paid ?? invoice.amount_due ?? Math.round(plan.price * 100),
      currency: invoice.currency || plan.currency || 'usd',
      status: 'paid',
      paidAt: invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : new Date(),
      dueAt: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : currentPeriodStart,
      periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : currentPeriodEnd,
      pdfUrl: invoice.invoice_pdf || '',
      metadata: {
        event: 'invoice.payment_succeeded',
        billingReason: invoice.billing_reason,
      },
    });

    await this._recordTransaction({
      tenant,
      tenantPlan: updatedTenantPlan,
      tenantInvoice: mirrored.tenantInvoice,
      gateway: 'stripe',
      type: 'charge',
      gatewayTransactionId: invoice.charge || invoice.id,
      gatewayPaymentIntentId: invoice.payment_intent || '',
      amount: invoice.amount_paid ?? invoice.amount_due ?? Math.round(plan.price * 100),
      currency: invoice.currency || plan.currency || 'usd',
      status: 'success',
      rawEventRef: 'invoice.payment_succeeded',
      metadata: {
        event: 'invoice.payment_succeeded',
        planSlug: plan.slug,
      },
    });

    await tenant.save();
    console.log(`[Billing] Renewal succeeded – tenant ${tenant._id}`);
  }

  async _handlePaymentFailed(invoice) {
    const { tenant, tenantPlan, plan } = await this._getTenantPlanContext({
      gatewaySubscriptionId: invoice.subscription,
      stripeCustomerId: invoice.customer,
    });
    if (!tenant || !tenantPlan || !plan) return;

    const updatedTenantPlan = await this._ensureTenantPlanRecord(tenant, plan, {
      id: invoice.subscription,
      status: 'past_due',
      gateway: tenantPlan.gateway || 'stripe',
      currentPeriodStart: tenantPlan.currentPeriodStart || tenantPlan.startDate || null,
      currentPeriodEnd: tenantPlan.currentPeriodEnd || tenantPlan.endDate || null,
      cancelAtPeriodEnd: tenantPlan.cancelAtPeriodEnd,
      canceledAt: tenantPlan.canceledAt || null,
    }, {
      status: 'past_due',
      startDate: tenantPlan.startDate || tenantPlan.currentPeriodStart || new Date(),
      currentPeriodStart: tenantPlan.currentPeriodStart || tenantPlan.startDate || null,
      currentPeriodEnd: tenantPlan.currentPeriodEnd || tenantPlan.endDate || null,
      nextBillingDate: tenantPlan.nextBillingDate || tenantPlan.currentPeriodEnd || tenantPlan.endDate || null,
      cancelAtPeriodEnd: tenantPlan.cancelAtPeriodEnd,
      canceledAt: tenantPlan.canceledAt || null,
      metadata: {
        event: 'invoice.payment_failed',
      },
    });

    const mirrored = await this._ensureInvoiceMirrors({
      tenant,
      tenantPlan: updatedTenantPlan,
      plan,
      gatewayInvoiceId: invoice.id || '',
      amount: invoice.amount_due ?? invoice.amount_paid ?? Math.round(plan.price * 100),
      currency: invoice.currency || plan.currency || 'usd',
      status: 'failed',
      paidAt: null,
      dueAt: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : (updatedTenantPlan.currentPeriodStart || null),
      periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : (updatedTenantPlan.currentPeriodEnd || null),
      pdfUrl: invoice.invoice_pdf || '',
      metadata: {
        event: 'invoice.payment_failed',
        attemptCount: invoice.attempt_count || 0,
      },
    });

    await this._recordTransaction({
      tenant,
      tenantPlan: updatedTenantPlan,
      tenantInvoice: mirrored.tenantInvoice,
      gateway: 'stripe',
      type: 'payment_attempt',
      gatewayTransactionId: invoice.charge || invoice.id,
      gatewayPaymentIntentId: invoice.payment_intent || '',
      amount: invoice.amount_due ?? invoice.amount_paid ?? Math.round(plan.price * 100),
      currency: invoice.currency || plan.currency || 'usd',
      status: 'failed',
      failureCode: invoice.last_finalization_error?.code || invoice.last_payment_error?.code || '',
      failureMessage: invoice.last_finalization_error?.message || invoice.last_payment_error?.message || 'Stripe payment failed',
      rawEventRef: 'invoice.payment_failed',
      metadata: {
        event: 'invoice.payment_failed',
        planSlug: plan.slug,
      },
    });

    console.log(`[Billing] Payment failed – tenant ${tenant._id}`);
  }

  async _syncSubscription(subscription) {
    const context = await this._getTenantPlanContext({
      tenantId: subscription.metadata?.tenantId,
      gatewaySubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer,
      planSlug: subscription.metadata?.planSlug,
    });
    if (!context.tenant || !context.tenantPlan || !context.plan) return;

    const nextStatus = this._mapSubscriptionStatus(subscription.status, !!subscription.cancel_at_period_end);
    const tenantPlan = await this._ensureTenantPlanRecord(context.tenant, context.plan, {
      id: subscription.id,
      status: nextStatus,
      gateway: context.tenantPlan.gateway || 'stripe',
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
    }, {
      status: nextStatus,
      startDate: context.tenantPlan.startDate || new Date(subscription.current_period_start * 1000),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      nextBillingDate: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      endedAt: subscription.ended_at ? new Date(subscription.ended_at * 1000) : null,
      metadata: {
        event: 'customer.subscription.updated',
      },
    });

    await this._recordTransaction({
      tenant: context.tenant,
      tenantPlan,
      gateway: 'stripe',
      type: 'webhook_event',
      gatewayTransactionId: subscription.id,
      status: subscription.cancel_at_period_end ? 'pending' : 'success',
      rawEventRef: 'customer.subscription.updated',
      metadata: {
        event: 'customer.subscription.updated',
        planSlug: context.plan.slug,
        subscriptionStatus: nextStatus,
      },
    });

    console.log(`[Billing] Subscription synced – tenant ${context.tenant._id} → ${nextStatus}`);
  }

  async _handleSubscriptionEnded(subscription) {
    const context = await this._getTenantPlanContext({
      tenantId: subscription.metadata?.tenantId,
      gatewaySubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer,
      planSlug: subscription.metadata?.planSlug,
    });
    if (!context.tenant || !context.tenantPlan || !context.plan) return;

    const endedAt = new Date();
    const canceledTenantPlan = await this._ensureTenantPlanRecord(context.tenant, context.plan, {
      id: subscription.id,
      status: 'canceled',
      gateway: context.tenantPlan.gateway || 'stripe',
      currentPeriodStart: context.tenantPlan.currentPeriodStart || context.tenantPlan.startDate || null,
      currentPeriodEnd: context.tenantPlan.currentPeriodEnd || context.tenantPlan.endDate || null,
      cancelAtPeriodEnd: false,
      canceledAt: endedAt,
    }, {
      status: 'canceled',
      startDate: context.tenantPlan.startDate || context.tenantPlan.currentPeriodStart || endedAt,
      currentPeriodStart: context.tenantPlan.currentPeriodStart || context.tenantPlan.startDate || null,
      currentPeriodEnd: context.tenantPlan.currentPeriodEnd || context.tenantPlan.endDate || null,
      nextBillingDate: null,
      cancelAtPeriodEnd: false,
      canceledAt: endedAt,
      endedAt,
      metadata: {
        event: 'customer.subscription.deleted',
      },
    });

    const freePlan = await this._getFreeFallbackPlan();
    let fallbackTenantPlan = null;
    if (freePlan) {
      fallbackTenantPlan = await this._ensureTenantPlanRecord(
        context.tenant,
        freePlan,
        {
          status: 'active',
          gateway: null,
          cancelAtPeriodEnd: false,
          currentPeriodStart: endedAt,
          currentPeriodEnd: null,
        },
        {
          status: 'active',
          gateway: null,
          startDate: endedAt,
          currentPeriodStart: endedAt,
          currentPeriodEnd: null,
          nextBillingDate: null,
          cancelAtPeriodEnd: false,
          previousTenantPlanId: canceledTenantPlan?._id || null,
          metadata: {
            event: 'fallback_to_free_plan',
          },
        }
      );
    }
    await this._recordTransaction({
      tenant: context.tenant,
      tenantPlan: fallbackTenantPlan || canceledTenantPlan,
      gateway: 'stripe',
      type: 'webhook_event',
      gatewayTransactionId: subscription.id,
      status: 'canceled',
      rawEventRef: 'customer.subscription.deleted',
      metadata: {
        event: 'customer.subscription.deleted',
        fallbackPlan: freePlan?.slug || null,
      },
    });

    console.log(`[Billing] Subscription ended – tenant ${context.tenant._id} reverted to ${freePlan?.slug || 'no-fallback-plan'}`);
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
    await this._recordTransaction({
      tenant,
      gateway: 'razorpay',
      type: 'payment_attempt',
      gatewayTransactionId: order.id,
      gatewayOrderId: order.id,
      amount: order.amount || Math.round(plan.price * 100),
      currency: order.currency || 'INR',
      status: 'pending',
      metadata: {
        event: 'razorpay_order_created',
        planSlug,
        receipt: order.receipt,
      },
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
    tenant.usage = tenant.usage || {
      invoiceCount: 0,
      apiCallsThisMonth: 0,
      activeUsers: 0,
      storageMB: 0,
    };

    if (metric === 'invoiceCount') tenant.usage.invoiceCount += count;
    else if (metric === 'apiCallsThisMonth') tenant.usage.apiCallsThisMonth += count;
    else if (metric === 'activeUsers') tenant.usage.activeUsers = Math.max(tenant.usage.activeUsers || 0, count);
    else if (metric === 'storageMB') tenant.usage.storageMB += count;

    const tenantPlan = await this._getCurrentTenantPlan(tenantId);
    if (tenantPlan) {
      if (metric === 'invoiceCount') tenantPlan.usage.invoiceCount += count;
      else if (metric === 'apiCallsThisMonth') tenantPlan.usage.apiCallsThisMonth += count;
      else if (metric === 'activeUsers') tenantPlan.usage.activeUsers = Math.max(tenantPlan.usage.activeUsers || 0, count);
      else if (metric === 'storageMB') tenantPlan.usage.storageMB += count;
      await tenantPlan.save();
    }

    await tenant.save();
    return tenant.usage;
  }

  async checkUsageLimits(tenantId) {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new Error('Tenant not found');
    const usage = tenant.usage || {
      invoiceCount: 0,
      apiCallsThisMonth: 0,
      activeUsers: 0,
      storageMB: 0,
    };

    const { plan, planSlug } = await this._getCurrentTenantPlanAndPlan(tenantId);
    const limits = plan?.features || { maxUsers: 1, maxBranches: 1, maxProducts: 100, maxInvoicesPerMonth: 50 };

    const exceeded = {};
    if (usage.invoiceCount > limits.maxInvoicesPerMonth) exceeded.invoiceCount = true;
    if (usage.activeUsers > limits.maxUsers) exceeded.activeUsers = true;

    return {
      plan: planSlug,
      usage,
      limits,
      exceeded,
      isOverLimit: Object.keys(exceeded).length > 0,
    };
  }
}

module.exports = new BillingService();


