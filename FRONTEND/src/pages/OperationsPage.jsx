import React, { useMemo, useState } from 'react';
import TenantCommonHeader from '../components/TenantCommonHeader';
import SuperadminReturnBar from '../components/SuperadminReturnBar';
import SimpleMasterSection from '../components/operations/SimpleMasterSection';
import { brandsAPI, categoriesAPI } from '../services/api';

function SidebarIcon({ kind, active = false }) {
  const color = active ? '#1d4ed8' : '#64748b';
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  const paths = {
    overview: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    sales: (
      <>
        <path d="M4 19h16" />
        <path d="M7 16l4-4 3 2 5-6" />
      </>
    ),
    customers: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M4 19c0-2.8 2.2-5 5-5s5 2.2 5 5" />
        <path d="M16 11c1.7.2 3 1.7 3 3.5S17.7 17.8 16 18" />
      </>
    ),
    billing: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M4 10h16" />
        <path d="M8 15h3" />
      </>
    ),
    inventory: (
      <>
        <path d="M12 3l8 4.5-8 4.5-8-4.5L12 3z" />
        <path d="M4 7.5V16.5L12 21l8-4.5V7.5" />
      </>
    ),
    products: (
      <>
        <rect x="5" y="5" width="14" height="14" rx="2" />
        <path d="M9 9h6M9 13h6M9 17h3" />
      </>
    ),
    categories: (
      <>
        <path d="M4 7h7v7H4zM13 7h7v4h-7zM13 13h7v7h-7z" />
      </>
    ),
    brands: (
      <>
        <path d="M6 4h7l5 5-7 7-5-5z" />
        <circle cx="10" cy="8" r="1" />
      </>
    ),
    stock: (
      <>
        <path d="M6 7h12M6 12h12M6 17h12" />
        <path d="M4 7h.01M4 12h.01M4 17h.01" />
      </>
    ),
    invoices: (
      <>
        <path d="M7 3h8l4 4v14H7z" />
        <path d="M15 3v4h4M10 12h6M10 16h6" />
      </>
    ),
    reports: (
      <>
        <path d="M5 19V9M12 19V5M19 19v-8" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .7.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.7Z" />
      </>
    ),
    chevron: (
      <path d="M8 10l4 4 4-4" />
    ),
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
  };

  return <svg {...common}>{paths[kind] || paths.overview}</svg>;
}

const operationSections = [
  {
    key: 'overview',
    label: 'Overview',
    description: 'High-level operational snapshot across sales, billing, and inventory.',
  },
  {
    key: 'sales',
    label: 'Sales',
    description: 'Track sales flow and commercial activity.',
  },
  {
    key: 'customers',
    label: 'Customers',
    description: 'Manage customer records and account relationships.',
  },
  {
    key: 'billing',
    label: 'Billing',
    description: 'Handle invoices, charges, and payment workflows.',
  },
  {
    key: 'inventory',
    label: 'Inventory',
    description: 'Manage products, stock, brands, and categories.',
    children: [
      { key: 'products', label: 'Products', description: 'Catalog and product definitions.' },
      { key: 'categories', label: 'Categories', description: 'Organize products by category.' },
      { key: 'brands', label: 'Brands', description: 'Manage product brands and labels.' },
      { key: 'stock', label: 'Stock', description: 'Monitor quantities and stock movement.' },
    ],
  },
  {
    key: 'invoices',
    label: 'Invoices',
    description: 'Review invoice records and document history.',
  },
  {
    key: 'reports',
    label: 'Reports',
    description: 'Review operational performance and trends.',
  },
  {
    key: 'settings',
    label: 'Settings',
    description: 'Configure operation-specific preferences.',
  },
];

