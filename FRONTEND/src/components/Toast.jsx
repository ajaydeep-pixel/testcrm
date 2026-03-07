import React, { useState, useCallback, useEffect, createContext, useContext } from 'react';

const ToastContext = createContext();

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const toast = useCallback({
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    warning: (msg) => addToast(msg, 'warning'),
    info: (msg) => addToast(msg, 'info'),
  }, [addToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={containerStyle}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }) {
  const [exiting, setExiting] = useState(false);

  const handleClose = () => {
    setExiting(true);
    setTimeout(onClose, 250);
  };

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const colors = {
    success: { bg: '#f0fdf4', border: '#16a34a', text: '#15803d' },
    error: { bg: '#fef2f2', border: '#dc2626', text: '#b91c1c' },
    warning: { bg: '#fffbeb', border: '#d97706', text: '#92400e' },
    info: { bg: '#eff6ff', border: '#2563eb', text: '#1e40af' },
  };

  const c = colors[toast.type] || colors.info;

  return (
    <div
      style={{
        ...toastStyle,
        background: c.bg,
        borderLeft: `4px solid ${c.border}`,
        color: c.text,
        animation: exiting ? 'toastSlideOut 0.25s ease forwards' : 'toastSlideIn 0.25s ease',
      }}
    >
      <span style={{ marginRight: '8px', fontSize: '16px' }}>{icons[toast.type]}</span>
      <span style={{ flex: 1, fontSize: '14px', lineHeight: '1.4' }}>{toast.message}</span>
      <button onClick={handleClose} style={closeBtnStyle}>&times;</button>
    </div>
  );
}

const containerStyle = {
  position: 'fixed',
  top: '20px',
  right: '20px',
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  maxWidth: '400px',
};

const toastStyle = {
  display: 'flex',
  alignItems: 'center',
  padding: '14px 16px',
  borderRadius: '8px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
  minWidth: '300px',
};

const closeBtnStyle = {
  background: 'none',
  border: 'none',
  fontSize: '18px',
  cursor: 'pointer',
  opacity: 0.5,
  padding: '0 4px',
  marginLeft: '8px',
  color: 'inherit',
};

// Inject keyframe animations once
if (typeof document !== 'undefined' && !document.getElementById('toast-keyframes')) {
  const style = document.createElement('style');
  style.id = 'toast-keyframes';
  style.textContent = `
    @keyframes toastSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes toastSlideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
  `;
  document.head.appendChild(style);
}
