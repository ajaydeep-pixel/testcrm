import React, { useEffect, useState } from 'react';
import { settingsAPI } from '../services/api';
import { useToast } from './Toast';

export default function ProfileInfo({ onSave, styles }) {
  const emptyProfile = {
    name: '',
    email: '',
  };

  const [profile, setProfile] = useState(emptyProfile);
  const [savedProfile, setSavedProfile] = useState(emptyProfile);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let isMounted = true;

    settingsAPI.getProfileInfo()
      .then((res) => {
        if (!isMounted) return;
        const data = { ...emptyProfile, ...(res.data?.profile_info || {}) };
        setProfile(data);
        setSavedProfile(data);
      })
      .catch((err) => {
        if (!isMounted) return;
        toast.error(err?.response?.data?.message || 'Failed to load profile info');
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
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await settingsAPI.updateProfileInfo(profile);
      const updated = { ...emptyProfile, ...(res.data?.profile_info || {}) };
      setProfile(updated);
      setSavedProfile(updated);
      setEditing(false);

      if (res.data?.user) {
        localStorage.setItem('user', JSON.stringify(res.data.user));
      }

      toast.success(res.data?.message || 'Profile info saved');
      onSave?.(updated);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save profile info');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={styles.sectionHeader}>
        <div>
          <div style={styles.sectionTitle}>Profile Information</div>
          <div style={styles.sectionSub}>This section includes your personal account details, such as name and email, which are used for login and identity purposes.</div>
        </div>
        <button style={styles.ghostBtn} onClick={() => setEditing(!editing)} disabled={loading}>
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: 14 }}>Loading profile info...</div>
      ) : editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          style={styles.formGrid}
        >
          <div style={styles.field}>
            <label style={styles.label}>Name</label>
            <input name="name" value={profile.name} onChange={handleChange} style={styles.input} placeholder="Your name" required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input name="email" type="email" value={profile.email} onChange={handleChange} style={styles.input} placeholder="you@company.com" required />
          </div>
          <div style={styles.actions}>
            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => {
                setProfile(savedProfile);
                setEditing(false);
              }}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" style={styles.primaryBtn} disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile Info'}
            </button>
          </div>
        </form>
      ) : (
        <div style={styles.summaryGrid}>
          {[
            { label: 'Name', value: profile.name || '--' },
            { label: 'Email', value: profile.email || '--' },
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
