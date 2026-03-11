import React, { useState } from 'react';

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
          <div style={styles.sectionTitle}>Change Password</div>
          <div style={styles.sectionSub}>Use a strong password with at least 8 characters.</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={styles.formGrid}>
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
          <button type="button" style={styles.secondaryBtn} onClick={() => { setCurrent(''); setNewPass(''); setConfirm(''); }}>
            Reset
          </button>
          <button type="submit" style={styles.primaryBtn}>Update Password</button>
        </div>
      </form>
      {error && <div style={{ color: '#b91c1c', marginTop: 10, fontWeight: 600 }}>{error}</div>}
      {success && <div style={{ color: '#15803d', marginTop: 10, fontWeight: 600 }}>{success}</div>}
    </div>
  );
}