const shellStyles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #eef4ff 0%, #f7f9fc 18%, #f3f5f9 100%)',
  },
  shell: {
    width: '100%',
    padding: '12px 16px 20px',
  },
  layout: {
    display: 'grid',
    gap: 18,
    alignItems: 'start',
  },
  sidebar: (collapsed) => ({
    background: '#ffffff',
    border: '1px solid #e3e8ef',
    borderRadius: 18,
    padding: '12px 8px',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.07)',
    position: 'sticky',
    top: 12,
    width: collapsed ? 70 : 228,
    minWidth: collapsed ? 70 : 228,
    maxWidth: collapsed ? 70 : 228,
    minHeight: 'calc(100vh - 170px)',
  }),
  sidebarTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    padding: '4px 4px 10px',
  },
  sidebarTitle: {
    fontSize: 12,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#6b7280',
    fontWeight: 700,
  },
  collapseBtn: {
    border: '1px solid #dbe3ee',
    background: '#f8fafc',
    width: 30,
    height: 30,
    borderRadius: 8,
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  },
  tabs: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  tab: (active, collapsed) => ({
    border: '1px solid',
    borderColor: active ? '#c7d2fe' : 'transparent',
    background: active ? '#eef2ff' : 'transparent',
    color: active ? '#1e3a8a' : '#1f2937',
    borderRadius: 10,
    transition: 'all 0.12s ease',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: collapsed ? '8px 6px' : '8px 10px',
  }),
  tabMain: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flex: 1,
  },
  tabButton: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    margin: 0,
    cursor: 'pointer',
    textAlign: 'left',
    fontWeight: 700,
    fontSize: 13,
    color: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flex: 1,
  },
  tabLabel: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  chevronBtn: {
    border: 'none',
    background: 'transparent',
    padding: 2,
    margin: 0,
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    color: 'inherit',
  },
  subMenuWrap: {
    margin: '4px 0 8px 12px',
    paddingLeft: 8,
    borderLeft: '2px solid #e5e7eb',
    display: 'grid',
    gap: 4,
  },
  subTab: (active) => ({
    border: 'none',
    background: active ? '#eff6ff' : 'transparent',
    color: active ? '#1d4ed8' : '#475569',
    borderRadius: 8,
    padding: '7px 8px',
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  }),
  content: {
    display: 'grid',
    gap: 18,
  },
  placeholderCard: {
    background: '#ffffff',
    borderRadius: 18,
    border: '1px solid #dfe7f2',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.07)',
    padding: 20,
    color: '#475569',
    lineHeight: 1.7,
  },
};

