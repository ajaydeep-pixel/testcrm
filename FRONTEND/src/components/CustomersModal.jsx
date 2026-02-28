import React, { useEffect, useState } from 'react';
import styles from './BillingScreen.module.css';
import { apiService } from '../services/apiService';
import CustomerForm from './CustomerForm.jsx';

function CustomersModal({ onClose, onSelect }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [q, setQ] = useState('');

  const load = async (query = '') => {
    setLoading(true);
    try {
      const data = await apiService.get(`/customers?q=${encodeURIComponent(query)}&page=1&limit=200`);
      setCustomers(Array.isArray(data.items) ? data.items : data);
    } catch (err) {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  // useEffect(() => { load(); }, []);

  const handleAdd = (newCustomer) => {
    setShowAdd(false);
    if (onSelect) onSelect(newCustomer);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ width: 720 }}>
        <div className={styles.modalHeader}>
          <h4>Customers</h4>
          <button type="button" className={styles.closeIconBtn} onClick={onClose}>X</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input className={styles.searchInput} placeholder="Search by name or phone" value={q} onChange={e => setQ(e.target.value)} />
          <button className={styles.searchButton} onClick={() => load(q)}>Search</button>
          <button className={styles.secondaryBtn} onClick={() => setShowAdd(true)}>Add New</button>
        </div>

        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {loading ? <div>Loading...</div> : (customers.length === 0 ? <div>No customers found.</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c._id}>
                    <td>{c.name || '-'}</td>
                    <td>{c.phone}</td>
                    <td>{c.email || '-'}</td>
                    <td><button className={styles.tableBtnPrimary} onClick={() => { if (onSelect) onSelect(c); onClose(); }}>Select</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>

        {showAdd && <CustomerForm onClose={() => setShowAdd(false)} onCustomerAdded={handleAdd} />}
      </div>
    </div>
  );
}

export default CustomersModal;
