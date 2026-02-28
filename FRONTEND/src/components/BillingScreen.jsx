import React, { useState, useEffect } from 'react';
import styles from './BillingScreen.module.css';
import AddProductForm from './AddProductForm.jsx';
import CustomersModal from './CustomersModal.jsx';
import { apiService } from '../services/apiService';

const makeInvoiceNo = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `INV-${ts}-${Math.floor(Math.random() * 900 + 100)}`;
};

function BillingScreen({ cart, setCart, onResetCart, onProductCreated, onInvoiceCreated }) {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState('');
  const [lastInvoice, setLastInvoice] = useState(null);
  const [businessProfile, setBusinessProfile] = useState({});
  const [useCustomer, setUseCustomer] = useState(false);
  const [showCustomersModal, setShowCustomersModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('businessProfile');
      setBusinessProfile(raw ? JSON.parse(raw) : {});
    } catch (e) {
      setBusinessProfile({});
    }
  }, []);
  const [discountMethod, setDiscountMethod] = useState('none');
  const [discountInput, setDiscountInput] = useState('');

  const handleSearch = async (e) => {
    if (e) e.preventDefault();

    if (!search.trim()) {
      setProducts([]);
      setSearchError('');
      return;
    }

    setLoading(true);
    setSearchError('');
    
    try {
      const data = await apiService.get(`/products/search?q=${encodeURIComponent(search)}`);
      setProducts(Array.isArray(data) ? data : []);

      if (!Array.isArray(data) || data.length === 0) {
        setSearchError('No products found. Click "Add New Product" to create one.');
      }
    } catch (err) {
      setProducts([]);
      setSearchError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item._id === product._id);

      if (existingItem) {
        return prevCart.map(item =>
          item._id === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      setCart(prevCart => prevCart.filter(item => item._id !== productId));
    } else {
      setCart(prevCart =>
        prevCart.map(item =>
          item._id === productId ? { ...item, quantity } : item
        )
      );
    }
  };

  const handleRemoveFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item._id !== productId));
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalTax = 0;

    cart.forEach(item => {
      const itemSubtotal = (item.sellingPrice?.amount || 0) * item.quantity;
      const itemTax = itemSubtotal * ((item.gstPercent || 0) / 100);

      subtotal += itemSubtotal;
      totalTax += itemTax;
    });

    return {
      subtotal: subtotal.toFixed(2),
      tax: totalTax.toFixed(2),
      total: (subtotal + totalTax).toFixed(2)
    };
  };

  const totals = calculateTotals();
  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleProductNotFound = () => {
    setShowAddProduct(true);
  };

  const handleCloseModal = () => {
    setShowAddProduct(false);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setCheckoutMessage('Cart is empty.');
      return;
    }

    setCheckoutLoading(true);
    setCheckoutMessage('');
    const totals = calculateTotals();
    const totalNum = Number(totals.total) || 0;

    let discountAmountNum = 0;
    let finalTotalNum = totalNum;

    if (discountMethod === 'final') {
      const desired = Number(discountInput) || 0;
      const clamped = Math.max(0, Math.min(desired, totalNum));
      discountAmountNum = +(totalNum - clamped).toFixed(2);
      finalTotalNum = +clamped.toFixed(2);
    } else if (discountMethod === 'amount') {
      const amt = Number(discountInput) || 0;
      const clamped = Math.max(0, Math.min(amt, totalNum));
      discountAmountNum = +clamped.toFixed(2);
      finalTotalNum = +(totalNum - clamped).toFixed(2);
    } else if (discountMethod === 'percent') {
      const pct = Number(discountInput) || 0;
      const clampedPct = Math.max(0, Math.min(pct, 100));
      discountAmountNum = +((totalNum * clampedPct) / 100).toFixed(2);
      finalTotalNum = +(totalNum - discountAmountNum).toFixed(2);
    }

    try {
      const payload = {
        invoiceNo: makeInvoiceNo(),
        items: cart.map((item) => ({
          product: item._id,
          name: item.name,
          barcode: item.barcode || '',
          quantity: item.quantity,
          price: Number(item.sellingPrice?.amount || 0),
          gstPercent: Number(item.gstPercent || 0),
          discount: 0
        })),
        customer: selectedCustomer ? { id: selectedCustomer._id, name: selectedCustomer.name, phone: selectedCustomer.phone } : { name: 'Walk-in Customer' },
        paymentMethod: 'Cash',
        totalAmount: finalTotalNum,
        gstAmount: Number(totals.tax),
        discountAmount: discountAmountNum,
        paidAmount: finalTotalNum
      };

      const data = await apiService.post('/sales', payload);
      setLastInvoice(data);
      setCart([]);
      setCheckoutMessage(`Invoice ${data.invoiceNo} saved successfully.`);
      if (onInvoiceCreated) onInvoiceCreated(data);
    } catch (err) {
      setCheckoutMessage(`Checkout failed: ${err.message}`);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleCloseModal();
    }
  };

  return (
    <div className={styles.posPage}>
      <div className={styles.billingContainer}>
        <div className={styles.posHeader}>
          <div>
            <h1 className={styles.header}>Bike Parts Billing</h1>
            <p className={styles.headerNote}>Search product, add to cart, and complete billing</p>
          </div>
          <button className={styles.secondaryBtn} type="button" onClick={handleProductNotFound}>
            + New Product
          </button>
        </div>

        <form className={styles.searchBar} onSubmit={handleSearch}>
          <input
            className={styles.searchInput}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Scan barcode or search product name/brand..."
            disabled={loading}
          />
          <button className={styles.searchButton} type="submit" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        <div className={styles.contentGrid}>
          <section className={styles.resultsPanel}>
            <div className={styles.panelTitleRow}>
              <h3 className={styles.panelTitle}>Results</h3>
              {searchError && <span className={styles.errorInline}>{searchError}</span>}
            </div>

            {products.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No products selected yet.</p>
                <button className={styles.secondaryBtn} type="button" onClick={handleProductNotFound}>
                  Add Product Manually
                </button>
              </div>
            ) : (
              <div className={styles.productList}>
                {products.map(p => (
                  <div className={styles.productCard} key={p._id}>
                    <div className={styles.productMeta}>
                      <div className={styles.productName}>{p.name}</div>
                      <div className={styles.productSub}>{p.brand || 'Unknown brand'} • {p.category || 'General'}</div>
                    </div>
                    
                    <div className={styles.productStockInfo}>
                      <span className={styles.stockLabel}>Stock</span>
                      <span className={`${styles.stockValue} ${(p.inventoryStatus?.available || 0) <= 0 ? styles.outOfStock : ''}`}>
                        {p.inventoryStatus?.available ?? 0}
                      </span>
                    </div>

                    <div className={styles.productActions}>
                      <span className={styles.productPrice}>${(p.sellingPrice?.amount || 0).toFixed(2)}</span>
                      <button
                        className={styles.addButton}
                        onClick={() => handleAddToCart(p)}
                        type="button"
                        disabled={(p.inventoryStatus?.available || 0) <= 0}
                      >
                        {(p.inventoryStatus?.available || 0) > 0 ? 'Add' : 'Out'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className={styles.cartSection}>
            <div className={styles.cartHeader}>
              <h3 className={styles.panelTitle}>Cart</h3>
              <div className={styles.cartHeaderActions}>
                <span className={styles.cartBadge}>{totalQty} items</span>
                    <button type="button" className={styles.tableBtnDanger} onClick={onResetCart}>
                      Reset
                    </button>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                      <input type="checkbox" checked={useCustomer} onChange={e => setUseCustomer(e.target.checked)} /> Attach Customer
                    </label>
              </div>
            </div>

            {cart.length === 0 ? (
              <div className={styles.emptyCart}>Cart is empty. Add products to begin billing.</div>
            ) : (
              <>
                <div className={styles.cartList}>
                  {cart.map((item) => (
                    <div className={styles.cartItem} key={item._id}>
                      <div className={styles.itemDetails}>
                        <span className={styles.itemName}>{item.name}</span>
                        <span className={styles.itemPrice}>${(item.sellingPrice?.amount || 0).toFixed(2)}</span>
                      </div>
                      <div className={styles.itemControls}>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item._id, item.quantity - 1)}
                          className={styles.quantityBtn}
                        >
                          -
                        </button>
                        <span className={styles.quantity}>{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item._id, item.quantity + 1)}
                          className={styles.quantityBtn}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(item._id)}
                          className={styles.removeBtn}
                        >
                          Remove
                        </button>
                      </div>
                      <span className={styles.itemTotal}>
                        ${((item.sellingPrice?.amount || 0) * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                {useCustomer && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        className={styles.modalInput}
                        placeholder="Search customer by phone"
                        value={selectedCustomer ? selectedCustomer.phone : ''}
                        onChange={() => { /* read-only, selection via modal */ }}
                        readOnly
                        style={{ width: 250 }}
                      />
                      {/* <button className={styles.searchButton} type="button" onClick={() => setShowCustomersModal(true)}>Search / Select</button> */}
                      <button className={styles.secondaryBtn} type="button" onClick={() => setSelectedCustomer(null)}>Clear</button>
                      <button className={styles.secondaryBtn} type="button" onClick={() => setShowCustomersModal(true)}>Search / Manage</button>
                    </div>
                    {selectedCustomer && (
                      <div style={{ marginTop: 8, fontSize: 13 }}>
                        <strong>Selected:</strong> {selectedCustomer.name || '(No name)'} — {selectedCustomer.phone}
                      </div>
                    )}
                  </div>
                )}
                <div className={styles.cartTotals}>
                  <div className={styles.totalRow}>
                    <span>Subtotal</span>
                    <span>${totals.subtotal}</span>
                  </div>
                  <div className={styles.totalRow}>
                    <span>Tax (GST)</span>
                    <span>${totals.tax}</span>
                  </div>
                  <div style={{ marginTop: 8, borderTop: '1px dashed var(--border-subtle)', paddingTop: 8 }}>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>Apply Discount</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="radio" name="discountMethod" value="none" checked={discountMethod === 'none'} onChange={() => { setDiscountMethod('none'); setDiscountInput(''); }} /> None
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="radio" name="discountMethod" value="final" checked={discountMethod === 'final'} onChange={() => { setDiscountMethod('final'); setDiscountInput(''); }} /> Final Amount
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="radio" name="discountMethod" value="amount" checked={discountMethod === 'amount'} onChange={() => { setDiscountMethod('amount'); setDiscountInput(''); }} /> Fixed Amount
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="radio" name="discountMethod" value="percent" checked={discountMethod === 'percent'} onChange={() => { setDiscountMethod('percent'); setDiscountInput(''); }} /> Percent
                      </label>
                    </div>

                    {discountMethod !== 'none' && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          className={styles.modalInput}
                          type="number"
                          step="0.01"
                          min="0"
                          value={discountInput}
                          onChange={e => setDiscountInput(e.target.value)}
                          placeholder={discountMethod === 'final' ? 'Enter final total (e.g. 420)' : discountMethod === 'percent' ? 'Enter percent (e.g. 10)' : 'Enter amount (e.g. 30)'}
                          style={{ width: 180 }}
                        />
                        <div style={{ fontWeight: 700 }}>
                          {(() => {
                            const totalNum = Number(totals.total) || 0;
                            let discountAmountNum = 0;
                            let finalTotalNum = totalNum;
                            if (discountMethod === 'final') {
                              const desired = Number(discountInput) || 0;
                              const clamped = Math.max(0, Math.min(desired, totalNum));
                              discountAmountNum = +(totalNum - clamped).toFixed(2);
                              finalTotalNum = +clamped.toFixed(2);
                            } else if (discountMethod === 'amount') {
                              const amt = Number(discountInput) || 0;
                              const clamped = Math.max(0, Math.min(amt, totalNum));
                              discountAmountNum = +clamped.toFixed(2);
                              finalTotalNum = +(totalNum - clamped).toFixed(2);
                            } else if (discountMethod === 'percent') {
                              const pct = Number(discountInput) || 0;
                              const clampedPct = Math.max(0, Math.min(pct, 100));
                              discountAmountNum = +((totalNum * clampedPct) / 100).toFixed(2);
                              finalTotalNum = +(totalNum - discountAmountNum).toFixed(2);
                            }
                            return (
                              <div>
                                <div>Discount: ${discountAmountNum.toFixed(2)}</div>
                                <div>Final Total: ${finalTotalNum.toFixed(2)}</div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={styles.cartTotal}>
                    <span>Total</span>
                    <span>${totals.total}</span>
                  </div>
                </div>

                <button className={styles.checkoutBtn} type="button" onClick={handleCheckout} disabled={checkoutLoading}>
                  {checkoutLoading ? 'Submitting...' : 'Submit Billing'}
                </button>
              </>
            )}
            {checkoutMessage && (
              <div className={checkoutMessage.toLowerCase().includes('failed') ? styles.crmError : styles.crmSuccess}>
                {checkoutMessage}
                {lastInvoice && (
                  <button onClick={handlePrintReceipt} className={styles.tableBtnPrimary} style={{ marginLeft: '10px' }}>
                    Print Receipt
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Hidden Receipt for Printing */}
      {lastInvoice && (
        <div className={styles.receiptContainer}>
          <div className={styles.receiptHeader}>
            {businessProfile.logoUrl ? (
              <img src={businessProfile.logoUrl} alt="logo" style={{ maxHeight: 64, marginBottom: 6 }} />
            ) : null}
            <h3>{businessProfile.shopName || 'BIKE PARTS POS'}</h3>
            {businessProfile.address && <div style={{ fontSize: 12 }}>{businessProfile.address}</div>}
            {businessProfile.phone && <div style={{ fontSize: 12 }}>Phone: {businessProfile.phone}</div>}
            {businessProfile.gstNumber && <div style={{ fontSize: 12 }}>GST: {businessProfile.gstNumber}</div>}
            {lastInvoice.customer && (
              <div style={{ marginTop: 6 }}>
                <strong>Customer:</strong> {lastInvoice.customer.name || ''} {lastInvoice.customer.phone ? `— ${lastInvoice.customer.phone}` : ''}
              </div>
            )}
            <p style={{ marginTop: 6 }}>Invoice: {lastInvoice.invoiceNo}</p>
            <p>Date: {new Date(lastInvoice.createdAt).toLocaleString()}</p>
          </div>
          <table className={styles.receiptTable}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {lastInvoice.items.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>${item.price.toFixed(2)}</td>
                  <td>${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.receiptTotalRow}>
            <span>Subtotal:</span>
            <span>${(lastInvoice.totalAmount - lastInvoice.gstAmount).toFixed(2)}</span>
          </div>
          <div className={styles.receiptTotalRow}>
            <span>GST:</span>
            <span>${lastInvoice.gstAmount.toFixed(2)}</span>
          </div>
          {lastInvoice.discountAmount > 0 && (
            <div className={styles.receiptTotalRow}>
              <span>Discount:</span>
              <span>-${lastInvoice.discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className={styles.receiptTotalRow}>
            <span>GRAND TOTAL:</span>
            <span>${lastInvoice.totalAmount.toFixed(2)}</span>
          </div>
          <div className={styles.receiptFooter}>
            <p>Thank you for your business!</p>
            <p>Keep invoice for warranty.</p>
          </div>
        </div>
      )}

      {showAddProduct && (
        <div
          className={styles.modalOverlay}
          onClick={handleCloseModal}
          onKeyDown={handleKeyDown}
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
                <button type="button" className={styles.closeIconBtn} onClick={handleCloseModal}>X</button>
              </div>
              <AddProductForm
                onClose={handleCloseModal}
                onProductAdded={() => {
                  handleSearch();
                  if (onProductCreated) onProductCreated();
                }}
              />
            </div>
          </div>
        </div>
      )}
      {showCustomersModal && (
        <CustomersModal
          onClose={() => setShowCustomersModal(false)}
          onSelect={(c) => { setSelectedCustomer(c); setShowCustomersModal(false); }}
        />
      )}
    </div>
  );
}

export default BillingScreen;
