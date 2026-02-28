
import React, { useState } from 'react';
import BillingScreen from './components/BillingScreen';
import ProductsScreen from './components/ProductsScreen';
import InventoryScreen from './components/InventoryScreen';
import InvoicesScreen from './components/InvoicesScreen';
import BrandsScreen from './components/BrandsScreen';
import CategoriesScreen from './components/CategoriesScreen';
import LoginScreen from './components/LoginScreen';
import styles from './components/BillingScreen.module.css';

function App() {
  const [user, setUser] = useState(null);
  const [activeModule, setActiveModule] = useState('billing');
  const [refreshKey, setRefreshKey] = useState(0);
  const [cart, setCart] = useState([]);

  const handleProductCreated = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleInvoiceCreated = () => {
    setRefreshKey(prev => prev + 1);
    setActiveModule('invoices');
  };

  const handleResetCart = () => {
    setCart([]);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setCart([]);
    setUser(null);
  };

  const renderModule = () => {
    if (activeModule === 'products') {
      return <ProductsScreen refreshKey={refreshKey} />;
    }
    if (activeModule === 'inventory') {
      return <InventoryScreen refreshKey={refreshKey} />;
    }
    if (activeModule === 'invoices') {
      return <InvoicesScreen refreshKey={refreshKey} />;
    }
    if (activeModule === 'brands') {
      return <BrandsScreen refreshKey={refreshKey} onMastersUpdated={handleProductCreated} />;
    }
    if (activeModule === 'categories') {
      return <CategoriesScreen refreshKey={refreshKey} onMastersUpdated={handleProductCreated} />;
    }
    return (
      <BillingScreen
        cart={cart}
        setCart={setCart}
        onResetCart={handleResetCart}
        onProductCreated={handleProductCreated}
        onInvoiceCreated={handleInvoiceCreated}
      />
    );
  };

  return (
    <>
      {!user ? (
        <LoginScreen onLogin={setUser} />
      ) : (
        <div className={styles.crmShell}>
          <header className={styles.crmTopbar}>
            <div className={styles.crmBrand}>Bike Parts CRM</div>
            <nav className={styles.crmTabs}>
              <button
                type="button"
                className={`${styles.crmTabBtn} ${activeModule === 'billing' ? styles.crmTabActive : ''}`}
                onClick={() => setActiveModule('billing')}
              >
                Billing
              </button>
              <button
                type="button"
                className={`${styles.crmTabBtn} ${activeModule === 'products' ? styles.crmTabActive : ''}`}
                onClick={() => setActiveModule('products')}
              >
                Products
              </button>
              <button
                type="button"
                className={`${styles.crmTabBtn} ${activeModule === 'inventory' ? styles.crmTabActive : ''}`}
                onClick={() => setActiveModule('inventory')}
              >
                Inventory
              </button>
              <button
                type="button"
                className={`${styles.crmTabBtn} ${activeModule === 'invoices' ? styles.crmTabActive : ''}`}
                onClick={() => setActiveModule('invoices')}
              >
                Invoices
              </button>
              <button
                type="button"
                className={`${styles.crmTabBtn} ${activeModule === 'brands' ? styles.crmTabActive : ''}`}
                onClick={() => setActiveModule('brands')}
              >
                Brands
              </button>
              <button
                type="button"
                className={`${styles.crmTabBtn} ${activeModule === 'categories' ? styles.crmTabActive : ''}`}
                onClick={() => setActiveModule('categories')}
              >
                Categories
              </button>
            </nav>
            <button type="button" className={styles.crmLogoutBtn} onClick={handleLogout}>
              Logout
            </button>
          </header>
          <main>{renderModule()}</main>
        </div>
      )}
    </>
  );
}

export default App;
