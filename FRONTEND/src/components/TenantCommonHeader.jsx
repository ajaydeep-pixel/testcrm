import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
export default function TenantCommonHeader() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <header
      className="tenant-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 32px',
        background: isDark ? '#181f2a' : '#f8fafc',
        borderBottom: isDark ? '1px solid #232a3a' : '1px solid #e5e7eb',
        color: isDark ? '#f3f4f6' : '#111827',
        transition: 'background 0.2s, color 0.2s',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: '20px', color: isDark ? '#f3f4f6' : '#111827' }}>Tenant Portal</div>
      <nav style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
        <Link to="/dashboard" style={{ fontWeight: 600, color: isDark ? '#f3f4f6' : '#111827' }}>Dashboard</Link>
        <Link to="/settings" style={{ fontWeight: 600, color: isDark ? '#f3f4f6' : '#111827' }}>Settings</Link>
        <Link to="/billing" style={{ fontWeight: 600, color: isDark ? '#f3f4f6' : '#111827' }}>Billing</Link>
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
        <button
          onClick={toggleTheme}
          title={theme === 'light' ? 'Enable Dark Mode' : 'Enable Light Mode'}
          style={{
            marginLeft: 16,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            color: isDark ? '#f3f4f6' : '#111827',
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
      </nav>
    </header>
  );
}
