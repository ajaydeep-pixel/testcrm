import React from 'react';

export default function PaymentHistory({ history, styles }) {
  return (
    <div>
      <div style={styles.sectionHeader}>
        <div>
          <div style={styles.sectionTitle}>Payment History & Invoices</div>
          <div style={styles.sectionSub}>Search and download invoices anytime.</div>
        </div>
        <button style={styles.primaryBtn}>Download All</button>
      </div>
      <div style={styles.tableHeader}>
        <div style={styles.searchWrap}>
          <input style={styles.searchInput} placeholder="Search invoices..." />
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
        {history && history.length > 0 ? (
          history.map((item, idx) => (
            <div key={`${item.date}-${idx}`} style={styles.tableRow}>
              <div>{`INV-${1021 - idx}`}</div>
              <div>{item.date}</div>
              <div>{item.amount}</div>
              <div>
                <span style={styles.statusPill}>Paid</span>
              </div>
              <div>
                <a href={item.invoiceUrl} target="_blank" rel="noopener noreferrer" style={styles.linkBtn}>
                  View
                </a>
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
