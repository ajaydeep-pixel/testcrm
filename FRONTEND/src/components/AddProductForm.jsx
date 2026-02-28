import React, { useEffect, useState } from 'react';
import styles from './BillingScreen.module.css';
import { apiService } from '../services/apiService';

function AddProductForm({ onClose, onProductAdded }) {
  const [form, setForm] = useState({
    name: '',
    model: '',
    barcode: '',
    brandId: '',
    categoryId: '',
    sellingPrice: '',
    purchasePrice: '',
    gstPercent: '',
    availableStock: ''
  });
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingMasters, setLoadingMasters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadMasters = async () => {
      setLoadingMasters(true);
      setError('');
      try {
        const [brandsData, categoriesData] = await Promise.all([
          apiService.get('/brands?page=1&limit=200'),
          apiService.get('/categories?page=1&limit=200')
        ]);

        setBrands(Array.isArray(brandsData?.items) ? brandsData.items : []);
        setCategories(Array.isArray(categoriesData?.items) ? categoriesData.items : []);
      } catch (err) {
        setError(err.message || 'Could not load brand/category masters');
      } finally {
        setLoadingMasters(false);
      }
    };
    loadMasters();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim() || !form.brandId || !form.categoryId || !form.sellingPrice || !form.purchasePrice) {
      setError('Please fill all required fields including Brand and Category');
      return;
    }
    if (Number(form.sellingPrice) < 0 || Number(form.purchasePrice) < 0) {
      setError('Price fields must be non-negative');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await apiService.post('/products', {
        name: form.name.trim(),
        model: form.model.trim(),
        barcode: form.barcode.trim(),
        brandId: form.brandId,
        categoryId: form.categoryId,
        sellingPrice: { amount: Number(form.sellingPrice) },
        purchasePrice: { amount: Number(form.purchasePrice) },
        gstPercent: form.gstPercent ? Number(form.gstPercent) : 0,
        inventoryStatus: {
          available: form.availableStock ? Number(form.availableStock) : 0
        }
      });

      onProductAdded(data);
      onClose();
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.productForm}>
      <div className={styles.formLead}>Fill product details and map it to Brand/Category masters.</div>
      
      <label className={styles.modalLabel}>
        Product Name *
        <input name="name" value={form.name} onChange={handleChange} placeholder="Enter product name" className={styles.modalInput} />
      </label>

      <label className={styles.modalLabel}>
        Brand *
        <select name="brandId" value={form.brandId} onChange={handleChange} className={styles.modalInput} disabled={loadingMasters}>
          <option value="">Select Brand *</option>
          {brands.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
      </label>

      <label className={styles.modalLabel}>
        Category *
        <select name="categoryId" value={form.categoryId} onChange={handleChange} className={styles.modalInput} disabled={loadingMasters}>
          <option value="">Select Category *</option>
          {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
      </label>

      <label className={styles.modalLabel}>
        Model
        <input name="model" value={form.model} onChange={handleChange} placeholder="Model" className={styles.modalInput} />
      </label>

      <label className={styles.modalLabel}>
        Barcode
        <input name="barcode" value={form.barcode} onChange={handleChange} placeholder="Barcode (optional)" className={styles.modalInput} />
      </label>

      <label className={styles.modalLabel}>
        Selling Price *
        <input name="sellingPrice" value={form.sellingPrice} onChange={handleChange} placeholder="0.00" type="number" step="0.01" min="0" className={styles.modalInput} />
      </label>

      <label className={styles.modalLabel}>
        Purchase Price *
        <input name="purchasePrice" value={form.purchasePrice} onChange={handleChange} placeholder="0.00" type="number" step="0.01" min="0" className={styles.modalInput} />
      </label>

      <label className={styles.modalLabel}>
        GST %
        <input name="gstPercent" value={form.gstPercent} onChange={handleChange} placeholder="0" type="number" step="0.01" className={styles.modalInput} />
      </label>

      <label className={styles.modalLabel}>
        Initial Stock *
        <input name="availableStock" value={form.availableStock} onChange={handleChange} placeholder="0" type="number" min="0" required className={styles.modalInput} />
      </label>

      <div className={styles.formButtons}>
        <button className={styles.saveBtn} type="submit" disabled={loading || loadingMasters}>
          {loading ? 'Saving...' : 'Save'}
        </button>
        <button className={styles.secondaryBtn} type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
      {error && <div className={styles.modalError}>{error}</div>}
    </form>
  );
}

export default AddProductForm;
