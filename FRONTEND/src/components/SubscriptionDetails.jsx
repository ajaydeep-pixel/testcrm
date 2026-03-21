import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { billingAPI } from '../services/api';
import { useToast } from './Toast';
import { getPlanDisplayName } from '../utils/planDisplay';

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

        const subscription = subscriptionRes.data || null;
        const plans = plansRes.data?.plans || [];
        const currentPlan = plans.find((plan) => plan.slug === subscription?.plan);
        const priceLabel = currentPlan
          ? currentPlan.price === 0
            ? 'Free'
            : currentPlan.paymentType === 'subscription'
              ? `$${currentPlan.price}/${currentPlan.cycleType === 'custom' ? `${currentPlan.customDays || 0} days` : currentPlan.cycleType}`
              : `$${currentPlan.price} one-time`
          : 'N/A';

        setDetails({
          plan: getPlanDisplayName(currentPlan, subscription?.plan || 'Trial'),
          price: priceLabel,
          status: subscription?.subscription?.status || (subscription?.plan ? 'trial' : 'N/A'),
          nextBilling: subscription?.subscription?.currentPeriodEnd
            ? new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
            : subscription?.trialEndAt
              ? new Date(subscription.trialEndAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : 'N/A',
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
          <div style={styles.sectionTitle}>Subscription Details</div>
          <div style={styles.sectionSub}>Track your current plan, status, and next billing date.</div>
        </div>
        <button style={styles.primaryBtn} onClick={() => navigate('/dashboard')}>
          View Plans
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: 14 }}>Loading subscription details...</div>
      ) : (
        <div style={styles.infoGrid}>
          <div style={styles.infoCard}>
            <div style={styles.infoLabel}>Current Plan</div>
            <div style={styles.infoValue}>{details?.plan || 'N/A'}</div>
          </div>
          <div style={styles.infoCard}>
            <div style={styles.infoLabel}>Price</div>
            <div style={styles.infoValue}>{details?.price || 'N/A'}</div>
          </div>
          <div style={styles.infoCard}>
            <div style={styles.infoLabel}>Status</div>
            <div style={{ ...styles.infoValue, textTransform: 'capitalize' }}>
              {details?.status || 'N/A'}
            </div>
          </div>
          <div style={styles.infoCard}>
            <div style={styles.infoLabel}>Next Billing</div>
            <div style={styles.infoValue}>{details?.nextBilling || 'N/A'}</div>
          </div>
        </div>
      )}
    </div>
  );
}
