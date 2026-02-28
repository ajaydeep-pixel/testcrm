import React, { useEffect, useState } from 'react';
import Barcode from 'react-barcode';
import styles from './BillingScreen.module.css';
import AddProductForm from './AddProductForm.jsx';
import { apiService } from '../services/apiService';

function ProductsScreen({ refreshKey }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState('');
  const [printingProduct, setPrintingProduct] = useState(null);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeConfig, setBarcodeConfig] = useState({
    quantity: 1,
    width: 2,
    height: 40,
    labelWidth: 50
  });
  const [editForm, setEditForm] = useState({
    name: '',
    model: '',
    barcode: '',
    sellingAmount: '',
    purchaseAmount: '',
    gstPercent: ''
  });
  const [showAddProduct, setShowAddProduct] = useState(false);

  const loadProducts = async (targetPage = page, query = q) => {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.get(`/products?q=${encodeURIComponent(query)}&page=${targetPage}&limit=${limit}`);
      setItems(Array.isArray(data.items) ? data.items : []);
      setPage(data.page || targetPage);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.message || 'Could not load products');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts(1, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadProducts(1, q);
  };

  const startEdit = (item) => {
    setEditId(item._id);
    setEditForm({
      name: item.name || '',
      model: item.model || '',
      barcode: item.barcode || '',
      sellingAmount: item.sellingPrice?.amount ?? 0,
      purchaseAmount: item.purchasePrice?.amount ?? 0,
      gstPercent: item.gstPercent ?? 0
    });
  };

  const saveEdit = async () => {
    setError('');
    try {
      await apiService.put(`/products/${editId}`, {
        name: editForm.name.trim(),
        model: editForm.model.trim(),
        barcode: editForm.barcode.trim(),
        sellingPrice: { amount: Number(editForm.sellingAmount || 0) },
        purchasePrice: { amount: Number(editForm.purchaseAmount || 0) },
        gstPercent: Number(editForm.gstPercent || 0)
      });
      setEditId('');
      loadProducts(page, q);
    } catch (err) {
      setError(err.message || 'Update failed');
    }
  };

  const deleteItem = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    setError('');
    try {
      await apiService.delete(`/products/${id}`);
      loadProducts(page, q);
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  };

  const handlePrintBarcode = (item) => {
    if (!item.barcode) {
      alert('This product does not have a barcode.');
      return;
    }
    setPrintingProduct(item);
    setShowBarcodeModal(true);
  };

  const handleConfirmPrint = () => {
    setShowBarcodeModal(false);
    setTimeout(() => {
      window.print();
      setPrintingProduct(null);
    }, 500);
  };

  const handleCloseBarcodeModal = () => {
    setShowBarcodeModal(false);
    setPrintingProduct(null);
  };

  const handleOpenAddProduct = () => setShowAddProduct(true);
  const handleCloseAddProduct = () => setShowAddProduct(false);

  return (
    <div className={styles.crmPageCard}>
      <div className={styles.crmPageHeader}>
        <div>
          <h2>Products</h2>
          <p>Search, edit, update and delete products</p>
        </div>
        <button className={styles.secondaryBtn} type="button" onClick={handleOpenAddProduct}>
          + New Product
        </button>
      </div>

      <form className={styles.crmInlineForm} onSubmit={handleSearch}>
        <input
          className={styles.searchInput}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, brand, model, category, barcode"
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
              <th>Category</th>
              <th>Barcode</th>
              <th>Stock</th>
              <th>Selling</th>
              <th>Purchase</th>
              <th>GST</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="9" className={styles.crmEmptyCell}>No products found</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item._id}>
                  <td>
                    {editId === item._id ? (
                      <input className={styles.modalInput} value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
                    ) : item.name || '-'}
                  </td>
                  <td>{item.brand || '-'}</td>
                  <td>{item.category || '-'}</td>
                  <td>
                    {editId === item._id ? (
                      <input className={styles.modalInput} value={editForm.barcode} onChange={(e) => setEditForm((p) => ({ ...p, barcode: e.target.value }))} />
                    ) : item.barcode || '-'}
                  </td>
                  <td>
                    <span className={`${styles.stockValue} ${(item.inventoryStatus?.available || 0) <= 0 ? styles.outOfStock : ''}`}>
                      {item.inventoryStatus?.available ?? 0}
                    </span>
                  </td>
                  <td>
                    {editId === item._id ? (
                      <input className={styles.modalInput} type="number" value={editForm.sellingAmount} onChange={(e) => setEditForm((p) => ({ ...p, sellingAmount: e.target.value }))} />
                    ) : `$${(item.sellingPrice?.amount || 0).toFixed(2)}`}
                  </td>
                  <td>
                    {editId === item._id ? (
                      <input className={styles.modalInput} type="number" value={editForm.purchaseAmount} onChange={(e) => setEditForm((p) => ({ ...p, purchaseAmount: e.target.value }))} />
                    ) : `$${(item.purchasePrice?.amount || 0).toFixed(2)}`}
                  </td>
                  <td>
                    {editId === item._id ? (
                      <input className={styles.modalInput} type="number" value={editForm.gstPercent} onChange={(e) => setEditForm((p) => ({ ...p, gstPercent: e.target.value }))} />
                    ) : `${item.gstPercent || 0}%`}
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      {editId === item._id ? (
                        <>
                          <button className={styles.tableBtnPrimary} type="button" onClick={saveEdit}>Save</button>
                          <button className={styles.tableBtn} type="button" onClick={() => setEditId('')}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className={styles.tableBtn} type="button" onClick={() => startEdit(item)}>Edit</button>
                          <button 
                            className={styles.tableBtnPrimary} 
                            style={{ background: '#6366f1' }} 
                            type="button" 
                            onClick={() => handlePrintBarcode(item)}
                          >
                            Barcode
                          </button>
                          <button className={styles.tableBtnDanger} type="button" onClick={() => deleteItem(item._id)}>Delete</button>
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

      {printingProduct && !showBarcodeModal && (
        <div className={styles.barcodePrintContainer} style={{ width: `${barcodeConfig.labelWidth}mm` }}>
          {Array.from({ length: barcodeConfig.quantity }).map((_, idx) => (
            <div key={idx} className={styles.barcodeLabelItem}>
              <div className={styles.barcodeLabelName}>{printingProduct.name}</div>
              <Barcode 
                value={printingProduct.barcode} 
                width={barcodeConfig.width} 
                height={barcodeConfig.height} 
                fontSize={14}
                margin={0}
              />
            </div>
          ))}
        </div>
      )}

      {showBarcodeModal && (
        <div className={styles.modalOverlay} onClick={handleCloseBarcodeModal}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ width: '400px' }}>
            <div className={styles.modalHeader}>
              <h4>Customize Barcode Print</h4>
              <button type="button" className={styles.closeIconBtn} onClick={handleCloseBarcodeModal}>X</button>
            </div>
            
            <div className={styles.productForm} style={{ gridTemplateColumns: '1fr' }}>
              <label className={styles.modalLabel}>
                Print Quantity
                <input 
                  type="number" 
                  className={styles.modalInput} 
                  value={barcodeConfig.quantity} 
                  onChange={e => setBarcodeConfig(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
                  min="1"
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <label className={styles.modalLabel}>
                  Bar Width
                  <input 
                    type="number" 
                    className={styles.modalInput} 
                    value={barcodeConfig.width} 
                    onChange={e => setBarcodeConfig(p => ({ ...p, width: parseFloat(e.target.value) || 1 }))}
                    step="0.1"
                  />
                </label>
                <label className={styles.modalLabel}>
                  Bar Height
                  <input 
                    type="number" 
                    className={styles.modalInput} 
                    value={barcodeConfig.height} 
                    onChange={e => setBarcodeConfig(p => ({ ...p, height: parseInt(e.target.value) || 20 }))}
                  />
                </label>
              </div>

              <label className={styles.modalLabel}>
                Label Width (mm)
                <input 
                  type="number" 
                  className={styles.modalInput} 
                  value={barcodeConfig.labelWidth} 
                  onChange={e => setBarcodeConfig(p => ({ ...p, labelWidth: parseInt(e.target.value) || 40 }))}
                />
              </label>

              <div className={styles.formButtons}>
                <button className={styles.saveBtn} onClick={handleConfirmPrint}>Print Now</button>
                <button className={styles.secondaryBtn} onClick={handleCloseBarcodeModal}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddProduct && (
        <div
          className={styles.modalOverlay}
          onClick={handleCloseAddProduct}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={styles.addProductModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h4>Add New Product</h4>
                <button type="button" className={styles.closeIconBtn} onClick={handleCloseAddProduct}>X</button>
              </div>
              <AddProductForm
                onClose={handleCloseAddProduct}
                onProductAdded={() => loadProducts(1, q)}
              />
            </div>
          </div>
        </div>
      )}

      <div className={styles.paginationBar}>
        <button className={styles.tableBtn} type="button" disabled={page <= 1} onClick={() => loadProducts(page - 1, q)}>Prev</button>
        <span>Page {page} / {totalPages}</span>
        <button className={styles.tableBtn} type="button" disabled={page >= totalPages} onClick={() => loadProducts(page + 1, q)}>Next</button>
      </div>
    </div>
  );
}

export default ProductsScreen;
