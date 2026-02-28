import React, { useEffect, useState } from 'react';
import styles from './BillingScreen.module.css';

const STORAGE_KEY = 'businessProfile';

function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function BusinessSettings({ onClose }) {
  const [profile, setProfile] = useState({
    shopName: '',
    address: '',
    phone: '',
    gstNumber: '',
    logoUrl: ''
  });

  useEffect(() => {
    setProfile(p => ({ ...p, ...loadProfile() }));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {}
    if (onClose) onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ width: 680 }}>
        <div className={styles.modalHeader}>
          <h4>Business Details</h4>
          <button type="button" className={styles.closeIconBtn} onClick={onClose}>X</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
          <div>
            <label className={styles.modalLabel}>
              Shop Name
              <input name="shopName" value={profile.shopName} onChange={handleChange} className={styles.modalInput} />
            </label>
            <label className={styles.modalLabel}>
              GST Number
              <input name="gstNumber" value={profile.gstNumber} onChange={handleChange} className={styles.modalInput} />
            </label>
            <label className={styles.modalLabel}>
              Phone
              <input name="phone" value={profile.phone} onChange={handleChange} className={styles.modalInput} />
            </label>
          </div>
          <div>
            <label className={styles.modalLabel}>
              Address
              <textarea name="address" value={profile.address} onChange={handleChange} className={styles.modalInput} style={{ minHeight: 120 }} />
            </label>
            <label className={styles.modalLabel}>
              Logo URL
              <input name="logoUrl" value={profile.logoUrl} onChange={handleChange} className={styles.modalInput} placeholder="https://.../logo.png" />
            </label>
            {profile.logoUrl && (
              <div style={{ marginTop: 8 }}>
                <img src={profile.logoUrl} alt="logo" style={{ maxWidth: 160, maxHeight: 80 }} />
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className={styles.secondaryBtn} type="button" onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} type="button" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

export default BusinessSettings;
