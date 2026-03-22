import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { billingAPI, settingsAPI } from '../services/api';
import TenantCommonHeader from '../components/TenantCommonHeader';
import { useToast } from '../components/Toast';
import { getPlanDisplayName } from '../utils/planDisplay';
import locations from '../data/locations.json';

const countries = locations.countries || [];

const resolveLocationDisplay = (billingInfo = {}) => {
  const country = countries.find((item) => item.id === billingInfo.country);
  const states = country?.states || [];
  const state = states.find((item) => item.id === billingInfo.state);
  const cities = state?.cities || [];
  const city = cities.find((item) => item.id === billingInfo.city);

  return {
    country: country?.name || '--',
    state: state?.name || '--',
    city: city?.name || '--',
  };
};

export default function CheckoutPage() {
  const { planSlug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [hasActivePaidSubscription, setHasActivePaidSubscription] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [billingInfo, setBillingInfo] = useState(null);

  useEffect(() => {
    async function fetchCheckoutData() {
      setLoading(true);
      try {
        const [plansResult, subscriptionResult, billingResult] = await Promise.allSettled([
          billingAPI.getPlans(),
          billingAPI.getSubscriptionStatus(),
          settingsAPI.getBillingInfo(),
        ]);

        if (plansResult.status !== 'fulfilled') {
          throw plansResult.reason;
        }

        const selectedPlan = (plansResult.value.data?.plans || []).find((item) => item.slug === planSlug);
        if (!selectedPlan) {
          toast.error('Plan not found');
          navigate('/dashboard');
          return;
        }

        setPlan(selectedPlan);

        if (subscriptionResult.status === 'fulfilled') {
          setSubscription(subscriptionResult.value.data || null);
          setHasActivePaidSubscription(Boolean(subscriptionResult.value.data?.hasActiveSubscription && subscriptionResult.value.data?.isPaid));
        } else {
          setSubscription(null);
          setHasActivePaidSubscription(false);
        }

        if (billingResult.status === 'fulfilled') {
          setBillingInfo(billingResult.value.data?.billing_info || null);
        } else {
          setBillingInfo(null);
        }
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Failed to load checkout');
      } finally {
        setLoading(false);
      }
    }

    fetchCheckoutData();
  }, [planSlug, navigate, toast]);

  const handleCheckout = async () => {
    if (!planSlug) return;

    setProcessing(true);
    try {
      const res = await billingAPI.createCheckoutSession(planSlug);
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        toast.error('Failed to create checkout session');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to start checkout');
    } finally {
      setProcessing(false);
    }
  };

  const locationDisplay = useMemo(() => resolveLocationDisplay(billingInfo || {}), [billingInfo]);
  const hasBillingInfo = useMemo(() => {
    if (!billingInfo) return false;
    return ['name', 'email', 'phone', 'address', 'country', 'state', 'city', 'zip'].some((key) => billingInfo[key]);
  }, [billingInfo]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f9fafb',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: '4px solid #e5e7eb',
              borderTop: '4px solid #2563eb',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p style={{ color: '#6b7280' }}>Loading checkout...</p>
        </div>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!plan) return null;

  const cycleLabel = plan.cycleType === 'custom'
    ? `${plan.customDays || 0} days`
    : plan.cycleType === 'yearly'
      ? 'year'
      : 'month';
  const priceLabel = plan.price === 0
    ? 'Free'
    : plan.paymentType === 'subscription'
      ? `$${plan.price}/${cycleLabel}`
      : `$${plan.price} one-time`;
  const checkoutButtonLabel = processing
    ? 'Redirecting...'
    : hasActivePaidSubscription
      ? 'Cancel Current Plan First'
      : plan.paymentType === 'subscription'
        ? `Subscribe - $${plan.price}/${cycleLabel}`
        : `Pay Once - $${plan.price}`;

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '40px 16px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <TenantCommonHeader compact={true} showNav={false} title="Checkout" subtitle="Review your plan and proceed to payment" />

        {hasActivePaidSubscription && (
          <div
            style={{
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: 8,
              padding: 16,
              marginBottom: 24,
              display: 'flex',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 20 }}>&#9888;</span>
            <div>
              <p style={{ fontWeight: 600, margin: 0 }}>Active Subscription Detected</p>
              <p style={{ margin: '4px 0', fontSize: 14 }}>
                You currently have an active paid <strong>{getPlanDisplayName(subscription?.plan)}</strong> plan.
              </p>

              {subscription?.subscription?.currentPeriodEnd && (
                <p style={{ fontSize: 13 }}>
                  Active until{' '}
                  <strong>
                    {new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString()}
                  </strong>
                </p>
              )}

              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  marginTop: 8,
                  background: '#f59e0b',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Go to Dashboard to Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              padding: 24,
            }}
          >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Billing Details</h2>
                  <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 13 }}>
                    These saved tenant billing details will be sent to Stripe and shown on the hosted payment page.
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/settings?tab=billing-info&returnTo=${encodeURIComponent(`/checkout/${planSlug}`)}`)}
                  style={{
                    border: '1px solid #d1d5db',
                    background: '#fff',
                    padding: '8px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Edit Billing Info
                </button>
              </div>

              {hasBillingInfo ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 18 }}>
                  {[
                    { label: 'Billing Name', value: billingInfo?.name || '--' },
                    { label: 'Billing Email', value: billingInfo?.email || '--' },
                    { label: 'Phone', value: billingInfo?.phone || '--' },
                    { label: 'ZIP / Postal Code', value: billingInfo?.zip || '--' },
                    { label: 'Country', value: locationDisplay.country },
                    { label: 'State', value: locationDisplay.state },
                    { label: 'City', value: locationDisplay.city },
                    { label: 'Same as Business', value: billingInfo?.sameAsBusiness ? 'Yes' : 'No' },
                    { label: 'Billing Address', value: billingInfo?.address || '--', fullWidth: true },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        background: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        padding: 12,
                        gridColumn: item.fullWidth ? '1 / -1' : 'auto',
                      }}
                    >
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{item.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    marginTop: 18,
                    background: '#fff7ed',
                    border: '1px solid #fdba74',
                    borderRadius: 8,
                    padding: 14,
                    color: '#9a3412',
                    fontSize: 14,
                  }}
                >
                  No tenant billing info is saved yet. Stripe will still ask for billing details at checkout, but you can save them first in Settings for a smoother flow.
                </div>
              )}
          </div>

          <div style={{ display: 'grid', gap: 24 }}>
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #e5e7eb',
                padding: 24,
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Plan Details</h2>

              <div
                style={{
                  background: '#eff6ff',
                  borderRadius: 8,
                  padding: 16,
                  marginTop: 12,
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 700 }}>{getPlanDisplayName(plan)} Plan</div>

                <div style={{ marginTop: 8 }}>
                  <span style={{ fontSize: 32, fontWeight: 800 }}>${plan.price}</span>
                  {plan.price > 0 && (
                    <span style={{ color: '#6b7280' }}>
                      {plan.paymentType === 'subscription' ? `/ ${cycleLabel}` : ' one-time'}
                    </span>
                  )}
                </div>

                {plan.description && (
                  <p style={{ fontSize: 14, marginTop: 8 }}>{plan.description}</p>
                )}
              </div>

              <ul style={{ listStyle: 'none', padding: 0, marginTop: 16 }}>
                {[
                  { label: 'Users', value: plan.features?.maxUsers },
                  { label: 'Branches', value: plan.features?.maxBranches },
                  { label: 'Products', value: plan.features?.maxProducts?.toLocaleString() },
                  { label: 'Invoices/month', value: plan.features?.maxInvoicesPerMonth?.toLocaleString() },
                ].map((feature) => (
                  <li key={feature.label} style={{ padding: '8px 0', fontSize: 14 }}>
                    &#10003; {feature.label}: <strong>{feature.value}</strong>
                  </li>
                ))}
              </ul>
            </div>

            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #e5e7eb',
                padding: 24,
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Billing Summary</h2>

              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{getPlanDisplayName(plan)}</span>
                  <span>{priceLabel}</span>
                </div>

                <div
                  style={{
                    borderTop: '1px solid #e5e7eb',
                    marginTop: 12,
                    paddingTop: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal</span>
                    <span>${plan.price}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Tax</span>
                    <span>Calculated at checkout</span>
                  </div>
                </div>

                <div
                  style={{
                    borderTop: '1px solid #e5e7eb',
                    marginTop: 12,
                    paddingTop: 12,
                    fontWeight: 700,
                    fontSize: 18,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Total</span>
                  <span>{priceLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 32,
          }}
        >
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              border: '1px solid #d1d5db',
              background: '#fff',
              padding: '12px 24px',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            &#8592; Back
          </button>

          <button
            onClick={handleCheckout}
            disabled={processing || hasActivePaidSubscription}
            style={{
              background: hasActivePaidSubscription ? '#9ca3af' : '#2563eb',
              color: '#fff',
              border: 'none',
              padding: '12px 32px',
              borderRadius: 8,
              cursor: hasActivePaidSubscription ? 'not-allowed' : 'pointer',
              fontWeight: 700,
            }}
          >
            {processing
              ? 'Redirecting...'
              : checkoutButtonLabel}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12 }}>
          <p>{plan.paymentType === 'subscription' ? 'You can cancel anytime from your dashboard.' : 'This plan will be charged once and activated for its configured duration.'}</p>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
