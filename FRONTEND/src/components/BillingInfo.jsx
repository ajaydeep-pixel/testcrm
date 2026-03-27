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

export default function BillingInfo({ onSave, styles, autoEdit = false }) {
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

  const emptyBilling = {
    sameAsBusiness: false,
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
  const [billing, setBilling] = useState(emptyBilling);
  const [savedBilling, setSavedBilling] = useState(emptyBilling);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const countries = locations.countries || [];
  const selectedCountry = useMemo(
    () => countries.find((country) => country.id === billing.country),
    [countries, billing.country]
  );
  const states = selectedCountry?.states || [];
  const selectedState = useMemo(
    () => states.find((state) => state.id === billing.state),
    [states, billing.state]
  );
  const cities = selectedState?.cities || [];

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      settingsAPI.getBusinessInfo(),
      settingsAPI.getBillingInfo(),
    ])
      .then(([businessRes, billingRes]) => {
        if (!isMounted) return;
        const businessData = { ...emptyBusiness, ...(businessRes.data?.business_info || {}) };
        const billingData = { ...emptyBilling, ...(billingRes.data?.billing_info || {}) };
        setBusiness(businessData);
        setBilling(billingData);
        setSavedBilling(billingData);
      })
      .catch((err) => {
        if (!isMounted) return;
        toast.error(err?.response?.data?.message || 'Failed to load billing info');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [toast]);

  useEffect(() => {
    if (autoEdit && !loading) {
      setEditing(true);
    }
  }, [autoEdit, loading]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setBilling((prev) => ({ ...prev, [name]: value }));
  };

  const applyBusinessToBilling = () => ({
    ...emptyBilling,
    ...business,
    sameAsBusiness: true,
  });

  const handleSameAsBusinessChange = (e) => {
    const checked = e.target.checked;
    if (checked) {
      setBilling(applyBusinessToBilling());
      return;
    }

    setBilling((prev) => ({
      ...prev,
      sameAsBusiness: false,
    }));
  };

  const handleCountryChange = (e) => {
    const value = e.target.value;
    setBilling((prev) => ({
      ...prev,
      country: value,
      state: '',
      city: '',
    }));
  };

  const handleStateChange = (e) => {
    const value = e.target.value;
    setBilling((prev) => ({
      ...prev,
      state: value,
      city: '',
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = billing.sameAsBusiness ? { sameAsBusiness: true } : billing;
      const res = await settingsAPI.updateBillingInfo(payload);
      const updated = { ...emptyBilling, ...(res.data?.billing_info || {}) };
      setBilling(updated);
      setSavedBilling(updated);
      setEditing(false);
      toast.success(res.data?.message || 'Billing info saved');
      onSave?.(updated);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save billing info');
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
        <div style={{ color: '#6b7280', fontSize: 14 }}>Loading billing info...</div>
      ) : editing ? (
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{
            borderRadius: 20,
            border: '1px solid #dbe3f0',
            background: 'linear-gradient(135deg, #f8fbff 0%, #eef4ff 55%, #ffffff 100%)',
            padding: 24,
          }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a' }}>{billing.name || 'Billing Info'}</div>
            <div style={{ marginTop: 8, fontSize: 15, color: '#475569' }}>Use dedicated billing details for payments, or sync everything with your business information.</div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            style={{ ...styles.formGrid, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}
          >
            <div style={{ ...styles.field, gridColumn: '1 / -1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: '#111827' }}>
                <input
                  type="checkbox"
                  checked={billing.sameAsBusiness}
                  onChange={handleSameAsBusinessChange}
                />
                Same as Business Information
              </label>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Billing Name</label>
              <input name="name" value={billing.name} onChange={handleChange} style={styles.input} placeholder="Billing name" disabled={billing.sameAsBusiness} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Billing Email</label>
              <input name="email" value={billing.email} onChange={handleChange} style={styles.input} placeholder="finance@company.com" disabled={billing.sameAsBusiness} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Phone</label>
              <input name="phone" value={billing.phone} onChange={handleChange} style={styles.input} placeholder="+91 98765 43210" disabled={billing.sameAsBusiness} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>ZIP / Postal Code</label>
              <input name="zip" value={billing.zip} onChange={handleChange} style={styles.input} placeholder="ZIP / Postal code" disabled={billing.sameAsBusiness} />
            </div>
            <div style={{ ...styles.field, gridColumn: '1 / -1' }}>
              <label style={styles.label}>Billing Address</label>
              <textarea name="address" value={billing.address} onChange={handleChange} style={styles.textarea} rows={3} placeholder="Street, Area" disabled={billing.sameAsBusiness} />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Country</label>
              <select name="country" value={billing.country} onChange={handleCountryChange} style={styles.select} disabled={billing.sameAsBusiness}>
                <option value="">Select country</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>{country.name}</option>
                ))}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>State</label>
              <select name="state" value={billing.state} onChange={handleStateChange} style={styles.select} disabled={billing.sameAsBusiness || !billing.country}>
                <option value="">Select state</option>
                {states.map((state) => (
                  <option key={state.id} value={state.id}>{state.name}</option>
                ))}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>City</label>
              <select name="city" value={billing.city} onChange={handleChange} style={styles.select} disabled={billing.sameAsBusiness || !billing.state}>
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
                  setBilling(savedBilling);
                  setEditing(false);
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" style={styles.primaryBtn} disabled={saving}>
                {saving ? 'Saving...' : 'Save Billing Info'}
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
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{billing.name || '--'}</div>
              <div style={{ marginTop: 8, fontSize: 15, color: '#475569' }}>{billing.email || '--'}</div>
              <div style={{ marginTop: 14, fontSize: 14, color: '#64748b' }}>{billing.address || 'No billing address added yet.'}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18, display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Quick Snapshot</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: '#64748b' }}>Same as Business</span><strong style={{ color: '#111827' }}>{billing.sameAsBusiness ? 'Yes' : 'No'}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: '#64748b' }}>Phone</span><strong style={{ color: '#111827' }}>{billing.phone || '--'}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: '#64748b' }}>Country</span><strong style={{ color: '#111827' }}>{resolveName(countries, billing.country)}</strong></div>
            </div>
          </div>

          <DetailSection
            title="Billing Contact"
            rows={[
              { label: 'Billing Name', value: billing.name || '--' },
              { label: 'Billing Email', value: billing.email || '--' },
              { label: 'Phone', value: billing.phone || '--' },
              { label: 'ZIP / Postal Code', value: billing.zip || '--' },
            ]}
          />

          <DetailSection
            title="Billing Address"
            rows={[
              { label: 'Address', value: billing.address || '--' },
              { label: 'Country', value: resolveName(countries, billing.country) },
              { label: 'State', value: resolveName(states, billing.state) },
              { label: 'City', value: resolveName(cities, billing.city) },
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
