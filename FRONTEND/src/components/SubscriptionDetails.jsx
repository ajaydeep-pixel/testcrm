import React from 'react';

export default function SubscriptionDetails({ details, styles }) {
  return (
    <div>
      <div style={styles.sectionHeader}>
        <div>
          <div style={styles.sectionTitle}>Subscription Details</div>
          <div style={styles.sectionSub}>Track plan usage and upcoming renewals.</div>
        </div>
        <button style={styles.primaryBtn}>Upgrade Plan</button>
      </div>
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
          <div style={styles.infoValue}>{details?.status || 'N/A'}</div>
        </div>
        <div style={styles.infoCard}>
          <div style={styles.infoLabel}>Next Billing</div>
          <div style={styles.infoValue}>{details?.nextBilling || 'N/A'}</div>
        </div>
      </div>
    </div>
  );
}
