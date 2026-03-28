import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');
const resolveAssetUrl = (url) => (url && url.startsWith('/uploads/') ? `${API_ORIGIN}${url}` : url);

export default function TenantCommonHeader({
  title,
  subtitle,
  showNav = true,
  portalLabel,
  compact = false,
}) {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const useCompactLayout = compact || !showNav;
  const [branding, setBranding] = React.useState({ appName: '', logoUrl: '' });

  React.useEffect(() => {
    let active = true;

    fetch(`${API_BASE_URL}/branding`)
      .then((res) => res.json())
      .then((data) => {
        if (active) {
          setBranding({
            appName: data?.appName || 'BikeFlow',
            logoUrl: data?.logoUrl || '',
          });
        }
      })
      .catch(() => {
        if (active) {
          setBranding({ appName: 'BikeFlow', logoUrl: '' });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const resolvedPortalLabel = portalLabel || branding.appName || 'BikeFlow';
  const resolvedLogoUrl = branding.logoUrl ? resolveAssetUrl(branding.logoUrl) : '';
  const isActiveRoute = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const navItemStyle = (path) => ({
    fontWeight: 700,
    color: isActiveRoute(path)
      ? (isDark ? '#dbeafe' : '#1d4ed8')
      : (isDark ? '#e5e7eb' : '#1f2937'),
    textDecoration: 'none',
    padding: '7px 12px',
    borderRadius: 999,
    background: isActiveRoute(path)
      ? (isDark ? '#1e3a8a' : '#dbeafe')
      : (isDark ? '#1f2937' : '#ffffff'),
    border: isActiveRoute(path)
      ? (isDark ? '1px solid #60a5fa' : '1px solid #93c5fd')
      : (isDark ? '1px solid #334155' : '1px solid #dbe3ee'),
    boxShadow: isActiveRoute(path)
      ? (isDark ? '0 0 0 1px rgba(96,165,250,0.15)' : '0 4px 12px rgba(59,130,246,0.12)')
      : 'none',
    transition: 'all 0.15s ease',
  });

  return (
    <header
      className="tenant-header"
      style={{
        width: '100%',
        maxWidth: useCompactLayout ? 960 : '100%',
        margin: '0 auto',
        background: isDark ? '#141b26' : '#f8fbff',
        borderBottom: isDark ? '1px solid #232a3a' : '1px solid #e5e7eb',
        borderRadius: useCompactLayout ? 16 : 0,
        color: isDark ? '#f3f4f6' : '#111827',
        boxShadow: useCompactLayout
          ? (isDark ? '0 14px 32px rgba(2, 6, 23, 0.28)' : '0 14px 32px rgba(15, 23, 42, 0.12)')
          : 'none',
        overflow: 'hidden',
        transition: 'background 0.2s, color 0.2s',
      }}
    >
      <div
        style={{
          maxWidth: useCompactLayout ? 900 : '100%',
          margin: '0 auto',
          padding: useCompactLayout ? '18px 20px' : '16px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minHeight: 36,
            }}
          >
            {resolvedLogoUrl ? (
              <img
                src={resolvedLogoUrl}
                alt={resolvedPortalLabel}
                style={{
                  height: useCompactLayout ? 56 : 72,
                  maxWidth: useCompactLayout ? 260 : 340,
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            ) : (
              <span
                style={{
                  fontWeight: 700,
                  fontSize: useCompactLayout ? '14px' : '15px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: isDark ? '#f3f4f6' : '#111827',
                }}
              >
                {resolvedPortalLabel}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {showNav && (
              <nav style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Link
                  to="/dashboard"
                  style={navItemStyle('/dashboard')}
                >
                  Dashboard
                </Link>
                <Link
                  to="/operations"
                  style={navItemStyle('/operations')}
                >
                  Operations
                </Link>
                <Link
                  to="/settings"
                  style={navItemStyle('/settings')}
                >
                  Settings
                </Link>
              
                <button
                  style={{
                    fontWeight: 600,
                    color: isDark ? '#fca5a5' : '#b91c1c',
                    background: isDark ? '#1f2937' : '#ffffff',
                    border: isDark ? '1px solid #7f1d1d' : '1px solid #fecaca',
                    cursor: 'pointer',
                    padding: '7px 12px',
                    borderRadius: 999,
                  }}
                  onClick={() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '/login';
                  }}
                >
                  Logout
                </button>
              </nav>
            )}
            <button
              onClick={toggleTheme}
              title={theme === 'light' ? 'Enable Dark Mode' : 'Enable Light Mode'}
              style={{
                marginLeft: showNav ? 2 : 0,
                width: 36,
                height: 36,
                borderRadius: 999,
                border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                background: isDark ? '#111827' : '#ffffff',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDark ? '#f3f4f6' : '#111827',
                boxShadow: isDark ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.08)',
              }}
            >
              {theme === 'light' ? (
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M21 12.79A9 9 0 0 1 12.21 3c0-.01 0-.01 0 0a9 9 0 1 0 8.79 9.79z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
