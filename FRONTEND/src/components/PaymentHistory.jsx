import React, { useEffect, useMemo, useState } from 'react';
import { billingAPI } from '../services/api';
import { useToast } from './Toast';

const formatAmount = (amount, currency = 'usd') => {
  if (amount === undefined || amount === null) return '--';

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: String(currency || 'usd').toUpperCase(),
    }).format((amount || 0) / 100);
  } catch {
    return `${amount}`;
  }
};

const getStatusPillStyle = (status) => {
  const value = String(status || '').toLowerCase();

  if (value === 'paid') {
    return { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' };
  }
  if (value === 'pending') {
    return { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' };
  }
  if (value === 'failed' || value === 'overdue') {
    return { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' };
  }
  return { background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' };
};

export default function PaymentHistory({ styles }) {
  const toast = useToast();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let isMounted = true;

    billingAPI.listInvoices(1, 50)
      .then((res) => {
        if (!isMounted) return;
        setInvoices(res.data?.invoices || []);
      })
      .catch((err) => {
        if (!isMounted) return;
        toast.error(err?.response?.data?.message || 'Failed to load invoices');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [toast]);

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;

    return invoices.filter((invoice) => {
      const invoiceNo = invoice.invoiceNumber || '';
      const status = invoice.status || '';
      const plan = invoice.plan || '';
      const billingName = invoice.billingSnapshot?.name || '';
      return [invoiceNo, status, plan, billingName].some((field) => field.toLowerCase().includes(q));
    });
  }, [invoices, search]);

  const paidCount = invoices.filter((invoice) => String(invoice.status || '').toLowerCase() === 'paid').length;
  const totalAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

  return (
    <div>
      <div style={styles.sectionHeader}>
        <div>
                    <div style={styles.sectionSub}>Review your subscription invoices and payment records.</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 20 }}>
        <div
          style={{
            borderRadius: 20,
            border: '1px solid #dbe3f0',
            background: 'linear-gradient(135deg, #f8fbff 0%, #eef4ff 55%, #ffffff 100%)',
            padding: 24,
            display: 'grid',
            gridTemplateColumns: '1.2fr 0.8fr',
            gap: 20,
          }}
          className="settings-hero-grid"
        >
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>Invoice History</div>
            <div style={{ marginTop: 8, fontSize: 15, color: '#475569' }}>Browse your billing records, verify payment status, and open hosted invoice documents when they are available.</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18, display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Quick Snapshot</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: '#64748b' }}>Invoices</span><strong style={{ color: '#111827' }}>{invoices.length}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: '#64748b' }}>Paid</span><strong style={{ color: '#111827' }}>{paidCount}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: '#64748b' }}>Total Amount</span><strong style={{ color: '#111827' }}>{formatAmount(totalAmount, invoices[0]?.currency || 'usd')}</strong></div>
          </div>
        </div>

        <div style={{ ...styles.tableHeader, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 0 }}>
          <div style={styles.searchWrap}>
            <input
              style={styles.searchInput}
              placeholder="Search invoices, plans, or billing names..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.9fr 0.8fr 0.6fr', background: '#f8fafc', padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }} className="payment-history-head">
            <div>Invoice</div>
            <div>Date</div>
            <div>Amount</div>
            <div>Status</div>
            <div>Action</div>
          </div>
          {loading ? (
            <div style={{ padding: '16px', color: '#6b7280' }}>Loading payment history...</div>
          ) : filteredInvoices.length > 0 ? (
            filteredInvoices.map((invoice) => (
              <div key={invoice._id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.9fr 0.8fr 0.6fr', padding: '14px 16px', borderTop: '1px solid #f1f5f9', alignItems: 'center', gap: 12 }} className="payment-history-row">
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{invoice.invoiceNumber || '--'}</div>
                  {(invoice.billingSnapshot?.name || invoice.plan) && (
                    <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
                      {invoice.billingSnapshot?.name ? `Billing to ${invoice.billingSnapshot.name}` : `Plan: ${invoice.plan}`}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 14, color: '#111827' }}>{new Date(invoice.createdAt).toLocaleDateString()}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{formatAmount(invoice.amount, invoice.currency)}</div>
                <div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, textTransform: 'capitalize', ...getStatusPillStyle(invoice.status) }}>
                    {invoice.status || 'unknown'}
                  </span>
                </div>
                <div>
                  {(invoice.pdfUrl || invoice.invoiceUrl) ? (
                    <a href={invoice.pdfUrl || invoice.invoiceUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>
                      View
                    </a>
                  ) : (
                    <span style={{ color: '#9ca3af', fontWeight: 600 }}>--</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '16px', color: '#6b7280' }}>No payment history found.</div>
          )}
        </div>

        <style>{`
          @media (max-width: 900px) {
            .settings-hero-grid {
              grid-template-columns: 1fr !important;
            }
          }
          @media (max-width: 760px) {
            .payment-history-head,
            .payment-history-row {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
