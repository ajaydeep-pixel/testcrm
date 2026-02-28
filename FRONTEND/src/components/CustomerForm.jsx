import React, { useState } from 'react';
import styles from './BillingScreen.module.css';
import { apiService } from '../services/apiService';

function CustomerForm({ onClose, onCustomerAdded, initial = {} }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    phone: initial.phone || '',
    address: initial.address || '',
    email: initial.email || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.phone.trim()) {
      setError('Phone number is required');
      return;
    }
    setLoading(true);
    try {
      const data = await apiService.post('/customers', {
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        email: form.email.trim()
      });
      if (onCustomerAdded) onCustomerAdded(data);
      if (onClose) onClose();
    } catch (err) {
      setError(err.message || 'Could not save customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ width: 520 }}>
        <div className={styles.modalHeader}>
          <h4>{initial._id ? 'Edit Customer' : 'Add Customer'}</h4>
          <button type="button" className={styles.closeIconBtn} onClick={onClose}>X</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
          <label className={styles.modalLabel}>
            Name
            <input name="name" value={form.name} onChange={handleChange} className={styles.modalInput} />
          </label>
          <label className={styles.modalLabel}>
            Phone *
            <input name="phone" value={form.phone} onChange={handleChange} className={styles.modalInput} required />
          </label>
          <label className={styles.modalLabel}>
            Address
            <input name="address" value={form.address} onChange={handleChange} className={styles.modalInput} />
          </label>
          <label className={styles.modalLabel}>
            Email
            <input name="email" value={form.email} onChange={handleChange} className={styles.modalInput} />
          </label>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.saveBtn} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
          </div>
          {error && <div className={styles.modalError}>{error}</div>}
        </form>
      </div>
    </div>
  );
}

export default CustomerForm;
