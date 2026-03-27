import React, { useState } from 'react';

const tips = [
  'Use at least 8 characters.',
  'Combine letters, numbers, and symbols.',
  'Avoid reusing an old password.',
  'Use a password manager if possible.',
];

export default function PasswordChange({ onSave, styles }) {
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPass !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setSuccess('Password updated successfully!');
    onSave?.(newPass);
  };

  return (
    <div>
      <div style={styles.sectionHeader}>
        <div>
                    <div style={styles.sectionSub}>Keep your account secure with a strong password and update it regularly.</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 20 }}>
        <div
          style={{
            borderRadius: 20,
            border: '1px solid #dbe3f0',
            background: 'linear-gradient(135deg, #f8fbff 0%, #eef4ff 55%, #ffffff 100%)',
            padding: 24,
            display: 'grid',
            gridTemplateColumns: '1.2fr 0.8fr',
            gap: 20,
          }}
          className="settings-hero-grid"
        >
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>Security Settings</div>
            <div style={{ marginTop: 8, fontSize: 15, color: '#475569' }}>Choose a strong password to protect your account access and reduce the risk of unauthorized sign-ins.</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>Quick Tips</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {tips.map((tip) => (
                <div key={tip} style={{ fontSize: 13, color: '#475569' }}>{tip}</div>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ ...styles.formGrid, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}>
          <div style={styles.field}>
            <label style={styles.label}>Current Password</label>
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} style={styles.input} placeholder="Current password" />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>New Password</label>
            <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} style={styles.input} placeholder="New password" />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Confirm Password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={styles.input} placeholder="Confirm new password" />
          </div>
          <div style={styles.actions}>
            <button type="button" style={styles.secondaryBtn} onClick={() => { setCurrent(''); setNewPass(''); setConfirm(''); setError(''); setSuccess(''); }}>
              Reset
            </button>
            <button type="submit" style={styles.primaryBtn}>Update Password</button>
          </div>
        </form>

        {(error || success) && (
          <div
            style={{
              borderRadius: 14,
              padding: '14px 16px',
              fontWeight: 600,
              border: `1px solid ${error ? '#fca5a5' : '#86efac'}`,
              background: error ? '#fef2f2' : '#f0fdf4',
              color: error ? '#b91c1c' : '#166534',
            }}
          >
            {error || success}
          </div>
        )}

        <style>{`
          @media (max-width: 900px) {
            .settings-hero-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
