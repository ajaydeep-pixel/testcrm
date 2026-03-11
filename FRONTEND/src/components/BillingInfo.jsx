import React, { useState } from 'react';

export default function BillingInfo({ onSave, styles }) {
  const [billing, setBilling] = useState({
    name: '',
    email: '',
    phone: '',
    gst: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: '',
  });
  const [editing, setEditing] = useState(false);

  const handleChange = (e) => {
    setBilling({ ...billing, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    setEditing(false);
    onSave?.(billing);
  };

  return (
    <div>
      <div style={styles.sectionHeader}>
        <div>
          <div style={styles.sectionTitle}>Billing Information</div>
          <div style={styles.sectionSub}>Keep billing contacts and addresses up to date.</div>
        </div>
        <button style={styles.ghostBtn} onClick={() => setEditing(!editing)}>
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          style={styles.formGrid}
        >
          <div style={styles.field}>
            <label style={styles.label}>Billing Name</label>
            <input name="name" value={billing.name} onChange={handleChange} style={styles.input} placeholder="Billing name" />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Billing Email</label>
            <input name="email" value={billing.email} onChange={handleChange} style={styles.input} placeholder="finance@company.com" />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Phone</label>
            <input name="phone" value={billing.phone} onChange={handleChange} style={styles.input} placeholder="+91 98765 43210" />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Tax ID / GST</label>
            <input name="gst" value={billing.gst} onChange={handleChange} style={styles.input} placeholder="GSTIN" />
          </div>
          <div style={{ ...styles.field, gridColumn: '1 / -1' }}>
            <label style={styles.label}>Billing Address</label>
            <textarea name="address" value={billing.address} onChange={handleChange} style={styles.textarea} rows={3} placeholder="Street, City, State, ZIP" />
          </div>
          <div style={styles.actions}>
            <button type="button" style={styles.secondaryBtn} onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="submit" style={styles.primaryBtn}>
              Save Billing Info
            </button>
          </div>
        </form>
      ) : (
        <div style={styles.summaryGrid}>
          {[
            { label: 'Billing Name', value: billing.name || '—' },
            { label: 'Billing Email', value: billing.email || '—' },
            { label: 'Phone', value: billing.phone || '—' },
            { label: 'Tax ID / GST', value: billing.gst || '—' },
            { label: 'Address', value: billing.address || '—' },
            { label: 'City', value: billing.city || '—' },
            { label: 'State', value: billing.state || '—' },
            { label: 'ZIP', value: billing.zip || '—' },
            { label: 'Country', value: billing.country || '—' },
          ].map((item) => (
            <div key={item.label} style={styles.summaryItem}>
              <div style={styles.summaryLabel}>{item.label}</div>
              <div style={styles.summaryValue}>{item.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
