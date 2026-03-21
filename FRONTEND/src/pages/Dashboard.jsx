import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usageAPI, salesAPI, inventoryAPI, billingAPI } from '../services/api';
import { useToast } from '../components/Toast';
import SalesWidget from '../components/SalesWidget';
import InventoryWidget from '../components/InventoryWidget';
import RateLimitWidget from '../components/RateLimitWidget';
import TopProductsWidget from '../components/TopProductsWidget';
import QuickActionsWidget from '../components/QuickActionsWidget';
import TenantCommonHeader from '../components/TenantCommonHeader';
import SuperadminReturnBar from '../components/SuperadminReturnBar';
import { format } from 'date-fns';
import { useTheme } from '../context/ThemeContext';
import { getPlanDisplayName } from '../utils/planDisplay';

const formatPlanPriceLabel = (plan) => {
  if (!plan) return 'N/A';
  if (plan.price === 0) return 'Free';
  if (plan.paymentType === 'subscription') {
    const cycleLabel = plan.cycleType === 'custom'
      ? `${plan.customDays || 0} days`
      : plan.cycleType === 'yearly'
        ? 'year'
        : 'month';
    return `$${plan.price}/${cycleLabel}`;
  }
  return `$${plan.price} one-time`;
};

export default function Dashboard() {
  const toast = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [todaysSales, setTodaysSales] = useState(0);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [error, setError] = useState(null);
  const [plans, setPlans] = useState([]);
  const [currentPlanSlug, setCurrentPlanSlug] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const { theme, toggleTheme } = useTheme();

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

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [usage, sales, inventory, products, plansRes, subRes] = await Promise.all([
        usageAPI.getDashboard().catch(() => ({ data: null })),
        salesAPI.getTodaysSales().catch(() => ({ data: { total: 0 } })),
        inventoryAPI.getLowStockItems(10).catch(() => ({ data: [] })),
        salesAPI.getTopProducts(5).catch(() => ({ data: [] })),
        billingAPI.getPlans().catch(() => ({ data: { plans: [] } })),
        billingAPI.getSubscriptionStatus().catch(() => ({ data: null })),
      ]);

      setDashboardData(usage.data);
      setTodaysSales(sales.data?.total || 0);
      setLowStockItems(inventory.data || []);
      setTopProducts(products.data || []);
      setPlans(plansRes.data?.plans || []);
      setSubscription(subRes.data);

      const planSlug = subRes.data?.plan || usage.data?.tenant?.planSlug || 'trial';
      setCurrentPlanSlug(planSlug);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const hasActivePaidSubscription = subscription?.hasActiveSubscription && subscription?.isPaid;
  const subscriptionStatus = subscription?.subscription?.status;
  const isCanceling = subscriptionStatus === 'canceling';
  const currentPlanDetails = subscription?.planDetails
    || dashboardData?.tenant?.plan
    || plans.find((plan) => plan.slug === currentPlanSlug)
    || null;
  const currentPlanName = getPlanDisplayName(currentPlanDetails, currentPlanSlug || 'trial');

  const handlePlanAction = (planSlug) => {
    const plan = plans.find(p => p.slug === planSlug);
    if (!plan) return;

    if (plan.price === 0) {
      // Free plan - direct switch (only if no active subscription)
      if (hasActivePaidSubscription) {
        toast.error('Cancel your current subscription before switching to a free plan');
        return;
      }
      handleFreePlanSwitch(planSlug);
    } else {
      // Paid plan - go to checkout page
      if (hasActivePaidSubscription && !isCanceling) {
        toast.error('Cancel your current subscription before subscribing to a new plan');
        return;
      }
      setShowUpgradeModal(false);
      navigate(`/checkout/${planSlug}`);
    }
  };

  const handleFreePlanSwitch = async (planSlug) => {
    try {
      await billingAPI.changePlan(planSlug);
      setCurrentPlanSlug(planSlug);
      setShowUpgradeModal(false);
      toast.success(`Switched to ${planSlug} plan`);
      fetchDashboardData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to switch plan');
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setCanceling(true);
      const res = await billingAPI.cancelSubscription(false);
      toast.success(res.data?.message || 'Subscription cancellation scheduled');
      setShowCancelConfirm(false);
      fetchDashboardData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to cancel subscription');
    } finally {
      setCanceling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SuperadminReturnBar />
      <TenantCommonHeader
        title="Dashboard"
        subtitle={format(new Date(), 'EEEE, MMMM d, yyyy')}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Top Row: Sales & Usage */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <SalesWidget todaysSales={todaysSales} />
          <RateLimitWidget data={dashboardData} />
          <QuickActionsWidget />
        </div>

        {/* Middle Row: Inventory & Top Products */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <InventoryWidget lowStockItems={lowStockItems} />
          <TopProductsWidget products={topProducts} />
        </div>

        {/* Bottom: Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Stats</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded">
              <div className="text-2xl font-bold text-blue-600">
                {dashboardData?.usage?.apiCallsThisMonth || 0}
              </div>
              <div className="text-sm text-gray-600">API Calls</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded">
              <div className="text-2xl font-bold text-green-600">
                {dashboardData?.usage?.invoiceCount || 0}
              </div>
              <div className="text-sm text-gray-600">Invoices</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded">
              <div className="text-2xl font-bold text-purple-600">
                {lowStockItems.length}
              </div>
              <div className="text-sm text-gray-600">Low Stock Items</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded">
              <div className="text-2xl font-bold text-orange-600">
                {dashboardData?.usage?.percentUsed || 0}%
              </div>
              <div className="text-sm text-gray-600">Usage</div>
            </div>
          </div>
        </div>

        {/* Plan & Usage Section */}
        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Your Plan & Usage</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              {hasActivePaidSubscription && !isCanceling && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  style={{
                    background: 'white', color: '#dc2626', border: '1px solid #dc2626',
                    padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                  }}
                >
                  Cancel Subscription
                </button>
              )}
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
              >
                View Plans
              </button>
            </div>
          </div>

          {/* Active Subscription Banner */}
          {hasActivePaidSubscription && subscription?.subscription && (
            <div style={{
              background: isCanceling ? '#fef3c7' : '#f0fdf4',
              border: `1px solid ${isCanceling ? '#f59e0b' : '#22c55e'}`,
              borderRadius: 8, padding: 16, marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <span style={{
                    display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                    background: isCanceling ? '#fbbf24' : '#22c55e', color: 'white', marginRight: 8,
                  }}>
                    {isCanceling ? 'Canceling' : 'Active'}
                  </span>
                  <span style={{ fontWeight: 600, color: '#111827' }}>
                    {subscription.subscription.gateway === 'stripe' ? 'Stripe' : ''} Subscription
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  {isCanceling ? (
                    <>Cancels on <strong>{new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong></>
                  ) : (
                    <>Next billing: <strong>{new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong></>
                  )}
                </div>
              </div>
              {isCanceling && (
                <p style={{ fontSize: 13, color: '#92400e', margin: '8px 0 0' }}>
                  Your subscription will remain active until the end of the current billing period. After that, you'll be switched to a free plan.
                </p>
              )}
            </div>
          )}

          {subscription?.subscription?.status === 'past_due' && (
            <div style={{ background: '#fee2e2', border: '1px solid #ef4444', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <p style={{ fontWeight: 600, color: '#dc2626', margin: 0 }}>&#9888; Payment Failed</p>
              <p style={{ color: '#991b1b', fontSize: 13, margin: '4px 0 0' }}>
                Your last payment failed. Please update your payment method to keep your subscription active.
              </p>
            </div>
          )}

          {(() => {
            const activePlan = currentPlanDetails;
            return activePlan ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Current Plan Info */}
                <div className="border border-blue-200 bg-blue-50 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-blue-800">{getPlanDisplayName(activePlan)} Plan</h3>
                    <span className="text-sm font-semibold bg-blue-200 text-blue-800 px-3 py-1 rounded-full">
                      {formatPlanPriceLabel(activePlan)}
                    </span>
                  </div>
                  {activePlan.description && <p className="text-sm text-blue-700 mb-3">{activePlan.description}</p>}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white rounded p-3">
                      <div className="text-gray-500">Max Users</div>
                      <div className="font-bold text-gray-900">{activePlan.features?.maxUsers}</div>
                    </div>
                    <div className="bg-white rounded p-3">
                      <div className="text-gray-500">Max Branches</div>
                      <div className="font-bold text-gray-900">{activePlan.features?.maxBranches}</div>
                    </div>
                    <div className="bg-white rounded p-3">
                      <div className="text-gray-500">Max Products</div>
                      <div className="font-bold text-gray-900">{activePlan.features?.maxProducts?.toLocaleString()}</div>
                    </div>
                    <div className="bg-white rounded p-3">
                      <div className="text-gray-500">Invoices/Month</div>
                      <div className="font-bold text-gray-900">{activePlan.features?.maxInvoicesPerMonth?.toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                {/* Usage Meters */}
                <div className="border border-gray-200 rounded-lg p-5">
                  <h3 className="text-lg font-bold text-gray-800 mb-3">Current Usage</h3>
                  {[
                    { label: 'Users', used: dashboardData?.usage?.activeUsers || 1, limit: activePlan.features?.maxUsers },
                    { label: 'Invoices', used: dashboardData?.usage?.invoiceCount || 0, limit: activePlan.features?.maxInvoicesPerMonth },
                    { label: 'API Calls', used: dashboardData?.usage?.apiCallsThisMonth || 0, limit: activePlan.features?.maxProducts * 10 },
                  ].map(meter => {
                    const pct = meter.limit ? Math.min(Math.round((meter.used / meter.limit) * 100), 100) : 0;
                    const barColor = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#22c55e';
                    return (
                      <div key={meter.label} className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">{meter.label}</span>
                          <span className="font-medium">{meter.used} / {meter.limit}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <p className="text-lg font-semibold">{currentPlanName} Plan</p>
                <p className="text-sm mt-1">Plan details loading...</p>
              </div>
            );
          })()}
        </div>
      </main>

      {/* View Plans Modal */}
      {showUpgradeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowUpgradeModal(false)}>
          <div style={{ background: 'white', borderRadius: '12px', maxWidth: '900px', width: '90%', maxHeight: '85vh', overflow: 'auto', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Choose Your Plan</h2>
              <button onClick={() => setShowUpgradeModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            {hasActivePaidSubscription && !isCanceling && (
              <div style={{ background: '#fef3c7', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#92400e' }}>
                <strong>&#9888; You have an active paid subscription.</strong> Cancel your current subscription first before subscribing to a new plan.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map(plan => {
                const isCurrent = plan.slug === currentPlanSlug;
                const isPaid = plan.price > 0;
                const currentIdx = plans.findIndex(p => p.slug === currentPlanSlug);
                const planIdx = plans.indexOf(plan);
                const isUpgrade = planIdx > currentIdx;
                const blocked = isPaid && hasActivePaidSubscription && !isCanceling && !isCurrent;

                return (
                  <div key={plan._id}
                    style={{
                      border: isCurrent ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      borderRadius: '12px', padding: '20px', position: 'relative',
                      background: isCurrent ? '#eff6ff' : 'white',
                      opacity: blocked ? 0.6 : 1,
                    }}>
                    {isCurrent && (
                      <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#2563eb', color: 'white', fontSize: '11px', fontWeight: 700, padding: '2px 12px', borderRadius: '10px' }}>
                        Current
                      </div>
                    )}
                    <h3 className="text-lg font-bold text-gray-900 mt-1">{getPlanDisplayName(plan)}</h3>
                    <div className="mt-2">
                      <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                      {plan.price > 0 && (
                        <span className="text-sm text-gray-500">
                          {plan.paymentType === 'subscription'
                            ? `/${plan.cycleType === 'custom' ? `${plan.customDays || 0}d` : plan.cycleType === 'yearly' ? 'yr' : 'mo'}`
                            : ' one-time'}
                        </span>
                      )}
                    </div>
                    {plan.description && <p className="text-sm text-gray-500 mt-2">{plan.description}</p>}
                    <ul className="mt-4 space-y-2 text-sm text-gray-600">
                      <li>&#10003; {plan.features?.maxUsers} Users</li>
                      <li>&#10003; {plan.features?.maxBranches} Branches</li>
                      <li>&#10003; {plan.features?.maxProducts?.toLocaleString()} Products</li>
                      <li>&#10003; {plan.features?.maxInvoicesPerMonth?.toLocaleString()} Invoices/mo</li>
                    </ul>
                    <div className="mt-4">
                      {isCurrent ? (
                        <button disabled className="w-full py-2 rounded-lg text-sm font-semibold bg-gray-200 text-gray-500 cursor-not-allowed">
                          Current Plan
                        </button>
                      ) : blocked ? (
                        <button disabled className="w-full py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200">
                          Cancel Current First
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePlanAction(plan.slug)}
                          className={`w-full py-2 rounded-lg text-sm font-semibold transition ${
                            isPaid
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : isUpgrade
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                          }`}
                        >
                          {isPaid ? 'Subscribe' : isUpgrade ? 'Switch' : 'Switch'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Subscription Confirmation Modal */}
      {showCancelConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
          onClick={() => setShowCancelConfirm(false)}>
          <div style={{ background: 'white', borderRadius: 12, maxWidth: 440, width: '90%', padding: 28 }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: '#fee2e2',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, marginBottom: 12,
              }}>&#9888;</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Cancel Subscription?</h3>
            </div>
            <p style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', margin: '0 0 8px' }}>
              Your subscription will remain active until the end of your current billing period
              {subscription?.subscription?.currentPeriodEnd && (
                <> (<strong>{new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString()}</strong>)</>
              )}.
            </p>
            <p style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', margin: '0 0 24px' }}>
              After that, you'll be switched to a free plan. You can subscribe again anytime.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => setShowCancelConfirm(false)}
                style={{
                  background: 'white', color: '#374151', border: '1px solid #d1d5db',
                  padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14,
                }}
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={canceling}
                style={{
                  background: '#dc2626', color: 'white', border: 'none',
                  padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
                  fontWeight: 600, fontSize: 14, opacity: canceling ? 0.7 : 1,
                }}
              >
                {canceling ? 'Canceling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



