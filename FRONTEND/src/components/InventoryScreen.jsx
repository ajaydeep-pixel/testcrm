import React, { useEffect, useState } from 'react';
import styles from './BillingScreen.module.css';
import { apiService } from '../services/apiService';

const pickInv = (product) => {
  const i = product.inventoryStatus || {};
  return {
    available: i.available ?? 0,
    damaged: i.damaged ?? 0,
    used: i.used ?? 0,
    returned: i.returned ?? 0,
    lost: i.lost ?? 0
  };
};

function InventoryScreen({ refreshKey }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState('');
  const [editInv, setEditInv] = useState(pickInv({}));

  const loadRows = async (targetPage = page, query = q) => {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.get(`/products?q=${encodeURIComponent(query)}&page=${targetPage}&limit=${limit}`);
      setRows(Array.isArray(data.items) ? data.items : []);
      setPage(data.page || targetPage);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.message || 'Could not load inventory');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows(1, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadRows(1, q);
  };

  const startEdit = (row) => {
    setEditId(row._id);
    setEditInv(pickInv(row));
  };

  const saveEdit = async () => {
    setError('');
    try {
      const clean = {
        available: Number(editInv.available || 0),
        damaged: Number(editInv.damaged || 0),
        used: Number(editInv.used || 0),
        returned: Number(editInv.returned || 0),
        lost: Number(editInv.lost || 0)
      };
      await apiService.put(`/products/${editId}`, { inventoryStatus: clean });
      setEditId('');
      loadRows(page, q);
    } catch (err) {
      setError(err.message || 'Update failed');
    }
  };

  const deleteItem = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    setError('');
    try {
      await apiService.delete(`/products/${id}`);
      loadRows(page, q);
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  };

  return (
    <div className={styles.crmPageCard}>
      <div className={styles.crmPageHeader}>
        <h2>Inventory</h2>
        <p>Search, edit, update and delete inventory rows</p>
      </div>

      <form className={styles.crmInlineForm} onSubmit={handleSearch}>
        <input
          className={styles.searchInput}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by product name, brand, category, barcode"
        />
        <button type="submit" className={styles.searchButton} disabled={loading}>
          {loading ? 'Loading...' : 'Search'}
        </button>
      </form>

      {error && <div className={styles.crmError}>{error}</div>}

      <div className={styles.crmTableWrap}>
        <table className={styles.crmTable}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Brand</th>
              <th>Available</th>
              <th>Damaged</th>
              <th>Used</th>
              <th>Returned</th>
              <th>Lost</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="8" className={styles.crmEmptyCell}>No inventory rows found</td>
              </tr>
            ) : (
              rows.map((row) => {
                const inv = pickInv(row);
                const isEdit = editId === row._id;
                const show = isEdit ? editInv : inv;
                return (
                  <tr key={row._id}>
                    <td>{row.name || '-'}</td>
                    <td>{row.brand || '-'}</td>
                    <td>
                      {isEdit ? (
                        <input className={styles.modalInput} style={{ width: '60px' }} type="number" value={show.available} onChange={(e) => setEditInv((p) => ({ ...p, available: e.target.value }))} />
                      ) : (
                        <span style={{ 
                          fontWeight: 'bold', 
                          color: show.available <= 0 ? '#ef4444' : show.available <= 5 ? '#f59e0b' : '#10b981' 
                        }}>
                          {show.available}
                        </span>
                      )}
                    </td>
                    <td>{isEdit ? <input className={styles.modalInput} style={{ width: '60px' }} type="number" value={show.damaged} onChange={(e) => setEditInv((p) => ({ ...p, damaged: e.target.value }))} /> : show.damaged}</td>
                    <td>{isEdit ? <input className={styles.modalInput} style={{ width: '60px' }} type="number" value={show.used} onChange={(e) => setEditInv((p) => ({ ...p, used: e.target.value }))} /> : show.used}</td>
                    <td>{isEdit ? <input className={styles.modalInput} style={{ width: '60px' }} type="number" value={show.returned} onChange={(e) => setEditInv((p) => ({ ...p, returned: e.target.value }))} /> : show.returned}</td>
                    <td>{isEdit ? <input className={styles.modalInput} style={{ width: '60px' }} type="number" value={show.lost} onChange={(e) => setEditInv((p) => ({ ...p, lost: e.target.value }))} /> : show.lost}</td>
                    <td>
                      <div className={styles.rowActions}>
                        {isEdit ? (
                          <>
                            <button className={styles.tableBtnPrimary} type="button" onClick={saveEdit}>Save</button>
                            <button className={styles.tableBtn} type="button" onClick={() => setEditId('')}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button className={styles.tableBtn} type="button" onClick={() => startEdit(row)}>Edit</button>
                            <button className={styles.tableBtnDanger} type="button" onClick={() => deleteItem(row._id)}>Delete</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.paginationBar}>
        <button className={styles.tableBtn} type="button" disabled={page <= 1} onClick={() => loadRows(page - 1, q)}>Prev</button>
        <span>Page {page} / {totalPages}</span>
        <button className={styles.tableBtn} type="button" disabled={page >= totalPages} onClick={() => loadRows(page + 1, q)}>Next</button>
      </div>
    </div>
  );
}

export default InventoryScreen;
