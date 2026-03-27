import React, { useEffect, useState } from 'react';
import { settingsAPI } from '../services/api';
import { useToast } from './Toast';

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
        </div>
        <button style={styles.ghostBtn} onClick={() => setEditing(!editing)} disabled={loading}>
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: 14 }}>Loading profile info...</div>
      ) : editing ? (
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{
            borderRadius: 20,
            border: '1px solid #dbe3f0',
            background: 'linear-gradient(135deg, #f8fbff 0%, #eef4ff 55%, #ffffff 100%)',
            padding: 24,
          }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a' }}>{profile.name || 'Profile Info'}</div>
            <div style={{ marginTop: 8, fontSize: 15, color: '#475569' }}>Keep your login identity up to date so account access and notifications stay accurate.</div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            style={{ ...styles.formGrid, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}
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
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{profile.name || '--'}</div>
              <div style={{ marginTop: 8, fontSize: 15, color: '#475569' }}>{profile.email || '--'}</div>
              <div style={{ marginTop: 14, fontSize: 14, color: '#64748b' }}>These details are used for login, identity, and account-level communication.</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18, display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Quick Snapshot</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: '#64748b' }}>Display Name</span><strong style={{ color: '#111827' }}>{profile.name || '--'}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: '#64748b' }}>Login Email</span><strong style={{ color: '#111827' }}>{profile.email || '--'}</strong></div>
            </div>
          </div>

          <DetailSection
            title="Account Identity"
            rows={[
              { label: 'Name', value: profile.name || '--' },
              { label: 'Email', value: profile.email || '--' },
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
