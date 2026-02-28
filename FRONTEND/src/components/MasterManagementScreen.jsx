import React, { useEffect, useState } from 'react';
import styles from './BillingScreen.module.css';
import { apiService } from '../services/apiService';

function MasterManagementScreen({ title, endpoint }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState('');
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadItems = async (targetPage = page, query = q) => {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.get(`/${endpoint}?q=${encodeURIComponent(query)}&page=${targetPage}&limit=${limit}`);
      setItems(Array.isArray(data.items) ? data.items : []);
      setPage(data.page || targetPage);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.message || 'Request failed');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    loadItems(1, q);
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setError('');
    try {
      await apiService.post(`/${endpoint}`, { name });
      setNewName('');
      loadItems(1, q);
    } catch (err) {
      setError(err.message || 'Create failed');
    }
  };

  const handleSaveEdit = async () => {
    const name = editName.trim();
    if (!name || !editId) return;
    setError('');
    try {
      await apiService.put(`/${endpoint}/${editId}`, { name });
      setEditId('');
      setEditName('');
      loadItems(page, q);
    } catch (err) {
      setError(err.message || 'Update failed');
    }
  };

  const handleDelete = async (id) => {
    setError('');
    try {
      await apiService.delete(`/${endpoint}/${id}`);
      loadItems(page, q);
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  };

  return (
    <div className={styles.crmPageCard}>
      <div className={styles.crmPageHeader}>
        <h2>{title}</h2>
        <p>Search, paginate, edit, and delete</p>
      </div>

      <form className={styles.crmInlineForm} onSubmit={handleSearch}>
        <input
          className={styles.searchInput}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${title.toLowerCase()} by name`}
        />
        <button className={styles.searchButton} type="submit" disabled={loading}>
          {loading ? 'Loading...' : 'Search'}
        </button>
      </form>

      <div className={styles.masterCreateRow}>
        <input
          className={styles.searchInput}
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={`Add new ${title.slice(0, -1).toLowerCase()}`}
        />
        <button className={styles.searchButton} type="button" onClick={handleCreate} disabled={loading}>
          Add
        </button>
      </div>

      {error && <div className={styles.crmError}>{error}</div>}

      <div className={styles.crmTableWrap}>
        <table className={styles.crmTable}>
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ width: 220 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="2" className={styles.crmEmptyCell}>No records found</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item._id}>
                  <td>
                    {editId === item._id ? (
                      <input
                        className={styles.modalInput}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    ) : item.name}
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      {editId === item._id ? (
                        <>
                          <button className={styles.tableBtnPrimary} type="button" onClick={handleSaveEdit}>Save</button>
                          <button className={styles.tableBtn} type="button" onClick={() => { setEditId(''); setEditName(''); }}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className={styles.tableBtn} type="button" onClick={() => { setEditId(item._id); setEditName(item.name); }}>Edit</button>
                          <button className={styles.tableBtnDanger} type="button" onClick={() => handleDelete(item._id)}>Delete</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.paginationBar}>
        <button className={styles.tableBtn} type="button" disabled={page <= 1} onClick={() => loadItems(page - 1, q)}>
          Prev
        </button>
        <span>Page {page} / {totalPages}</span>
        <button className={styles.tableBtn} type="button" disabled={page >= totalPages} onClick={() => loadItems(page + 1, q)}>
          Next
        </button>
      </div>
    </div>
  );
}

export default MasterManagementScreen;
