import React, { useEffect, useMemo, useState } from 'react';
import { settingsAPI } from '../services/api';
import { useToast } from './Toast';
import locations from '../data/locations.json';

const sectionCard = {
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  background: '#ffffff',
  overflow: 'hidden',
};

const sectionHeaderCard = {
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
  return (
    <div style={sectionCard}>
      <div style={sectionHeaderCard}>{title}</div>
      <div style={rowGrid} className="settings-detail-grid">
        {rows.map((row) => (
          <div key={row.label} style={rowStyle}>
            <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>{row.label}</div>
            <div style={{ fontSize: 14, color: '#111827', fontWeight: 700, textAlign: 'right', wordBreak: 'break-word' }}>{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BusinessInfo({ onSave, styles }) {
  const emptyBusiness = {
    name: '',
    email: '',
    phone: '',
    address: '',
    country: '',
    state: '',
    city: '',
    zip: '',
  };

  const [business, setBusiness] = useState(emptyBusiness);
  const [savedBusiness, setSavedBusiness] = useState(emptyBusiness);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const countries = locations.countries || [];
  const selectedCountry = useMemo(
    () => countries.find((country) => country.id === business.country),
    [countries, business.country]
  );
  const states = selectedCountry?.states || [];
  const selectedState = useMemo(
    () => states.find((state) => state.id === business.state),
    [states, business.state]
  );
  const cities = selectedState?.cities || [];

  useEffect(() => {
    let isMounted = true;

    settingsAPI.getBusinessInfo()
      .then((res) => {
        if (!isMounted) return;
        const data = { ...emptyBusiness, ...(res.data?.business_info || {}) };
        setBusiness(data);
        setSavedBusiness(data);
      })
      .catch((err) => {
        if (!isMounted) return;
        toast.error(err?.response?.data?.message || 'Failed to load business info');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [toast]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setBusiness((prev) => ({ ...prev, [name]: value }));
  };

  const handleCountryChange = (e) => {
    const value = e.target.value;
    setBusiness((prev) => ({
      ...prev,
      country: value,
      state: '',
      city: '',
    }));
  };

  const handleStateChange = (e) => {
    const value = e.target.value;
    setBusiness((prev) => ({
      ...prev,
      state: value,
      city: '',
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await settingsAPI.updateBusinessInfo(business);
      const updated = { ...emptyBusiness, ...(res.data?.business_info || {}) };
      setBusiness(updated);
      setSavedBusiness(updated);
      setEditing(false);
      toast.success(res.data?.message || 'Business info saved');
      onSave?.(updated);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save business info');
    } finally {
      setSaving(false);
    }
  };

  const resolveName = (collection, id) => {
    if (!id) return '--';
    const item = collection.find((x) => x.id === id);
    return item ? item.name : '--';
  };

  return (
    <div>
      <div style={styles.sectionHeader}>
        <div>
        </div>
        <button style={styles.ghostBtn} onClick={() => setEditing(!editing)} disabled={loading}>
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: 14 }}>Loading business info...</div>
      ) : editing ? (
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{
            borderRadius: 20,
            border: '1px solid #dbe3f0',
            background: 'linear-gradient(135deg, #f8fbff 0%, #eef4ff 55%, #ffffff 100%)',
            padding: 24,
          }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a' }}>{business.name || 'Business Info'}</div>
            <div style={{ marginTop: 8, fontSize: 15, color: '#475569' }}>Keep your official business contact and location details accurate for invoices and records.</div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            style={{ ...styles.formGrid, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}
          >
            <div style={styles.field}>
              <label style={styles.label}>Business Name</label>
              <input name="name" value={business.name} onChange={handleChange} style={styles.input} placeholder="Company name" />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Business Email</label>
              <input name="email" value={business.email} onChange={handleChange} style={styles.input} placeholder="contact@company.com" />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Phone Number</label>
              <input name="phone" value={business.phone} onChange={handleChange} style={styles.input} placeholder="+91 98765 43210" />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>ZIP / Postal Code</label>
              <input name="zip" value={business.zip} onChange={handleChange} style={styles.input} placeholder="ZIP / Postal code" />
            </div>
            <div style={{ ...styles.field, gridColumn: '1 / -1' }}>
              <label style={styles.label}>Business Address</label>
              <textarea name="address" value={business.address} onChange={handleChange} style={styles.textarea} rows={3} placeholder="Street, Area" />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Country</label>
              <select name="country" value={business.country} onChange={handleCountryChange} style={styles.select}>
                <option value="">Select country</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>{country.name}</option>
                ))}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>State</label>
              <select name="state" value={business.state} onChange={handleStateChange} style={styles.select} disabled={!business.country}>
                <option value="">Select state</option>
                {states.map((state) => (
                  <option key={state.id} value={state.id}>{state.name}</option>
                ))}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>City</label>
              <select name="city" value={business.city} onChange={handleChange} style={styles.select} disabled={!business.state}>
                <option value="">Select city</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>{city.name}</option>
                ))}
              </select>
            </div>
            <div style={styles.actions}>
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={() => {
                  setBusiness(savedBusiness);
                  setEditing(false);
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" style={styles.primaryBtn} disabled={saving}>
                {saving ? 'Saving...' : 'Save Business Info'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{
            borderRadius: 20,
            border: '1px solid #dbe3f0',
            background: 'linear-gradient(135deg, #f8fbff 0%, #eef4ff 55%, #ffffff 100%)',
            padding: 24,
            display: 'grid',
            gridTemplateColumns: '1.3fr 0.9fr',
            gap: 20,
          }} className="settings-hero-grid">
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{business.name || '--'}</div>
              <div style={{ marginTop: 8, fontSize: 15, color: '#475569' }}>{business.email || '--'}</div>
              <div style={{ marginTop: 14, fontSize: 14, color: '#64748b' }}>{business.address || 'No business address added yet.'}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18, display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Quick Snapshot</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: '#64748b' }}>Phone</span><strong style={{ color: '#111827' }}>{business.phone || '--'}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: '#64748b' }}>Country</span><strong style={{ color: '#111827' }}>{resolveName(countries, business.country)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: '#64748b' }}>State</span><strong style={{ color: '#111827' }}>{resolveName(states, business.state)}</strong></div>
            </div>
          </div>

          <DetailSection
            title="Registered Details"
            rows={[
              { label: 'Business Name', value: business.name || '--' },
              { label: 'Business Email', value: business.email || '--' },
              { label: 'Phone Number', value: business.phone || '--' },
              { label: 'ZIP / Postal Code', value: business.zip || '--' },
            ]}
          />

          <DetailSection
            title="Business Address"
            rows={[
              { label: 'Address', value: business.address || '--' },
              { label: 'Country', value: resolveName(countries, business.country) },
              { label: 'State', value: resolveName(states, business.state) },
              { label: 'City', value: resolveName(cities, business.city) },
            ]}
          />

          <style>{`
            @media (max-width: 900px) {
              .settings-hero-grid {
                grid-template-columns: 1fr !important;
              }
            }
            @media (max-width: 720px) {
              .settings-detail-grid {
                grid-template-columns: 1fr !important;
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