export default function OperationsPage() {
  const [activeSection, setActiveSection] = useState('overview');
  const [activeInventorySection, setActiveInventorySection] = useState('products');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({ inventory: true });

  const section = useMemo(
    () => operationSections.find((item) => item.key === activeSection) || operationSections[0],
    [activeSection]
  );

  const inventoryChild = useMemo(
    () => section.key === 'inventory'
      ? section.children?.find((item) => item.key === activeInventorySection) || section.children?.[0]
      : null,
    [section, activeInventorySection]
  );

  const currentTitle = inventoryChild ? `${section.label} / ${inventoryChild.label}` : section.label;
  const currentDescription = inventoryChild ? inventoryChild.description : section.description;
  const layoutStyle = {
    ...shellStyles.layout,
    gridTemplateColumns: sidebarCollapsed ? '70px minmax(0, 1fr)' : '228px minmax(0, 1fr)',
  };

  const toggleMenu = (key) => {
    setExpandedMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderContent = () => {
    if (section.key === 'inventory' && inventoryChild?.key === 'brands') {
      return (
        <SimpleMasterSection
          title="Brands"
          noun="Brand"
          api={{
            get: (params) => brandsAPI.getBrands(params),
            create: (data) => brandsAPI.createBrand(data),
            update: (id, data) => brandsAPI.updateBrand(id, data),
            remove: (id) => brandsAPI.deleteBrand(id),
          }}
          descriptionPlaceholder="Optional short description for this brand"
          sectionTitle={currentTitle}
          sectionDescription={currentDescription}
        />
      );
    }

    if (section.key === 'inventory' && inventoryChild?.key === 'categories') {
      return (
        <SimpleMasterSection
          title="Categories"
          noun="Category"
          api={{
            get: (params) => categoriesAPI.getCategories(params),
            create: (data) => categoriesAPI.createCategory(data),
            update: (id, data) => categoriesAPI.updateCategory(id, data),
            remove: (id) => categoriesAPI.deleteCategory(id),
          }}
          descriptionPlaceholder="Optional short description for this category"
          sectionTitle={currentTitle}
          sectionDescription={currentDescription}
        />
      );
    }

    return (
      <div style={shellStyles.placeholderCard}>
        <div style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>{currentTitle}</div>
          <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, maxWidth: 860 }}>{currentDescription}</div>
        </div>
        This section is ready for the next build step. The first live Operations modules are <strong>Brands</strong> and <strong>Categories</strong> under Inventory, and we can build Products right after that.
      </div>
    );
  };

  return (
    <div style={shellStyles.page}>
      <SuperadminReturnBar />
      <TenantCommonHeader
        title="Operations"
        subtitle="A focused workspace for sales, billing, inventory, and business execution."
      />

      <main style={shellStyles.shell}>
        <div style={layoutStyle} className="operations-layout">
          <aside style={shellStyles.sidebar(sidebarCollapsed)} className="operations-sidebar">
            <div style={shellStyles.sidebarTop}>
              {!sidebarCollapsed && <div style={shellStyles.sidebarTitle}>Operations</div>}
              <button
                type="button"
                style={shellStyles.collapseBtn}
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                aria-label={sidebarCollapsed ? 'Expand operations menu' : 'Collapse operations menu'}
                title={sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
              >
                <SidebarIcon kind="menu" />
              </button>
            </div>
            <div style={shellStyles.tabs}>
              {operationSections.map((item) => (
                <div key={item.key}>
                  <div style={shellStyles.tab(activeSection === item.key, sidebarCollapsed)}>
                    <div style={shellStyles.tabMain}>
                      <button
                        type="button"
                        style={shellStyles.tabButton}
                        onClick={() => {
                          setActiveSection(item.key);
                          if (item.children?.length) {
                            setExpandedMenus((prev) => ({ ...prev, [item.key]: true }));
                          }
                        }}
                        title={item.label}
                      >
                        <SidebarIcon kind={item.key} active={activeSection === item.key} />
                        {!sidebarCollapsed && <span style={shellStyles.tabLabel}>{item.label}</span>}
                      </button>
                    </div>

                    {!sidebarCollapsed && item.children?.length > 0 && (
                      <button
                        type="button"
                        style={{
                          ...shellStyles.chevronBtn,
                          transform: expandedMenus[item.key] ? 'rotate(0deg)' : 'rotate(-90deg)',
                        }}
                        onClick={() => toggleMenu(item.key)}
                        aria-label={`${expandedMenus[item.key] ? 'Collapse' : 'Expand'} ${item.label} submenu`}
                      >
                        <SidebarIcon kind="chevron" active={activeSection === item.key} />
                      </button>
                    )}
                  </div>

                  {!sidebarCollapsed && item.children?.length > 0 && expandedMenus[item.key] && (
                    <div style={shellStyles.subMenuWrap}>
                      {item.children.map((child) => (
                        <button
                          key={child.key}
                          type="button"
                          style={shellStyles.subTab(activeInventorySection === child.key)}
                          onClick={() => {
                            setActiveSection(item.key);
                            setActiveInventorySection(child.key);
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <SidebarIcon kind={child.key} active={activeInventorySection === child.key} />
                            {child.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>

          <section style={shellStyles.content}>
            {renderContent()}
          </section>
        </div>
      </main>

      <style>{`
        .operations-layout {
          width: 100%;
        }

        .operations-sidebar button:focus,
        .operations-sidebar button:focus-visible {
          outline: none !important;
          box-shadow: none !important;
        }

        @media (max-width: 980px) {
          .operations-layout {
            grid-template-columns: 1fr !important;
          }
          .operations-sidebar {
            position: static !important;
            min-height: auto !important;
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
