import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { billingAPI } from '../services/api';
import { useToast } from '../components/Toast';

export default function CheckoutPage() {
  const { planSlug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [plan, setPlan] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadCheckoutData();
  }, [planSlug]);

  const loadCheckoutData = async () => {
    try {
      setLoading(true);
      const [plansRes, subRes] = await Promise.all([
        billingAPI.getPlans(),
        billingAPI.getSubscriptionStatus().catch(() => ({ data: {} })),
      ]);

      const allPlans = plansRes.data?.plans || [];
      const selected = allPlans.find(p => p.slug === planSlug);
      if (!selected) {
        toast.error('Plan not found');
        navigate('/dashboard');
        return;
      }

      setPlan(selected);
      setSubscription(subRes.data);
    } catch (err) {
      toast.error('Failed to load checkout data');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const hasActiveSubscription = subscription?.hasActiveSubscription && subscription?.isPaid;

  const handleCheckout = async () => {
    if (hasActiveSubscription) {
      toast.error('You have an active subscription. Cancel it first before subscribing to a new plan.');
      return;
    }

    try {
      setProcessing(true);
      const res = await billingAPI.createCheckoutSession(planSlug);
      const { url } = res.data;
      if (url) {
        window.location.href = url;
      } else {
        toast.error('Failed to create checkout session');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to start checkout');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 40, height: 40, border: '4px solid #e5e7eb', borderTop: '4px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#6b7280' }}>Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (!plan) return null;

  const billingCycleLabel = plan.billingCycle === 'yearly' ? 'year' : 'month';

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '40px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', margin: 0 }}>Checkout</h1>
          <p style={{ color: '#6b7280', marginTop: 8 }}>Review your plan and proceed to payment</p>
        </div>

        {/* Active Subscription Warning */}
        {hasActiveSubscription && (
          <div style={{
            background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: 16, marginBottom: 24,
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <span style={{ fontSize: 20 }}>&#9888;</span>
            <div>
              <p style={{ fontWeight: 600, color: '#92400e', margin: 0 }}>Active Subscription Detected</p>
              <p style={{ color: '#92400e', margin: '4px 0 0', fontSize: 14 }}>
                You currently have an active <strong>{subscription?.plan}</strong> subscription.
                You need to cancel your current subscription before subscribing to a new plan.
                {subscription?.subscription?.currentPeriodEnd && (
                  <> Your current plan is active until <strong>{new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString()}</strong>.</>
                )}
              </p>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  marginTop: 8, background: '#f59e0b', color: 'white', border: 'none',
                  padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                }}
              >
                Go to Dashboard to Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Plan Details Card */}
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Plan Details</h2>

            <div style={{ background: '#eff6ff', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1e40af' }}>{plan.name} Plan</div>
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: '#111827' }}>${plan.price}</span>
                <span style={{ color: '#6b7280', fontSize: 14 }}>/{billingCycleLabel}</span>
              </div>
              {plan.description && <p style={{ color: '#4b5563', fontSize: 14, marginTop: 8 }}>{plan.description}</p>}
            </div>

            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 12px' }}>What's Included</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[
                { label: 'Users', value: plan.features?.maxUsers },
                { label: 'Branches', value: plan.features?.maxBranches },
                { label: 'Products', value: plan.features?.maxProducts?.toLocaleString() },
                { label: 'Invoices/month', value: plan.features?.maxInvoicesPerMonth?.toLocaleString() },
              ].map(f => (
                <li key={f.label} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0',
                  borderBottom: '1px solid #f3f4f6', fontSize: 14, color: '#374151',
                }}>
                  <span style={{ color: '#22c55e', fontWeight: 700 }}>&#10003;</span>
                  <span>{f.label}: <strong>{f.value}</strong></span>
                </li>
              ))}
            </ul>
          </div>

          {/* Billing Summary Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, flex: 1 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Billing Summary</h2>

              <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#374151' }}>
                  <span>{plan.name} Plan</span>
                  <span>${plan.price}/{billingCycleLabel}</span>
                </div>
              </div>

              <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#6b7280' }}>
                  <span>Subtotal</span>
                  <span>${plan.price}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#6b7280', marginTop: 4 }}>
                  <span>Tax</span>
                  <span>Calculated at checkout</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, color: '#111827' }}>
                <span>Total</span>
                <span>${plan.price}/{billingCycleLabel}</span>
              </div>

              <div style={{
                background: '#f0fdf4', borderRadius: 6, padding: 12, marginTop: 16,
                fontSize: 13, color: '#15803d', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span>&#128274;</span>
                <span>Secure payment powered by Stripe. Your card details are never stored on our servers.</span>
              </div>
            </div>

            {/* Payment Info */}
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>Payment Method</h2>
              <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
                You'll be redirected to Stripe's secure checkout page where you can enter your credit card, debit card, or other supported payment methods.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {['Visa', 'Mastercard', 'Amex', 'Apple Pay', 'Google Pay'].map(method => (
                  <span key={method} style={{
                    background: '#f3f4f6', borderRadius: 4, padding: '4px 10px',
                    fontSize: 11, color: '#4b5563', fontWeight: 500,
                  }}>{method}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32 }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'white', color: '#374151', border: '1px solid #d1d5db',
              padding: '12px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14,
            }}
          >
            &#8592; Back to Dashboard
          </button>
          <button
            onClick={handleCheckout}
            disabled={processing || hasActiveSubscription}
            style={{
              background: hasActiveSubscription ? '#9ca3af' : processing ? '#93c5fd' : '#2563eb',
              color: 'white', border: 'none',
              padding: '12px 32px', borderRadius: 8, cursor: hasActiveSubscription ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: 16,
              opacity: processing ? 0.7 : 1,
            }}
          >
            {processing ? 'Redirecting to Payment...' : hasActiveSubscription ? 'Cancel Current Plan First' : `Subscribe - $${plan.price}/${billingCycleLabel}`}
          </button>
        </div>

        {/* Fine Print */}
        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#9ca3af' }}>
          <p>By subscribing, you agree to our Terms of Service and Privacy Policy.</p>
          <p>You can cancel anytime from your dashboard. Cancellation takes effect at the end of your billing period.</p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
