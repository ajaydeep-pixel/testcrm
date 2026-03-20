import React, { useEffect, useMemo, useState } from 'react';
import { settingsAPI } from '../services/api';
import { useToast } from './Toast';
import locations from '../data/locations.json';

export default function BillingInfo({ onSave, styles }) {
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
          <div style={styles.sectionTitle}>Billing Information</div>
          <div style={styles.sectionSub}>This information will be used for purchasing plans and handling billing-related transactions.</div>
        </div>
        <button style={styles.ghostBtn} onClick={() => setEditing(!editing)} disabled={loading}>
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: 14 }}>Loading billing info...</div>
      ) : editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          style={styles.formGrid}
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
      ) : (
        <div style={styles.summaryGrid}>
          {[
            { label: 'Same as Business', value: billing.sameAsBusiness ? 'Yes' : 'No' },
            { label: 'Billing Name', value: billing.name || '--' },
            { label: 'Billing Email', value: billing.email || '--' },
            { label: 'Phone', value: billing.phone || '--' },
            { label: 'Address', value: billing.address || '--' },
            { label: 'Country', value: resolveName(countries, billing.country) },
            { label: 'State', value: resolveName(states, billing.state) },
            { label: 'City', value: resolveName(cities, billing.city) },
            { label: 'ZIP / Postal Code', value: billing.zip || '--' },
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
