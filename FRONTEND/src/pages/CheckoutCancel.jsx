import React from 'react';
import { useNavigate } from 'react-router-dom';
import TenantCommonHeader from '../components/TenantCommonHeader';
import SuperadminReturnBar from '../components/SuperadminReturnBar';

export default function CheckoutCancel() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <SuperadminReturnBar />
      <div style={{ background: 'white', borderRadius: 16, padding: 40, maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: '#fef3c7',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: 32,
        }}>
          &#8617;
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Checkout Canceled</h2>
        <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 24px' }}>
          Your checkout was canceled. No charges were made. You can try again anytime from your dashboard.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'white', color: '#374151', border: '1px solid #d1d5db',
              padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14,
            }}
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: '#2563eb', color: 'white', border: 'none',
              padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14,
            }}
          >
            Try Again
          </button>
        </div>
        <TenantCommonHeader />
      </div>
    </div>
  );
}
