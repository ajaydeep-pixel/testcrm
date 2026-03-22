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

  return (
    <div>
      <div style={styles.sectionHeader}>
        <div>
          <div style={styles.sectionTitle}>Payment History & Invoices</div>
          <div style={styles.sectionSub}>Review your subscription invoices and payment records.</div>
        </div>
      </div>
      <div style={styles.tableHeader}>
        <div style={styles.searchWrap}>
          <input
            style={styles.searchInput}
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div style={styles.table}>
        <div style={styles.tableRowHead}>
          <div>Invoice</div>
          <div>Date</div>
          <div>Amount</div>
          <div>Status</div>
          <div>Actions</div>
        </div>
        {loading ? (
          <div style={{ padding: '14px', color: '#6b7280' }}>Loading payment history...</div>
        ) : filteredInvoices.length > 0 ? (
          filteredInvoices.map((invoice) => (
            <div key={invoice._id} style={styles.tableRow}>
              <div>
                <div>{invoice.invoiceNumber || '--'}</div>
                {(invoice.billingSnapshot?.name || invoice.plan) && (
                  <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
                    {invoice.billingSnapshot?.name ? `Billing to ${invoice.billingSnapshot.name}` : `Plan: ${invoice.plan}`}
                  </div>
                )}
              </div>
              <div>{new Date(invoice.createdAt).toLocaleDateString()}</div>
              <div>{formatAmount(invoice.amount, invoice.currency)}</div>
              <div>
                <span style={styles.statusPill}>{invoice.status || 'unknown'}</span>
              </div>
              <div>
                {(invoice.pdfUrl || invoice.invoiceUrl) ? (
                  <a href={invoice.pdfUrl || invoice.invoiceUrl} target="_blank" rel="noopener noreferrer" style={styles.linkBtn}>
                    View
                  </a>
                ) : (
                  <span style={{ color: '#9ca3af', fontWeight: 600 }}>Unavailable</span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: '14px', color: '#6b7280' }}>No payment history found.</div>
        )}
      </div>
    </div>
  );
}
