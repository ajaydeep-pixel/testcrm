import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { billingAPI } from '../services/api';
import TenantCommonHeader from '../components/TenantCommonHeader';
import SuperadminReturnBar from '../components/SuperadminReturnBar';
import { useToast } from '../components/Toast';
import { getPlanDisplayName } from '../utils/planDisplay';

export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [status, setStatus] = useState('verifying'); // verifying, success, pending, error
  const [planName, setPlanName] = useState('');
  const [subscription, setSubscription] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      verifyCheckout(sessionId);
    } else {
      setErrorMsg('No session ID found in the URL.');
      setStatus('error');
    }
  }, []);

  const verifyCheckout = async (sessionId) => {
    try {
      const res = await billingAPI.getCheckoutStatus(sessionId);
      const data = res.data;

      if (data.status === 'active') {
        setStatus('success');
        setPlanName(getPlanDisplayName(data.plan));
        setSubscription(data.subscription);

        toast.success('Subscription activated successfully!');
      } else if (data.status === 'pending') {
        setStatus('pending');
      } else {
        setStatus('pending');
      }
    } catch (err) {
      console.error('Checkout verification failed:', err);
      setErrorMsg(err?.response?.data?.message || err?.message || 'Verification failed');
      setStatus('error');
    }
  };

  return (
    <>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      <div style={{ minHeight: '100vh', background: '#f9fafb', padding: 16 }}>
        <SuperadminReturnBar />
        <TenantCommonHeader
          title="Checkout Success"
          subtitle="Your payment and subscription status are shown below."
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 120px)' }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 40, maxWidth: 500, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
            {status === 'verifying' && (
              <>
                <div style={{ width: 56, height: 56, border: '4px solid #e5e7eb', borderTop: '4px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }} />
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Verifying Payment...</h2>
                <p style={{ color: '#6b7280', fontSize: 14 }}>Please wait while we confirm your subscription.</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', background: '#dcfce7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px', fontSize: 32,
                }}
                >
                  &#10003;
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Payment Successful!</h2>
                <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 24px' }}>
                  Your <strong style={{ color: '#2563eb', textTransform: 'capitalize' }}>{planName}</strong> subscription is now active.
                </p>

                {subscription?.currentPeriodEnd && (
                  <div style={{
                    background: '#f0f9ff', borderRadius: 8, padding: 16, marginBottom: 24,
                    textAlign: 'left', fontSize: 14,
                  }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: '#6b7280' }}>Status</span>
                      <span style={{ fontWeight: 600, color: '#16a34a' }}>Active</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6b7280' }}>Next Billing Date</span>
                      <span style={{ fontWeight: 600, color: '#111827' }}>
                        {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'long', day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => navigate('/dashboard')}
                  style={{
                    background: '#2563eb', color: 'white', border: 'none',
                    padding: '12px 32px', borderRadius: 8, cursor: 'pointer',
                    fontWeight: 700, fontSize: 15, width: '100%',
                  }}
                >
                  Go to Dashboard
                </button>
              </>
            )}

            {status === 'pending' && (
              <>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', background: '#fef3c7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px', fontSize: 32,
                }}
                >
                  &#9203;
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Payment Processing</h2>
                <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 24px' }}>
                  Your payment is being processed. Your subscription will activate shortly.
                </p>
                <button
                  onClick={() => navigate('/dashboard')}
                  style={{
                    background: '#2563eb', color: 'white', border: 'none',
                    padding: '12px 32px', borderRadius: 8, cursor: 'pointer',
                    fontWeight: 700, fontSize: 15, width: '100%',
                  }}
                >
                  Go to Dashboard
                </button>
              </>
            )}

            {status === 'error' && (
              <>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', background: '#fee2e2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px', fontSize: 32,
                }}
                >
                  &#10007;
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Verification Failed</h2>
                <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 16px' }}>
                  We couldn&apos;t verify your payment. If you were charged, your subscription will still activate via our webhook system.
                </p>
                {errorMsg && (
                  <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 24px', background: '#fef2f2', padding: '8px 12px', borderRadius: 6 }}>
                    {errorMsg}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <button
                    onClick={() => navigate('/dashboard')}
                    style={{
                      background: '#2563eb', color: 'white', border: 'none',
                      padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14,
                    }}
                  >
                    Go to Dashboard
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
