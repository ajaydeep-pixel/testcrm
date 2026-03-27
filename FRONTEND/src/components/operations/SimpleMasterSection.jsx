import React, { useEffect, useState } from 'react';

const styles = {
  card: {
    background: '#ffffff',
    borderRadius: 18,
    border: '1px solid #e5e7eb',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
    overflow: 'hidden',
  },
  body: {
    padding: 20,
    display: 'grid',
    gap: 16,
  },
  topRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 18,
    flexWrap: 'wrap',
  },
  stat: {
    display: 'grid',
    gap: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 700,
  },
  statValue: {
    fontSize: 24,
    color: '#0f172a',
    fontWeight: 800,
  },
  searchRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1fr) auto',
    gap: 12,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(180px, 240px) minmax(240px, 1fr) auto',
    gap: 12,
  },
  input: {
    width: '100%',
    border: '1px solid #d8e1ec',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 14,
    color: '#0f172a',
    background: '#fff',
  },
  button: {
    border: '1px solid #d8e1ec',
    background: '#ffffff',
    borderRadius: 12,
    padding: '11px 16px',
    fontWeight: 700,
    cursor: 'pointer',
    color: '#0f172a',
  },
  primaryButton: {
    border: '1px solid #2563eb',
    background: '#2563eb',
    color: '#ffffff',
    borderRadius: 12,
    padding: '11px 16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  dangerButton: {
    border: '1px solid #ef4444',
    background: '#ffffff',
    color: '#b91c1c',
    borderRadius: 10,
    padding: '8px 12px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  tableWrap: {
    border: '1px solid #e5e7eb',
    borderRadius: 16,
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#64748b',
    background: '#f8fafc',
    padding: '12px 14px',
    borderBottom: '1px solid #e5e7eb',
  },
  td: {
    padding: '14px',
    borderBottom: '1px solid #eef2f7',
    verticalAlign: 'top',
    fontSize: 14,
    color: '#0f172a',
  },
  muted: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 1.5,
  },
  actions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  error: {
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#b91c1c',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 14,
  },
  empty: {
    padding: 28,
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
  },
};

export default function SimpleMasterSection({
  title,
  noun,
  api,
  helperText,
  descriptionPlaceholder,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ name: '', description: '' });
  const [editingId, setEditingId] = useState('');

  const loadItems = async (search = query) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get({ q: search, limit: 100 });
      setItems(Array.isArray(response.data?.items) ? response.data.items : []);
    } catch (err) {
      setError(err.response?.data?.message || `Failed to load ${title.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setForm({ name: '', description: '' });
    setEditingId('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const description = form.description.trim();
    if (!name) {
      setError(`${noun} name is required`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await api.update(editingId, { name, description });
      } else {
        await api.create({ name, description });
      }
      resetForm();
      loadItems(query);
    } catch (err) {
      setError(err.response?.data?.message || `Failed to save ${noun.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item._id);
    setForm({ name: item.name || '', description: item.description || '' });
    setError('');
  };

  const handleDelete = async (id) => {
    setSaving(true);
    setError('');
    try {
      await api.remove(id);
      if (editingId === id) resetForm();
      loadItems(query);
    } catch (err) {
      setError(err.response?.data?.message || `Failed to delete ${noun.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.card}>
      <div style={styles.body}>
        <div style={styles.topRow}>
          <div style={styles.statBlock}>
            <div style={styles.stat}>
              <div style={styles.statLabel}>Total {title}</div>
              <div style={styles.statValue}>{items.length}</div>
            </div>
            <div style={styles.muted}>{helperText}</div>
          </div>
          <div style={styles.muted}>{loading ? 'Loading...' : `${items.length} record(s)`}</div>
        </div>

        <form
          style={styles.searchRow}
          onSubmit={(e) => {
            e.preventDefault();
            loadItems(query);
          }}
        >
          <input
            style={styles.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${title.toLowerCase()} by name`}
          />
          <button type="submit" style={styles.button} disabled={loading}>
            Search
          </button>
        </form>

        <form style={styles.formGrid} onSubmit={handleSubmit}>
          <input
            style={styles.input}
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder={`${editingId ? 'Edit' : 'Add'} ${noun.toLowerCase()} name`}
          />
          <input
            style={styles.input}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder={descriptionPlaceholder}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="submit" style={styles.primaryButton} disabled={saving}>
              {editingId ? 'Save Changes' : `Add ${noun}`}
            </button>
            {editingId && (
              <button type="button" style={styles.button} onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Description</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan="3" style={styles.empty}>
                    No {title.toLowerCase()} found yet.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id}>
                    <td style={styles.td}>{item.name}</td>
                    <td style={styles.td}>
                      <div style={styles.muted}>{item.description || '--'}</div>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actions}>
                        <button type="button" style={styles.button} onClick={() => handleEdit(item)}>
                          Edit
                        </button>
                        <button type="button" style={styles.dangerButton} onClick={() => handleDelete(item._id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
