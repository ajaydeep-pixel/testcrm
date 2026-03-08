import React from 'react';

export default function SuperadminReturnBar() {
  const isSuperadminSession = !!localStorage.getItem('superadmin_token');

  const handleReturnToAdmin = () => {
    const superToken = localStorage.getItem('superadmin_token');
    const superUser = localStorage.getItem('superadmin_user');
    if (superToken) {
      localStorage.setItem('token', superToken);
      localStorage.setItem('user', superUser);
      localStorage.removeItem('superadmin_token');
      localStorage.removeItem('superadmin_user');
      window.location.href = '/admin';
    }
  };

  if (!isSuperadminSession) return null;

  return (
    <div style={{
      background: '#e74c3c',
      color: 'white',
      padding: '10px 20px',
      textAlign: 'center',
      fontSize: '14px',
      fontWeight: '600',
      width: '100%',
      zIndex: 100,
      position: 'relative',
    }}>
      ⚠️ You are viewing this account as Superadmin.{' '}
      <button
        onClick={handleReturnToAdmin}
        style={{
          background: 'white',
          color: '#e74c3c',
          border: 'none',
          padding: '5px 15px',
          borderRadius: '4px',
          cursor: 'pointer',
          marginLeft: '10px',
          fontWeight: '600',
        }}
      >
        Return to Admin Dashboard
      </button>
    </div>
  );
}
