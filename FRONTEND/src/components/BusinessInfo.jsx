import React, { useState } from 'react';

export default function BusinessInfo({ onSave, styles }) {
  const [business, setBusiness] = useState({
    company: '',
    admin: '',
    address: '',
    email: '',
    phone: '',
    website: '',
    industry: 'Retail',
  });
  const [editing, setEditing] = useState(false);

  const handleChange = (e) => {
    setBusiness({ ...business, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    setEditing(false);
    onSave?.(business);
  };

  return (
    <div>
      <div style={styles.sectionHeader}>
        <div>
          <div style={styles.sectionTitle}>Business Information</div>
          <div style={styles.sectionSub}>Your public company profile and contact details.</div>
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
            <label style={styles.label}>Business Name</label>
            <input name="company" value={business.company} onChange={handleChange} style={styles.input} placeholder="Company name" />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Admin Contact</label>
            <input name="admin" value={business.admin} onChange={handleChange} style={styles.input} placeholder="Admin name" />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Business Email</label>
            <input name="email" value={business.email} onChange={handleChange} style={styles.input} placeholder="contact@company.com" />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Phone</label>
            <input name="phone" value={business.phone} onChange={handleChange} style={styles.input} placeholder="+91 98765 43210" />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Industry</label>
            <select name="industry" value={business.industry} onChange={handleChange} style={styles.select}>
              <option>Retail</option>
              <option>Wholesale</option>
              <option>Manufacturing</option>
              <option>Services</option>
            </select>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Website</label>
            <input name="website" value={business.website} onChange={handleChange} style={styles.input} placeholder="https://company.com" />
          </div>
          <div style={{ ...styles.field, gridColumn: '1 / -1' }}>
            <label style={styles.label}>Business Address</label>
            <textarea name="address" value={business.address} onChange={handleChange} style={styles.textarea} rows={3} placeholder="Street, City, State, ZIP" />
          </div>
          <div style={styles.actions}>
            <button type="button" style={styles.secondaryBtn} onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="submit" style={styles.primaryBtn}>
              Save Business Info
            </button>
          </div>
        </form>
      ) : (
        <div style={styles.summaryGrid}>
          {[
            { label: 'Business Name', value: business.company || '—' },
            { label: 'Admin Contact', value: business.admin || '—' },
            { label: 'Business Email', value: business.email || '—' },
            { label: 'Phone', value: business.phone || '—' },
            { label: 'Industry', value: business.industry || '—' },
            { label: 'Website', value: business.website || '—' },
            { label: 'Address', value: business.address || '—' },
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
