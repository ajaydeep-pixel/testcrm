
import React from 'react';
import BillingInfo from './BillingInfo';
import BusinessInfo from './BusinessInfo';
import PasswordChange from './PasswordChange';
import SubscriptionDetails from './SubscriptionDetails';
import PaymentHistory from './PaymentHistory';

export default function SettingsMenu() {
  const [selectedTab, setSelectedTab] = React.useState(0);

  // Example data for subscription and payment history
  const subscriptionDetails = {
    plan: 'Pro',
    price: '$79.99',
    status: 'Active',
    nextBilling: '2026-04-01',
  };
  const paymentHistory = [
    { date: '2026-03-01', amount: '$79.99', invoiceUrl: '#' },
    { date: '2026-02-01', amount: '$79.99', invoiceUrl: '#' },
  ];

  const styles = {
    page: {
      minHeight: '100vh',
      background: '#f3f5f9',
    },
    shell: {
      maxWidth: 1280,
      margin: '0 auto',
      padding: '32px 24px',
    },
    card: {
      background: '#ffffff',
      borderRadius: 16,
      border: '1px solid #e3e8ef',
      boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
      padding: 0,
      overflow: 'hidden',
    },
    layout: {
      display: 'grid',
      gridTemplateColumns: '260px 1fr',
      minHeight: 520,
    },
    sidebar: {
      background: 'linear-gradient(180deg, #f7f9fc 0%, #f1f4f9 100%)',
      borderRight: '1px solid #e3e8ef',
      padding: '20px 12px',
    },
    sidebarTitle: {
      fontSize: 12,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: '#6b7280',
      fontWeight: 700,
      padding: '6px 12px 12px',
    },
    tabs: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    },
    tab: (active) => ({
      border: '1px solid',
      borderColor: active ? '#c7d2fe' : 'transparent',
      background: active ? '#eef2ff' : 'transparent',
      color: active ? '#1e3a8a' : '#1f2937',
      borderRadius: 10,
      padding: '10px 12px',
      fontWeight: 600,
      fontSize: 14,
      cursor: 'pointer',
      textAlign: 'left',
      transition: 'all 0.12s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    }),
    tabMeta: {
      fontSize: 12,
      color: '#6b7280',
      fontWeight: 500,
    },
    content: {
      padding: '24px 28px',
      background: '#ffffff',
    },
    contentHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 14,
      borderBottom: '1px solid #eef2f7',
      marginBottom: 18,
    },
    contentTitle: {
      fontSize: 18,
      fontWeight: 700,
      color: '#111827',
    },
    contentHint: {
      fontSize: 12,
      color: '#6b7280',
      fontWeight: 500,
    },
    sectionHeader: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
      marginBottom: 18,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 700,
      color: '#111827',
    },
    sectionSub: {
      fontSize: 13,
      color: '#6b7280',
      marginTop: 4,
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: 16,
      alignItems: 'start',
    },
    field: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    },
    label: {
      fontSize: 12,
      color: '#6b7280',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
    },
    input: {
      border: '1px solid #e2e8f0',
      borderRadius: 10,
      padding: '10px 12px',
      fontSize: 14,
      outline: 'none',
      background: '#ffffff',
    },
    select: {
      border: '1px solid #e2e8f0',
      borderRadius: 10,
      padding: '10px 12px',
      fontSize: 14,
      background: '#ffffff',
    },
    textarea: {
      border: '1px solid #e2e8f0',
      borderRadius: 10,
      padding: '10px 12px',
      fontSize: 14,
      resize: 'vertical',
      background: '#ffffff',
    },
    actions: {
      display: 'flex',
      gap: 12,
      justifyContent: 'flex-end',
      gridColumn: '1 / -1',
      paddingTop: 6,
    },
    primaryBtn: {
      background: '#2563eb',
      color: '#ffffff',
      border: 'none',
      borderRadius: 10,
      padding: '10px 16px',
      fontWeight: 600,
      cursor: 'pointer',
      boxShadow: '0 6px 14px rgba(37, 99, 235, 0.2)',
    },
    secondaryBtn: {
      background: '#ffffff',
      color: '#1f2937',
      border: '1px solid #e2e8f0',
      borderRadius: 10,
      padding: '10px 16px',
      fontWeight: 600,
      cursor: 'pointer',
    },
    ghostBtn: {
      background: 'none',
      color: '#1f2937',
      border: '1px solid #e2e8f0',
      borderRadius: 10,
      padding: '8px 14px',
      fontWeight: 600,
      cursor: 'pointer',
    },
    summaryGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: 14,
    },
    summaryItem: {
      padding: 12,
      borderRadius: 10,
      border: '1px solid #eef2f7',
      background: '#f8fafc',
    },
    summaryLabel: {
      fontSize: 12,
      color: '#6b7280',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
    },
    summaryValue: {
      fontSize: 14,
      color: '#111827',
      fontWeight: 600,
      marginTop: 6,
    },
    infoGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: 16,
    },
    infoCard: {
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      padding: 16,
      background: '#f8fafc',
    },
    infoLabel: {
      fontSize: 12,
      color: '#6b7280',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
    },
    infoValue: {
      fontSize: 18,
      fontWeight: 700,
      color: '#111827',
      marginTop: 6,
    },
    tableHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
      gap: 12,
      flexWrap: 'wrap',
    },
    searchWrap: {
      flex: 1,
      minWidth: 200,
    },
    searchInput: {
      width: '100%',
      border: '1px solid #e2e8f0',
      borderRadius: 10,
      padding: '10px 12px',
      fontSize: 14,
    },
    table: {
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      overflowX: 'auto',
    },
    tableRowHead: {
      display: 'grid',
      gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr 0.8fr',
      background: '#f3f6fb',
      padding: '10px 14px',
      fontWeight: 700,
      fontSize: 13,
      color: '#374151',
    },
    tableRow: {
      display: 'grid',
      gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr 0.8fr',
      padding: '10px 14px',
      borderTop: '1px solid #eef2f7',
      fontSize: 14,
      color: '#111827',
    },
    statusPill: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 10px',
      borderRadius: 999,
      background: '#e0f2fe',
      color: '#0369a1',
      fontWeight: 600,
      fontSize: 12,
    },
    linkBtn: {
      background: 'none',
      border: 'none',
      color: '#2563eb',
      fontWeight: 600,
      cursor: 'pointer',
    },
  };

  const menuOptions = [
    { label: 'Billing Info', component: <BillingInfo styles={styles} /> },
    { label: 'Business Info', component: <BusinessInfo styles={styles} /> },
    { label: 'Password', component: <PasswordChange styles={styles} /> },
    { label: 'Subscription Details', component: <SubscriptionDetails details={subscriptionDetails} styles={styles} /> },
    { label: 'Payment History & Invoices', component: <PaymentHistory history={paymentHistory} styles={styles} /> },
  ];

  return (
    <div style={styles.page}>
      <main style={styles.shell}>
        <div style={styles.card}>
          <div style={styles.layout} className="settings-layout">
            <aside style={styles.sidebar} className="settings-sidebar">
              <div style={styles.sidebarTitle}>Settings Menu</div>
              <div style={styles.tabs} className="settings-tabs">
                {menuOptions.map((option, idx) => (
                  <button
                    key={option.label}
                    onClick={() => setSelectedTab(idx)}
                    style={styles.tab(selectedTab === idx)}
                    className="settings-tab"
                  >
                    <span>{option.label}</span>
                    {selectedTab === idx && <span style={styles.tabMeta}>Active</span>}
                  </button>
                ))}
              </div>
            </aside>
            <section style={styles.content}>
              <div style={styles.contentHeader}>
                <div style={styles.contentTitle}>{menuOptions[selectedTab].label}</div>
                <div style={styles.contentHint}>Updated just now</div>
              </div>
              <div>{menuOptions[selectedTab].component}</div>
            </section>
          </div>
        </div>
      </main>
      <style>{`
        .settings-layout {
          display: grid;
          grid-template-columns: 260px 1fr;
        }
        @media (max-width: 900px) {
          .settings-layout {
            grid-template-columns: 1fr;
          }
          .settings-sidebar {
            border-right: none !important;
            border-bottom: 1px solid #e3e8ef;
          }
          .settings-tabs {
            flex-direction: row;
            flex-wrap: wrap;
          }
          .settings-tab {
            min-width: 160px;
          }
        }
        @media (max-width: 600px) {
          .settings-tab {
            min-width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
