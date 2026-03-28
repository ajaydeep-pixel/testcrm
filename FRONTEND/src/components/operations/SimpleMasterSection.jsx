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
  headingRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(240px, 340px)',
    gap: 16,
    alignItems: 'start',
  },
  headingBlock: {
    display: 'grid',
    gap: 6,
    paddingBottom: 4,
  },
  searchRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  searchWrap: {
    position: 'relative',
    width: '100%',
    maxWidth: 340,
  },
  searchInput: {
    width: '100%',
    border: '1px solid #d8e1ec',
    borderRadius: 12,
    padding: '12px 42px 12px 14px',
    fontSize: 14,
    color: '#0f172a',
    background: '#fff',
  },
  searchIconButton: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 30,
    height: 30,
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    color: '#64748b',
  },
  topActionRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: 12,
    alignItems: 'center',
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
  paginationBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  paginationInfo: {
    fontSize: 13,
    color: '#64748b',
  },
  paginationControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  pageSizeSelect: {
    border: '1px solid #d8e1ec',
    borderRadius: 10,
    padding: '9px 12px',
    fontSize: 13,
    color: '#0f172a',
    background: '#ffffff',
  },
  pagerButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  pagerButton: (disabled) => ({
    border: '1px solid #d8e1ec',
    background: disabled ? '#f8fafc' : '#ffffff',
    color: disabled ? '#94a3b8' : '#0f172a',
    borderRadius: 10,
    padding: '9px 12px',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }),
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
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.42)',
    display: 'grid',
    placeItems: 'center',
    padding: 20,
    zIndex: 1200,
  },
  modalCard: {
    width: 'min(680px, 100%)',
    background: '#ffffff',
    borderRadius: 20,
    border: '1px solid #dbe3ee',
    boxShadow: '0 24px 60px rgba(15, 23, 42, 0.2)',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: '18px 20px 14px',
    borderBottom: '1px solid #eef2f7',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalBody: {
    padding: 20,
    display: 'grid',
    gap: 16,
  },
  modalForm: {
    display: 'grid',
    gap: 12,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
};

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export default function SimpleMasterSection({
  title,
  noun,
  api,
  descriptionPlaceholder,
  sectionTitle,
  sectionDescription,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [form, setForm] = useState({ name: '', description: '' });
  const [editingId, setEditingId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const loadItems = async ({ search = appliedQuery, nextPage = page, nextLimit = limit } = {}) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get({ q: search, page: nextPage, limit: nextLimit });
      const data = response.data || {};
      setItems(Array.isArray(response.data?.items) ? response.data.items : []);
      setPage(data.page || nextPage);
      setLimit(data.limit || nextLimit);
      setPagination({
        page: data.page || nextPage,
        limit: data.limit || nextLimit,
        total: data.total || 0,
        totalPages: Math.max(data.totalPages || 1, 1),
      });
    } catch (err) {
      setError(err.response?.data?.message || `Failed to load ${title.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems({ search: '', nextPage: 1, nextLimit: 10 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setForm({ name: '', description: '' });
    setEditingId('');
  };

  const closeModal = () => {
    resetForm();
    setError('');
    setIsModalOpen(false);
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
      closeModal();
      loadItems({ search: appliedQuery, nextPage: page, nextLimit: limit });
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
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    setSaving(true);
    setError('');
    try {
      await api.remove(id);
      if (editingId === id) resetForm();
      const nextTotal = Math.max(pagination.total - 1, 0);
      const nextTotalPages = Math.max(Math.ceil(nextTotal / limit), 1);
      const nextPage = Math.min(page, nextTotalPages);
      setPage(nextPage);
      loadItems({ search: appliedQuery, nextPage, nextLimit: limit });
    } catch (err) {
      setError(err.response?.data?.message || `Failed to delete ${noun.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(pagination.totalPages || 1, 1);
  const fromRecord = pagination.total === 0 ? 0 : (page - 1) * limit + 1;
  const toRecord = pagination.total === 0 ? 0 : Math.min(page * limit, pagination.total);

  return (
    <div style={styles.card}>
      <div style={styles.body}>
        {(sectionTitle || sectionDescription) && (
          <div style={styles.headingRow}>
            <div style={styles.headingBlock}>
              {sectionTitle && (
                <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                  {sectionTitle}
                </div>
              )}
              {sectionDescription && (
                <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, maxWidth: 860 }}>
                  {sectionDescription}
                </div>
              )}
            </div>

            <form
              style={styles.searchRow}
              onSubmit={(e) => {
                e.preventDefault();
                const nextQuery = query.trim();
                setAppliedQuery(nextQuery);
                setPage(1);
                loadItems({ search: nextQuery, nextPage: 1, nextLimit: limit });
              }}
            >
              <div style={styles.searchWrap}>
                <input
                  style={styles.searchInput}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${title.toLowerCase()} by name`}
                />
                <button type="submit" style={styles.searchIconButton} disabled={loading} aria-label={`Search ${title.toLowerCase()}`}>
                  <SearchIcon />
                </button>
              </div>
            </form>
          </div>
        )}

        <div style={styles.topActionRow}>
          <div style={styles.muted}>
            {loading ? 'Loading...' : `${pagination.total} record(s)`}
          </div>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={() => {
              resetForm();
              setError('');
              setIsModalOpen(true);
            }}
          >
            {`Add ${noun}`}
          </button>
        </div>

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

        <div style={styles.paginationBar}>
          <div style={styles.paginationInfo}>
            {loading ? 'Loading page...' : `Showing ${fromRecord}-${toRecord} of ${pagination.total}`}
          </div>

          <div style={styles.paginationControls}>
            <label style={styles.muted}>
              Rows per page{' '}
              <select
                value={limit}
                style={styles.pageSizeSelect}
                onChange={(e) => {
                  const nextLimit = parseInt(e.target.value, 10);
                  setLimit(nextLimit);
                  setPage(1);
                  loadItems({ search: appliedQuery, nextPage: 1, nextLimit });
                }}
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>

            <div style={styles.paginationInfo}>
              Page {page} of {totalPages}
            </div>

            <div style={styles.pagerButtons}>
              <button
                type="button"
                style={styles.pagerButton(page <= 1 || loading)}
                disabled={page <= 1 || loading}
                onClick={() => {
                  const nextPage = page - 1;
                  setPage(nextPage);
                  loadItems({ search: appliedQuery, nextPage, nextLimit: limit });
                }}
              >
                Previous
              </button>
              <button
                type="button"
                style={styles.pagerButton(page >= totalPages || loading)}
                disabled={page >= totalPages || loading}
                onClick={() => {
                  const nextPage = page + 1;
                  setPage(nextPage);
                  loadItems({ search: appliedQuery, nextPage, nextLimit: limit });
                }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div style={styles.modalBackdrop} onClick={closeModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                  {editingId ? `Edit ${noun}` : `Add ${noun}`}
                </div>
                <div style={styles.muted}>
                  {editingId
                    ? `Update the ${noun.toLowerCase()} details below.`
                    : `Create a new ${noun.toLowerCase()} for your operations workspace.`}
                </div>
              </div>
              <button type="button" style={styles.button} onClick={closeModal}>
                Close
              </button>
            </div>

            <div style={styles.modalBody}>
              <form style={styles.modalForm} onSubmit={handleSubmit}>
                <input
                  autoFocus
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

                {error && <div style={styles.error}>{error}</div>}

                <div style={styles.modalActions}>
                  <button type="button" style={styles.button} onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" style={styles.primaryButton} disabled={saving}>
                    {editingId ? 'Save Changes' : `Add ${noun}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
