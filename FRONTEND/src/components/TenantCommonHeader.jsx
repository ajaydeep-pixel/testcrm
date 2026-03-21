import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

export default function TenantCommonHeader({
  title,
  subtitle,
  showNav = true,
  portalLabel = 'Tenant Portal',
  compact = false,
}) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const useCompactLayout = compact || !showNav;

  return (
    <header
      className="tenant-header"
      style={{
        width: '100%',
        maxWidth: useCompactLayout ? 720 : '100%',
        margin: '0 auto',
        background: isDark ? '#181f2a' : '#f8fafc',
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
          maxWidth: useCompactLayout ? 720 : 1280,
          margin: '0 auto',
          padding: useCompactLayout ? '24px 24px' : '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: useCompactLayout ? 10 : 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: useCompactLayout ? '15px' : '20px',
              letterSpacing: useCompactLayout ? '0.02em' : 0,
              color: isDark ? '#f3f4f6' : '#111827',
            }}
          >
            {portalLabel}
          </div>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            {showNav && (
              <nav style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                <Link to="/dashboard" style={{ fontWeight: 600, color: isDark ? '#f3f4f6' : '#111827' }}>Dashboard</Link>
                <Link to="/settings" style={{ fontWeight: 600, color: isDark ? '#f3f4f6' : '#111827' }}>Settings</Link>
              
                <button
                  style={{ fontWeight: 600, color: isDark ? '#f3f4f6' : '#111827', background: 'none', border: 'none', cursor: 'pointer' }}
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
                marginLeft: showNav ? 16 : 0,
                width: 40,
                height: 40,
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
        {typeof title !== 'undefined' && (
          <div
            style={{
              display: 'flex',
              flexDirection: useCompactLayout ? 'column' : 'row',
              alignItems: useCompactLayout ? 'flex-start' : 'center',
              justifyContent: 'space-between',
              gap: 16,
              marginTop: 4,
            }}
          >
            <h1 style={{ fontSize: useCompactLayout ? 22 : 28, fontWeight: 700, margin: 0 }}>{title}</h1>
            {subtitle && (
              <div
                style={{
                  flex: useCompactLayout ? 'initial' : 1,
                  display: 'flex',
                  justifyContent: useCompactLayout ? 'flex-start' : 'flex-end',
                  width: useCompactLayout ? '100%' : 'auto',
                }}
              >
                <p
                  style={{
                    color: '#6b7280',
                    margin: 0,
                    textAlign: useCompactLayout ? 'left' : 'right',
                    maxWidth: 640,
                    paddingRight: useCompactLayout ? 0 : 6,
                  }}
                >
                  {subtitle}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
