import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { billingAPI } from '../services/api';
import { useToast } from './Toast';
import { getPlanDisplayName } from '../utils/planDisplay';

const formatDate = (value) => {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return 'N/A';
  }
};

const formatDuration = (plan) => {
  if (!plan) return 'N/A';
  if (plan.cycleType === 'custom') return `${plan.customDays || 0} days`;
  if (plan.cycleType === 'yearly') return 'Yearly';
  if (plan.cycleType === 'monthly') return 'Monthly';
  return plan.cycleType || 'N/A';
};

const formatPrice = (plan) => {
  if (!plan) return 'N/A';
  if (plan.price === 0) return 'Free';
  if (plan.paymentType === 'subscription') {
    return `$${plan.price}/${plan.cycleType === 'custom' ? `${plan.customDays || 0} days` : plan.cycleType}`;
  }
  return `$${plan.price} one-time`;
};

const formatWindow = (seconds) => {
  if (!seconds && seconds !== 0) return 'N/A';
  if (seconds === 60) return '1 minute';
  if (seconds === 3600) return '1 hour';
  if (seconds === 86400) return '1 day';
  return `${seconds} seconds`;
};

const getStatusPillStyle = (status) => {
  const value = String(status || '').toLowerCase();

  if (value === 'active') {
    return { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' };
  }
  if (value === 'trialing') {
    return { background: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd' };
  }
  if (value === 'canceling') {
    return { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' };
  }
  if (value === 'past_due' || value === 'incomplete') {
    return { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' };
  }
  if (value === 'canceled' || value === 'expired' || value === 'suspended') {
    return { background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' };
  }
  return { background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' };
};

const sectionCard = {
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  background: '#ffffff',
  overflow: 'hidden',
};

const sectionHeader = {
  padding: '14px 18px',
  borderBottom: '1px solid #eef2f7',
  background: '#f8fafc',
  fontSize: 13,
  fontWeight: 700,
  color: '#111827',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};

const rowGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
};

const rowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  padding: '14px 18px',
  borderBottom: '1px solid #f1f5f9',
};

function DetailSection({ title, rows }) {
  const filtered = rows.filter((row) => row && row.value !== undefined && row.value !== null && row.value !== 'N/A');
  if (filtered.length === 0) return null;

  return (
    <div style={sectionCard}>
      <div style={sectionHeader}>{title}</div>
      <div style={rowGrid} className="subscription-detail-grid">
        {filtered.map((row) => (
          <div key={row.label} style={rowStyle}>
            <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>{row.label}</div>
            <div style={{ fontSize: 14, color: '#111827', fontWeight: 700, textAlign: 'right', wordBreak: 'break-word' }}>
              {row.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SubscriptionDetails({ styles }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      billingAPI.getSubscriptionStatus(),
      billingAPI.getPlans(),
    ])
      .then(([subscriptionRes, plansRes]) => {
        if (!isMounted) return;

        const subscriptionStatus = subscriptionRes.data || null;
        const plans = plansRes.data?.plans || [];
        const currentPlan = subscriptionStatus?.planDetails || plans.find((plan) => plan.slug === subscriptionStatus?.plan);
        const currentSubscription = subscriptionStatus?.subscription || null;
        const isTrial = currentSubscription?.status === 'trialing';
        const currentPeriodStart = currentSubscription?.currentPeriodStart || subscriptionStatus?.trialStartAt || null;
        const currentPeriodEnd = currentSubscription?.currentPeriodEnd || subscriptionStatus?.trialEndAt || null;
        const trialDaysRemaining = subscriptionStatus?.trialEndAt
          ? Math.max(0, Math.ceil((new Date(subscriptionStatus.trialEndAt) - new Date()) / (1000 * 60 * 60 * 24)))
          : null;

        setDetails({
          planName: getPlanDisplayName(currentPlan, subscriptionStatus?.plan || 'Trial'),
          price: formatPrice(currentPlan),
          paymentType: currentPlan?.paymentType === 'subscription' ? 'Subscription' : currentPlan?.paymentType === 'one_time' ? 'One-Time' : 'N/A',
          duration: formatDuration(currentPlan),
          status: currentSubscription?.status || (subscriptionStatus?.plan ? 'trialing' : 'N/A'),
          gateway: currentSubscription?.gateway || 'N/A',
          nextBilling: currentPlan?.paymentType === 'subscription' ? formatDate(currentSubscription?.currentPeriodEnd) : 'N/A',
          currentPeriodStart: formatDate(currentPeriodStart),
          currentPeriodEnd: formatDate(currentPeriodEnd),
          cancelAtPeriodEnd: currentSubscription?.cancelAtPeriodEnd ? 'Yes' : 'No',
          canceledAt: formatDate(currentSubscription?.canceledAt),
          trialStart: formatDate(subscriptionStatus?.trialStartAt),
          trialEnd: formatDate(subscriptionStatus?.trialEndAt),
          trialDaysRemaining: trialDaysRemaining === null ? 'N/A' : `${trialDaysRemaining} days`,
          subscriptionId: currentPlan?.paymentType === 'subscription' && currentSubscription?.id ? currentSubscription.id : 'N/A',
          isPaid: subscriptionStatus?.isPaid ? 'Paid' : 'Free',
          usage: subscriptionStatus?.usage || {},
          limits: currentPlan?.features || {},
          rateLimitRequests: currentPlan?.rateLimit?.requests ?? null,
          rateLimitWindow: formatWindow(currentPlan?.rateLimit?.window),
          showTrialBlock: isTrial || Boolean(subscriptionStatus?.trialStartAt || subscriptionStatus?.trialEndAt),
        });
      })
      .catch((err) => {
        if (!isMounted) return;
        toast.error(err?.response?.data?.message || 'Failed to load subscription details');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [toast]);

  return (
    <div>
      <div style={styles.sectionHeader}>
        <div>
                    <div style={styles.sectionSub}>Track your current plan, billing status, trial timeline, and usage limits.</div>
        </div>
        <button style={styles.primaryBtn} onClick={() => navigate('/dashboard')}>
          View Plans
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: 14 }}>Loading subscription details...</div>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          <div
            style={{
              borderRadius: 20,
              border: '1px solid #dbe3f0',
              background: 'linear-gradient(135deg, #f8fbff 0%, #eef4ff 55%, #ffffff 100%)',
              padding: 24,
              display: 'grid',
              gridTemplateColumns: '1.4fr 0.8fr',
              gap: 24,
            }}
            className="subscription-hero"
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{details?.planName || 'N/A'}</div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '6px 12px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 700,
                    textTransform: 'capitalize',
                    ...getStatusPillStyle(details?.status),
                  }}
                >
                  {details?.status || 'N/A'}
                </span>
              </div>
              <div style={{ marginTop: 10, fontSize: 15, color: '#475569' }}>
                {details?.paymentType || 'N/A'} � {details?.duration || 'N/A'} � {details?.isPaid || 'N/A'}
              </div>
              <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }} className="subscription-hero-stats">
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Price</div>
                  <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800, color: '#111827' }}>{details?.price || 'N/A'}</div>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Next Billing</div>
                  <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800, color: '#111827' }}>{details?.nextBilling || 'N/A'}</div>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Gateway</div>
                  <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800, color: '#111827', textTransform: 'capitalize' }}>{details?.gateway || 'N/A'}</div>
                </div>
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick Usage</div>
              <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', marginBottom: 6 }}>
                    <span>Invoices</span>
                    <span>{details?.usage?.invoiceCount ?? 0} / {details?.limits?.maxInvoicesPerMonth ?? 'N/A'}</span>
                  </div>
                  <div style={{ height: 8, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, ((details?.usage?.invoiceCount ?? 0) / Math.max(1, details?.limits?.maxInvoicesPerMonth || 1)) * 100)}%`, background: '#2563eb', height: '100%' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', marginBottom: 6 }}>
                    <span>Users</span>
                    <span>{details?.usage?.activeUsers ?? 0} / {details?.limits?.maxUsers ?? 'N/A'}</span>
                  </div>
                  <div style={{ height: 8, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, ((details?.usage?.activeUsers ?? 0) / Math.max(1, details?.limits?.maxUsers || 1)) * 100)}%`, background: '#0f766e', height: '100%' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 6, fontSize: 13, color: '#475569' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>API Calls</span><strong style={{ color: '#111827' }}>{details?.usage?.apiCallsThisMonth ?? 0}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Storage</span><strong style={{ color: '#111827' }}>{details?.usage?.storageMB ?? 0} MB</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Rate Limit</span><strong style={{ color: '#111827' }}>{details?.rateLimitRequests ?? 'N/A'} / {details?.rateLimitWindow || 'N/A'}</strong></div>
                </div>
              </div>
            </div>
          </div>

          <DetailSection
            title="Billing Timeline"
            rows={[
              { label: 'Current Period Start', value: details?.currentPeriodStart },
              { label: 'Current Period End', value: details?.currentPeriodEnd },
              { label: 'Next Billing Date', value: details?.nextBilling },
              { label: 'Cancel At Period End', value: details?.cancelAtPeriodEnd },
              { label: 'Canceled At', value: details?.canceledAt },
              { label: 'Subscription ID', value: details?.subscriptionId },
            ]}
          />

          {details?.showTrialBlock && (
            <DetailSection
              title="Trial Information"
              rows={[
                { label: 'Trial Start', value: details?.trialStart },
                { label: 'Trial End', value: details?.trialEnd },
                { label: 'Days Remaining', value: details?.trialDaysRemaining },
              ]}
            />
          )}

          <DetailSection
            title="Plan Limits"
            rows={[
              { label: 'Invoices Limit', value: details?.limits?.maxInvoicesPerMonth ?? 'N/A' },
              { label: 'Users Limit', value: details?.limits?.maxUsers ?? 'N/A' },
              { label: 'Branches Limit', value: details?.limits?.maxBranches ?? 'N/A' },
              { label: 'Products Limit', value: details?.limits?.maxProducts ?? 'N/A' },
            ]}
          />

          <style>{`
            @media (max-width: 900px) {
              .subscription-hero {
                grid-template-columns: 1fr !important;
              }
              .subscription-hero-stats {
                grid-template-columns: 1fr !important;
              }
            }
            @media (max-width: 720px) {
              .subscription-detail-grid {
                grid-template-columns: 1fr !important;
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
