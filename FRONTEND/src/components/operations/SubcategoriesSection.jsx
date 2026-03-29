import React, { useEffect, useState } from 'react';
import { categoriesAPI, subcategoriesAPI } from '../../services/api';

function SearchIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export default function SubcategoriesSection({ sectionTitle = 'Inventory / Subcategories', sectionDescription = 'Create subcategories under a category for better product organization.' }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState({ name: '', description: '', categoryId: '' });

  const loadCategories = async () => {
    try {
      const res = await categoriesAPI.getCategories({ page: 1, limit: 200 });
      const data = res.data || {};
      const list = Array.isArray(data.items) ? data.items : [];
      setCategories(list);
      if (!selectedCategoryId && list.length) {
        setSelectedCategoryId(list[0]._id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load categories');
    }
  };

  const loadItems = async ({ search = appliedQuery, nextPage = page, nextLimit = limit, categoryId = selectedCategoryId } = {}) => {
    setLoading(true);
    setError('');
    try {
      const params = { page: nextPage, limit: nextLimit, q: search };
      if (categoryId && categoryId !== 'all') params.categoryId = categoryId;
      const res = await subcategoriesAPI.getSubcategories(params);
      const data = res.data || {};
      setItems(Array.isArray(data.items) ? data.items : []);
      setPage(data.page || nextPage);
      setLimit(data.limit || nextLimit);
      setPagination({ page: data.page || nextPage, limit: data.limit || nextLimit, total: data.total || 0, totalPages: Math.max(data.totalPages || 1, 1) });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load subcategories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadItems({ search: appliedQuery, nextPage: 1, nextLimit: limit, categoryId: selectedCategoryId });
  }, [selectedCategoryId]);

  const openAdd = () => {
    setEditingId('');
    setForm({ name: '', description: '', categoryId: selectedCategoryId && selectedCategoryId !== 'all' ? selectedCategoryId : '' });
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item._id);
    setForm({
      name: item.name || '',
      description: item.description || '',
      categoryId: item.categoryId?._id || item.categoryId || '',
    });
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId('');
    setForm({ name: '', description: '', categoryId: '' });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.categoryId) {
      setError('Category is required');
      return;
    }
    if (!form.name.trim()) {
      setError('Subcategory name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { name: form.name.trim(), description: form.description.trim(), categoryId: form.categoryId };
      if (editingId) {
        await subcategoriesAPI.updateSubcategory(editingId, payload);
      } else {
        await subcategoriesAPI.createSubcategory(payload);
      }
      const nextPage = editingId ? page : 1;
      setPage(nextPage);
      await loadItems({ search: appliedQuery, nextPage, nextLimit: limit, categoryId: selectedCategoryId });
      closeModal();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save subcategory');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    setSaving(true);
    setError('');
    try {
      await subcategoriesAPI.deleteSubcategory(id);
      const nextTotal = Math.max(pagination.total - 1, 0);
      const nextTotalPages = Math.max(Math.ceil(nextTotal / limit), 1);
      const nextPage = Math.min(page, nextTotalPages);
      setPage(nextPage);
      await loadItems({ search: appliedQuery, nextPage, nextLimit: limit, categoryId: selectedCategoryId });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete subcategory');
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(pagination.totalPages || 1, 1);
  const fromRecord = pagination.total === 0 ? 0 : (page - 1) * limit + 1;
  const toRecord = pagination.total === 0 ? 0 : Math.min(page * limit, pagination.total);

  return (
    <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,.06)]">
      <div className="grid gap-4 p-5">
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,340px)]">
          <div className="grid gap-1.5 pb-1">
            <div className="text-2xl font-extrabold tracking-[-0.02em] text-slate-900">{sectionTitle}</div>
            <div className="max-w-[860px] text-[13px] leading-6 text-slate-500">{sectionDescription}</div>
          </div>
          <form className="flex justify-end" onSubmit={(e) => { e.preventDefault(); const nextQuery = query.trim(); setAppliedQuery(nextQuery); setPage(1); loadItems({ search: nextQuery, nextPage: 1, nextLimit: limit, categoryId: selectedCategoryId }); }}>
            <div className="relative w-full max-w-[340px]">
              <input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 pr-11 text-sm text-slate-900" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search subcategories by name" />
              <button type="submit" className="absolute right-2 top-1/2 grid h-[30px] w-[30px] -translate-y-1/2 place-items-center rounded-lg bg-transparent text-slate-500" disabled={loading} aria-label="Search subcategories">
                <SearchIcon />
              </button>
            </div>
          </form>
        </div>

        <div className="grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="text-sm leading-6 text-slate-500">{loading ? 'Loading...' : `${pagination.total} record(s)`}</div>
          <select
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            value={selectedCategoryId}
            onChange={(e) => {
              setSelectedCategoryId(e.target.value);
              setPage(1);
            }}
          >
            {categories.length === 0 ? <option value="">No categories found</option> : <option value="all">All categories</option>}
            {categories.map((category) => (
              <option key={category._id} value={category._id}>{category.name}</option>
            ))}
          </select>
          <button type="button" className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-2.5 text-sm font-bold text-white" onClick={openAdd}>
            Add Subcategory
          </button>
        </div>

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Name', 'Category', 'Description', 'Actions'].map((heading) => (
                    <th key={heading} className="border-b border-slate-200 bg-slate-50 px-3.5 py-3 text-left text-xs font-bold uppercase tracking-[0.05em] text-slate-500">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-7 py-8 text-center text-sm text-slate-500">No subcategories found yet.</td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item._id}>
                      <td className="border-b border-slate-100 px-3.5 py-3.5 align-top text-sm text-slate-900 font-bold">{item.name || '--'}</td>
                      <td className="border-b border-slate-100 px-3.5 py-3.5 align-top text-sm text-slate-900">{item.categoryId?.name || item.categoryName || '--'}</td>
                      <td className="border-b border-slate-100 px-3.5 py-3.5 align-top text-sm text-slate-900">{item.description || '--'}</td>
                      <td className="border-b border-slate-100 px-3.5 py-3.5 align-top text-sm text-slate-900">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900" onClick={() => openEdit(item)}>Edit</button>
                          <button type="button" className="rounded-xl border border-red-500 bg-white px-3 py-2 text-sm font-bold text-red-700" onClick={() => remove(item._id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-500">{loading ? 'Loading page...' : `Showing ${fromRecord}-${toRecord} of ${pagination.total}`}</div>
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="text-sm text-slate-500">
              Rows per page{' '}
              <select value={limit} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" onChange={(e) => { const nextLimit = parseInt(e.target.value, 10); setLimit(nextLimit); setPage(1); loadItems({ search: appliedQuery, nextPage: 1, nextLimit, categoryId: selectedCategoryId }); }}>
                {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <div className="text-sm text-slate-500">Page {page} of {totalPages}</div>
            <div className="flex items-center gap-2">
              <button type="button" className={`rounded-xl border px-3 py-2 text-sm font-bold ${page <= 1 || loading ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400' : 'border-slate-300 bg-white text-slate-900'}`} disabled={page <= 1 || loading} onClick={() => { const nextPage = page - 1; setPage(nextPage); loadItems({ search: appliedQuery, nextPage, nextLimit: limit, categoryId: selectedCategoryId }); }}>Previous</button>
              <button type="button" className={`rounded-xl border px-3 py-2 text-sm font-bold ${page >= totalPages || loading ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400' : 'border-slate-300 bg-white text-slate-900'}`} disabled={page >= totalPages || loading} onClick={() => { const nextPage = page + 1; setPage(nextPage); loadItems({ search: appliedQuery, nextPage, nextLimit: limit, categoryId: selectedCategoryId }); }}>Next</button>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-[1200] grid place-items-center bg-slate-900/40 p-5" onClick={closeModal}>
          <div className="w-full max-w-[720px] overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,.2)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pb-3.5 pt-[18px]">
              <div className="grid gap-1">
                <div className="text-xl font-extrabold tracking-[-0.02em] text-slate-900">{editingId ? 'Edit Subcategory' : 'Add Subcategory'}</div>
                <div className="text-sm leading-6 text-slate-500">Create subcategories that map to specific categories.</div>
              </div>
              <button type="button" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900" onClick={closeModal}>Close</button>
            </div>
            <form className="grid gap-4 p-5" onSubmit={submit}>
              <div className="grid gap-3.5 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-[13px] font-bold text-slate-900">Category</label>
                  <select className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" value={form.categoryId} onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}>
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category._id} value={category._id}>{category.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[13px] font-bold text-slate-900">Subcategory Name</label>
                  <input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Subcategory name" />
                </div>
                <div className="grid gap-1.5 md:col-span-2">
                  <label className="text-[13px] font-bold text-slate-900">Description</label>
                  <textarea className="min-h-24 w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional short description for this subcategory" />
                </div>
              </div>
              {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</div> : null}
              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <button type="button" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900" onClick={closeModal}>Cancel</button>
                <button type="submit" className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:border-blue-300 disabled:bg-blue-300" disabled={saving}>{editingId ? 'Save Changes' : 'Add Subcategory'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
