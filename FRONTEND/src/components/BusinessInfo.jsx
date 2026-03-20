import React, { useEffect, useMemo, useState } from 'react';
import { settingsAPI } from '../services/api';
import { useToast } from './Toast';
import locations from '../data/locations.json';

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
          <div style={styles.sectionTitle}>Business Information</div>
          <div style={styles.sectionSub}>This section contains your business details, which may be used in customer invoices and other official documents.</div>
        </div>
        <button style={styles.ghostBtn} onClick={() => setEditing(!editing)} disabled={loading}>
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: 14 }}>Loading business info...</div>
      ) : editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          style={styles.formGrid}
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
      ) : (
        <div style={styles.summaryGrid}>
          {[
            { label: 'Business Name', value: business.name || '--' },
            { label: 'Business Email', value: business.email || '--' },
            { label: 'Phone Number', value: business.phone || '--' },
            { label: 'Address', value: business.address || '--' },
            { label: 'Country', value: resolveName(countries, business.country) },
            { label: 'State', value: resolveName(states, business.state) },
            { label: 'City', value: resolveName(cities, business.city) },
            { label: 'ZIP / Postal Code', value: business.zip || '--' },
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
