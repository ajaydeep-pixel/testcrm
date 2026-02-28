import React, { useEffect, useState } from 'react';
import styles from './BillingScreen.module.css';
import { apiService } from '../services/apiService';
import BusinessSettings from './BusinessSettings.jsx';

function InvoicesScreen({ refreshKey }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showBusinessSettings, setShowBusinessSettings] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [printInvoice, setPrintInvoice] = useState(null);
  const [businessProfile, setBusinessProfile] = useState({});

  const loadInvoices = async (targetPage = page, query = q) => {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.get(`/sales?q=${encodeURIComponent(query)}&page=${targetPage}&limit=${limit}`);
      setItems(Array.isArray(data.items) ? data.items : []);
      setPage(data.page || targetPage);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.message || 'Could not load invoices');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices(1, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('businessProfile');
      setBusinessProfile(raw ? JSON.parse(raw) : {});
    } catch (e) {
      setBusinessProfile({});
    }
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    loadInvoices(1, q);
  };

  return (
    <div className={styles.crmPageCard}>
      <div className={styles.crmPageHeader}>
        <div>
          <h2>Invoices</h2>
          <p>All submitted billing invoices</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.secondaryBtn} type="button" onClick={() => setShowBusinessSettings(true)}>Business Details</button>
        </div>
      </div>

      <form className={styles.crmInlineForm} onSubmit={handleSearch}>
        <input
          className={styles.searchInput}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by invoice no, customer name/email/phone"
        />
        <button className={styles.searchButton} type="submit" disabled={loading}>
          {loading ? 'Loading...' : 'Search'}
        </button>
      </form>

      {error && <div className={styles.crmError}>{error}</div>}

      <div className={styles.crmTableWrap}>
        <table className={styles.crmTable}>
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Date</th>
              <th>Items</th>
              <th>Payment</th>
              <th>Discount</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="8" className={styles.crmEmptyCell}>No invoices found</td>
              </tr>
            ) : (
              items.map((inv) => (
                <tr key={inv._id}>
                  <td>{inv.invoiceNo}</td>
                  <td>{new Date(inv.createdAt).toLocaleString()}</td>
                  <td>{Array.isArray(inv.items) ? inv.items.length : 0}</td>
                  <td>{inv.paymentMethod || '-'}</td>
                  <td>${Number(inv.discountAmount || 0).toFixed(2)}</td>
                  <td>${Number(inv.totalAmount || 0).toFixed(2)}</td>
                  <td>${Number(inv.paidAmount || 0).toFixed(2)}</td>
                  <td>
                    <button className={styles.tableBtnPrimary} onClick={() => setSelectedInvoice(inv)}>Invoice</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showBusinessSettings && (
        <BusinessSettings onClose={() => setShowBusinessSettings(false)} />
      )}

      {selectedInvoice && (
        <div className={styles.modalOverlay} onClick={() => setSelectedInvoice(null)} role="dialog" aria-modal="true">
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ width: 680 }}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {businessProfile.logoUrl ? <img src={businessProfile.logoUrl} alt="logo" style={{ maxHeight: 48 }} /> : null}
                <div>
                  <div style={{ fontWeight: 800 }}>{businessProfile.shopName || 'BIKE PARTS POS'}</div>
                  {businessProfile.address && <div style={{ fontSize: 12 }}>{businessProfile.address}</div>}
                  <div style={{ fontSize: 12 }}>{businessProfile.phone ? `Phone: ${businessProfile.phone}` : ''} {businessProfile.gstNumber ? ` GST: ${businessProfile.gstNumber}` : ''}</div>
                </div>
              </div>
              <h4 style={{ marginTop: 8 }}>Invoice - {selectedInvoice.invoiceNo}</h4>
              <button type="button" className={styles.closeIconBtn} onClick={() => setSelectedInvoice(null)}>X</button>
            </div>
            <div style={{ padding: 8 }}>
              {selectedInvoice.customer && (
                <div style={{ marginBottom: 8 }}>
                  <strong>Customer:</strong> {selectedInvoice.customer.name || ''} {selectedInvoice.customer.phone ? `— ${selectedInvoice.customer.phone}` : ''}
                </div>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Item</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.items.map((it, idx) => (
                    <tr key={idx}>
                      <td>{it.name}</td>
                      <td style={{ textAlign: 'right' }}>{it.quantity}</td>
                      <td style={{ textAlign: 'right' }}>${Number(it.price).toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>${(Number(it.price) * Number(it.quantity)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 12, textAlign: 'right' }}>
                <div>Discount: ${Number(selectedInvoice.discountAmount || 0).toFixed(2)}</div>
                <div>GST: ${Number(selectedInvoice.gstAmount || 0).toFixed(2)}</div>
                <div style={{ fontWeight: 800 }}>Total: ${Number(selectedInvoice.totalAmount || 0).toFixed(2)}</div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className={styles.secondaryBtn} onClick={() => setSelectedInvoice(null)}>Close</button>
                <button className={styles.saveBtn} onClick={() => { setPrintInvoice(selectedInvoice); setTimeout(() => { window.print(); setPrintInvoice(null); }, 300); }}>Print</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {printInvoice && (
        <div className={styles.receiptContainer} style={{ display: 'block' }}>
          <div className={styles.receiptHeader}>
            {businessProfile.logoUrl ? (
              <img src={businessProfile.logoUrl} alt="logo" style={{ maxHeight: 64, marginBottom: 6 }} />
            ) : null}
            <h3>{businessProfile.shopName || 'BIKE PARTS POS'}</h3>
            {businessProfile.address && <div style={{ fontSize: 12 }}>{businessProfile.address}</div>}
            {businessProfile.phone && <div style={{ fontSize: 12 }}>Phone: {businessProfile.phone}</div>}
            {businessProfile.gstNumber && <div style={{ fontSize: 12 }}>GST: {businessProfile.gstNumber}</div>}
            {printInvoice.customer && (
              <div style={{ marginTop: 6 }}>
                <strong>Customer:</strong> {printInvoice.customer.name || ''} {printInvoice.customer.phone ? `— ${printInvoice.customer.phone}` : ''}
              </div>
            )}
            <p style={{ marginTop: 6 }}>Invoice: {printInvoice.invoiceNo}</p>
            <p>Date: {new Date(printInvoice.createdAt).toLocaleString()}</p>
          </div>
          <table className={styles.receiptTable}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {printInvoice.items.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>${Number(item.price).toFixed(2)}</td>
                  <td>${(Number(item.price) * Number(item.quantity)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.receiptTotalRow}>
            <span>Subtotal:</span>
            <span>${(Number(printInvoice.totalAmount || 0) - Number(printInvoice.gstAmount || 0) + Number(printInvoice.discountAmount || 0)).toFixed(2)}</span>
          </div>
          <div className={styles.receiptTotalRow}>
            <span>GST:</span>
            <span>${Number(printInvoice.gstAmount || 0).toFixed(2)}</span>
          </div>
          {printInvoice.discountAmount > 0 && (
            <div className={styles.receiptTotalRow}>
              <span>Discount:</span>
              <span>-${Number(printInvoice.discountAmount || 0).toFixed(2)}</span>
            </div>
          )}
          <div className={styles.receiptTotalRow}>
            <span>GRAND TOTAL:</span>
            <span>${Number(printInvoice.totalAmount || 0).toFixed(2)}</span>
          </div>
        </div>
      )}

      <div className={styles.paginationBar}>
        <button className={styles.tableBtn} type="button" disabled={page <= 1} onClick={() => loadInvoices(page - 1, q)}>Prev</button>
        <span>Page {page} / {totalPages}</span>
        <button className={styles.tableBtn} type="button" disabled={page >= totalPages} onClick={() => loadInvoices(page + 1, q)}>Next</button>
      </div>
    </div>
  );
}

export default InvoicesScreen;
