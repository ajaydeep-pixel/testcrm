/**
 * Superadmin Dashboard Component
 * Platform admin panel for managing all tenants, users, payments, and activity
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { useToast } from './Toast';
import styles from './SuperadminDashboard.module.css';

const SuperadminDashboard = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active tab from URL path
  const getTabFromPath = () => {
    const path = location.pathname.replace('/admin', '').replace(/^\//, '');
    const validTabs = ['dashboard', 'tenants', 'invoices', 'payments', 'activity', 'plans', 'settings'];
    return validTabs.includes(path) ? path : 'dashboard';
  };
  const activeTab = getTabFromPath();

  const [metrics, setMetrics] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [payments, setPayments] = useState(null);
  const [platformSettings, setPlatformSettings] = useState(null);
  const [settingsForm, setSettingsForm] = useState(null);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTenantId, setCurrentTenantId] = useState(null);
  const [tenantDetails, setTenantDetails] = useState(null);
  const [editingTenant, setEditingTenant] = useState(false);
  const [tenantForm, setTenantForm] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [confirmModal, setConfirmModal] = useState(null);
  const [passwordModal, setPasswordModal] = useState(null);
  const [pwdForm, setPwdForm] = useState({ password: '', confirmPassword: '' });
  const [plans, setPlans] = useState([]);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({ name: '', slug: '', price: 0, billingCycle: 'monthly', description: '', isActive: true, sortOrder: 0, maxUsers: 1, maxBranches: 1, maxProducts: 100, maxInvoicesPerMonth: 50 });
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [tenantDetailTab, setTenantDetailTab] = useState('overview');

  // Fetch dashboard metrics
  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/admin/dashboard');
      setMetrics(response.metrics);
    } catch (err) {
      console.error('Error fetching metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all tenants
  const fetchTenants = async (page = 1) => {
    try {
      setLoading(true);
      const response = await apiService.get('/admin/tenants', {
        page,
        limit: pagination.limit,
      });
      setTenants(response.tenants || []);
      setPagination(response.pagination);
    } catch (err) {
      console.error('Error fetching tenants:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all invoices
  const fetchInvoices = async (page = 1) => {
    try {
      setLoading(true);
      const response = await apiService.get('/admin/invoices', {
        page,
        limit: pagination.limit,
      });
      setInvoices(response.invoices || []);
      setPagination(response.pagination);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch activity logs
  const fetchActivityLogs = async (page = 1) => {
    try {
      setLoading(true);
      const response = await apiService.get('/admin/activity', {
        page,
        limit: pagination.limit,
      });
      setActivityLogs(response.logs || []);
      setPagination(response.pagination);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch payments summary
  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/admin/payments');
      setPayments(response);
    } catch (err) {
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch platform settings
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/admin/settings');
      setPlatformSettings(response.settings);
      setSettingsForm({
        appName: response.settings?.branding?.appName || '',
        tagline: response.settings?.branding?.tagline || '',
        logoUrl: response.settings?.branding?.logoUrl || '',
        primaryColor: response.settings?.branding?.primaryColor || '#2563eb',
        supportEmail: response.settings?.contact?.supportEmail || '',
        supportPhone: response.settings?.contact?.supportPhone || '',
        website: response.settings?.contact?.website || '',
      });
      setSettingsSaved(false);
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  };

  // Save platform settings
  const saveSettings = async () => {
    try {
      setLoading(true);
      await apiService.put('/admin/settings', {
        branding: {
          appName: settingsForm.appName,
          tagline: settingsForm.tagline,
          logoUrl: settingsForm.logoUrl,
          primaryColor: settingsForm.primaryColor,
        },
        contact: {
          supportEmail: settingsForm.supportEmail,
          supportPhone: settingsForm.supportPhone,
          website: settingsForm.website,
        },
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err) {
      toast.error('Error saving settings');
    } finally {
      setLoading(false);
    }
  };

  // Fetch plans
  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/admin/plans');
      setPlans(response.plans || []);
    } catch (err) {
      console.error('Error fetching plans:', err);
    } finally {
      setLoading(false);
    }
  };

  // Open plan form for create/edit
  const openPlanForm = (plan = null) => {
    if (plan) {
      setEditingPlan(plan._id);
      setPlanForm({
        name: plan.name, slug: plan.slug, price: plan.price,
        billingCycle: plan.billingCycle, description: plan.description || '',
        isActive: plan.isActive, sortOrder: plan.sortOrder || 0,
        maxUsers: plan.features?.maxUsers || 1,
        maxBranches: plan.features?.maxBranches || 1,
        maxProducts: plan.features?.maxProducts || 100,
        maxInvoicesPerMonth: plan.features?.maxInvoicesPerMonth || 50,
      });
    } else {
      setEditingPlan(null);
      setPlanForm({ name: '', slug: '', price: 0, billingCycle: 'monthly', description: '', isActive: true, sortOrder: 0, maxUsers: 1, maxBranches: 1, maxProducts: 100, maxInvoicesPerMonth: 50 });
    }
    setShowPlanForm(true);
  };

  // Save plan (create or update)
  const savePlan = async () => {
    if (!planForm.name || !planForm.slug) {
      toast.error('Name and slug are required');
      return;
    }
    try {
      const payload = {
        name: planForm.name, slug: planForm.slug, price: Number(planForm.price),
        billingCycle: planForm.billingCycle, description: planForm.description,
        isActive: planForm.isActive, sortOrder: Number(planForm.sortOrder),
        features: {
          maxUsers: Number(planForm.maxUsers),
          maxBranches: Number(planForm.maxBranches),
          maxProducts: Number(planForm.maxProducts),
          maxInvoicesPerMonth: Number(planForm.maxInvoicesPerMonth),
        },
      };
      if (editingPlan) {
        await apiService.put(`/admin/plans/${editingPlan}`, payload);
        toast.success('Plan updated successfully');
      } else {
        await apiService.post('/admin/plans', payload);
        toast.success('Plan created successfully');
      }
      setShowPlanForm(false);
      fetchPlans();
    } catch (err) {
      toast.error(err?.message || 'Error saving plan');
    }
  };

  // Delete plan with confirmation
  const confirmDeletePlan = (plan) => {
    setConfirmModal({
      title: 'Delete Plan',
      message: `Are you sure you want to delete the "${plan.name}" plan? This cannot be undone.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await apiService.delete(`/admin/plans/${plan._id}`);
          setConfirmModal(null);
          toast.success('Plan deleted');
          fetchPlans();
        } catch (err) {
          setConfirmModal(null);
          toast.error(err?.message || 'Cannot delete plan');
        }
      },
    });
  };

  // Fetch tenant details
  const fetchTenantDetails = async (tenantId) => {
    try {
      setCurrentTenantId(tenantId);
      const response = await apiService.get(`/admin/tenants/${tenantId}`);
      setTenantDetails(response);
    } catch (err) {
      console.error('Error fetching tenant details:', err);
    }
  };

  // Update tenant status
  const updateTenantStatus = async (tenantId, newStatus) => {
    try {
      await apiService.patch(`/admin/tenants/${tenantId}/status`, {
        status: newStatus,
      });
      fetchTenants(pagination.page);
      setConfirmModal(null);
    } catch (err) {
      toast.error('Error updating tenant status');
    }
  };

  // Show confirmation before status change
  const confirmStatusChange = (tenantId, tenantName, newStatus) => {
    setConfirmModal({
      title: newStatus === 'suspended' ? 'Suspend Tenant' : 'Activate Tenant',
      message: newStatus === 'suspended'
        ? `Are you sure you want to suspend "${tenantName}"? All users under this tenant will lose access immediately.`
        : `Are you sure you want to activate "${tenantName}"? Users will regain access.`,
      type: newStatus === 'suspended' ? 'danger' : 'success',
      onConfirm: () => updateTenantStatus(tenantId, newStatus),
    });
  };

  // Start editing tenant
  const startEditTenant = () => {
    const t = tenantDetails.tenant;
    if (plans.length === 0) fetchPlans();
    setTenantForm({
      name: t.name || '',
      email: t.email || '',
      plan: t.plan || 'trial',
      status: t.status || 'active',
      timezone: t.settings?.timezone || 'UTC',
      currency: t.settings?.currency || 'USD',
      gst_enabled: t.settings?.gst_enabled || false,
      gst_number: t.settings?.gst_number || '',
    });
    setEditingTenant(true);
  };

  // Save tenant edits
  const saveTenant = async () => {
    try {
      await apiService.put(`/admin/tenants/${currentTenantId}`, {
        name: tenantForm.name,
        email: tenantForm.email,
        plan: tenantForm.plan,
        status: tenantForm.status,
        settings: {
          timezone: tenantForm.timezone,
          currency: tenantForm.currency,
          gst_enabled: tenantForm.gst_enabled,
          gst_number: tenantForm.gst_number,
        },
      });
      setEditingTenant(false);
      fetchTenantDetails(currentTenantId);
      toast.success('Tenant updated successfully');
    } catch (err) {
      toast.error('Error updating tenant');
    }
  };

  // Update user status (refreshes tenant detail view)
  const updateUserStatus = async (userId, newStatus) => {
    try {
      await apiService.patch(`/admin/users/${userId}/status`, {
        status: newStatus,
      });
      if (currentTenantId) fetchTenantDetails(currentTenantId);
      setConfirmModal(null);
      toast.success('User status updated');
    } catch (err) {
      toast.error('Error updating user status');
    }
  };

  // Show confirmation before user lock/unlock
  const confirmUserStatusChange = (userId, userName, newStatus) => {
    setConfirmModal({
      title: newStatus === 'locked' ? 'Lock User' : 'Unlock User',
      message: newStatus === 'locked'
        ? `Are you sure you want to lock "${userName}"? This user will not be able to log in.`
        : `Are you sure you want to unlock "${userName}"? This user will regain login access.`,
      type: newStatus === 'locked' ? 'danger' : 'success',
      onConfirm: () => updateUserStatus(userId, newStatus),
    });
  };

  // Login as user
  const loginAsUser = async (userId) => {
    try {
      const response = await apiService.post(`/admin/users/${userId}/login-as`, {});
      // Save current superadmin token for returning later
      const currentToken = localStorage.getItem('token');
      const currentUser = localStorage.getItem('user');
      localStorage.setItem('superadmin_token', currentToken);
      localStorage.setItem('superadmin_user', currentUser);
      // Set user token
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      window.location.href = '/dashboard';
    } catch (err) {
      toast.error('Error logging in as user');
    }
  };

  // Reset user password
  const openPasswordModal = (userId, userName) => {
    setPwdForm({ password: '', confirmPassword: '' });
    setPasswordModal({ userId, userName });
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 12; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    setPwdForm({ password: pwd, confirmPassword: pwd });
  };

  const submitPasswordReset = async () => {
    if (!pwdForm.password) { toast.warning('Please enter a password'); return; }
    if (pwdForm.password.length < 6) { toast.warning('Password must be at least 6 characters'); return; }
    if (pwdForm.password !== pwdForm.confirmPassword) { toast.warning('Passwords do not match'); return; }
    try {
      await apiService.patch(`/admin/users/${passwordModal.userId}/password`, { newPassword: pwdForm.password });
      toast.success('Password updated successfully');
      setPasswordModal(null);
    } catch (err) {
      toast.error('Error resetting password');
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('superadmin_token');
    localStorage.removeItem('superadmin_user');
    window.location.href = '/login';
  };

  // Handle tab change
  const handleTabChange = (tab) => {
    navigate(`/admin/${tab === 'dashboard' ? '' : tab}`);
    setPagination({ page: 1, limit: 10 });
  };

  // Fetch data when tab changes (derived from URL)
  useEffect(() => {
    if (activeTab === 'dashboard') fetchMetrics();
    else if (activeTab === 'tenants') fetchTenants(1);
    else if (activeTab === 'invoices') fetchInvoices(1);
    else if (activeTab === 'activity') fetchActivityLogs(1);
    else if (activeTab === 'payments') fetchPayments();
    else if (activeTab === 'settings') fetchSettings();
    else if (activeTab === 'plans') fetchPlans();
  }, [activeTab]);

  return (
    <div className={styles.superadminDashboard}>
      <header className={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>🛡️ Platform Admin Dashboard</h1>
            <p>Manage all tenants, users, payments, and system activity</p>
          </div>
          <button onClick={handleLogout} className={styles.btnSmallDanger} style={{ padding: '10px 20px', fontSize: '14px' }}>
            Logout
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'dashboard' ? styles.active : ''}`}
          onClick={() => handleTabChange('dashboard')}
        >
          📊 Dashboard
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'tenants' ? styles.active : ''}`}
          onClick={() => handleTabChange('tenants')}
        >
          🏢 Tenants
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'invoices' ? styles.active : ''}`}
          onClick={() => handleTabChange('invoices')}
        >
          💰 Invoices
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'payments' ? styles.active : ''}`}
          onClick={() => handleTabChange('payments')}
        >
          💳 Payments
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'activity' ? styles.active : ''}`}
          onClick={() => handleTabChange('activity')}
        >
          📋 Activity
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'plans' ? styles.active : ''}`}
          onClick={() => handleTabChange('plans')}
        >
          📦 Plans
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'settings' ? styles.active : ''}`}
          onClick={() => handleTabChange('settings')}
        >
          ⚙️ Settings
        </button>
      </nav>

      {/* Content */}
      <main className={styles.content}>
        {loading && <div className={styles.loader}>Loading...</div>}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && metrics && !loading && (
          <section className={styles.dashboardSection}>
            <h2>System Metrics</h2>
            <div className={styles.metricsGrid}>
              <div className={styles.metric}>
                <h3>Total Tenants</h3>
                <p className={styles.metricValue}>{metrics.totalTenants}</p>
                <small>Active: {metrics.activeTenants}</small>
              </div>
              <div className={styles.metric}>
                <h3>Total Users</h3>
                <p className={styles.metricValue}>{metrics.totalUsers}</p>
              </div>
              <div className={styles.metric}>
                <h3>Total Invoices</h3>
                <p className={styles.metricValue}>{metrics.totalInvoices}</p>
              </div>
              <div className={styles.metric}>
                <h3>Total Revenue</h3>
                <p className={styles.metricValue}>${metrics.totalRevenue.toFixed(2)}</p>
              </div>
            </div>

            <h2 style={{ marginTop: '30px' }}>Tenants by Plan</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {metrics.tenantsByPlan?.map((plan) => (
                  <tr key={plan._id}>
                    <td>{plan._id || 'None'}</td>
                    <td>{plan.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Tenants Tab */}
        {activeTab === 'tenants' && !loading && (
          <section className={styles.tableSection}>
            <h2>All Tenants</h2>
            {currentTenantId && tenantDetails ? (
              <div className={styles.detailsPanel}>
                {/* Header: Back arrow + Tenant name + Edit button */}
                <div className={styles.tdHeader}>
                  <button
                    className={styles.tdBackBtn}
                    onClick={() => {
                      setCurrentTenantId(null);
                      setTenantDetails(null);
                      setEditingTenant(false);
                      setTenantDetailTab('overview');
                    }}
                  >
                    ←
                  </button>
                  <h2 className={styles.tdName}>{tenantDetails.tenant.name}</h2>
                  {!editingTenant && (
                    <button className={styles.btnSmall} onClick={startEditTenant} style={{ marginLeft: 'auto' }}>
                      ✏️ Edit Tenant
                    </button>
                  )}
                </div>

                {/* Tab Navigation */}
                <div className={styles.tdTabs}>
                  {['overview', 'team', 'invoices', 'settings'].map(tab => (
                    <button
                      key={tab}
                      className={`${styles.tdTab} ${tenantDetailTab === tab ? styles.tdTabActive : ''}`}
                      onClick={() => setTenantDetailTab(tab)}
                    >
                      {tab === 'overview' ? 'Overview' : tab === 'team' ? 'Team Members' : tab === 'invoices' ? 'Invoices' : 'Settings'}
                    </button>
                  ))}
                </div>

                {/* Main layout: content + sidebar */}
                <div className={styles.tdLayout}>
                  {/* Left: Tab Content */}
                  <div className={styles.tdMain}>

                    {/* Overview Tab */}
                    {tenantDetailTab === 'overview' && (
                      <div className={styles.tdCard}>
                        <h3 className={styles.tdCardTitle}>Subscription & Plan</h3>
                        <div className={styles.tdInfoGrid}>
                          <div className={styles.tdInfoItem}>
                            <span className={styles.tdInfoLabel}>Current Plan</span>
                            <span className={styles.tdInfoValue} style={{ textTransform: 'capitalize' }}>{tenantDetails.tenant.plan}</span>
                          </div>
                          <div className={styles.tdInfoItem}>
                            <span className={styles.tdInfoLabel}>Trial Days Remaining</span>
                            <span className={styles.tdInfoValue}>{tenantDetails.tenant.trialDaysRemaining ?? 'N/A'}</span>
                          </div>
                          <div className={styles.tdInfoItem}>
                            <span className={styles.tdInfoLabel}>Subscription Status</span>
                            <span className={styles.tdInfoValue} style={{ textTransform: 'capitalize' }}>{tenantDetails.tenant.subscription?.status || 'None'}</span>
                          </div>
                          <div className={styles.tdInfoItem}>
                            <span className={styles.tdInfoLabel}>Billing Period End</span>
                            <span className={styles.tdInfoValue}>
                              {tenantDetails.tenant.subscription?.currentPeriodEnd
                                ? new Date(tenantDetails.tenant.subscription.currentPeriodEnd).toLocaleDateString()
                                : 'N/A'}
                            </span>
                          </div>
                        </div>

                        <h3 className={styles.tdCardTitle} style={{ marginTop: 24 }}>Usage</h3>
                        <div className={styles.tdInfoGrid}>
                          <div className={styles.tdInfoItem}>
                            <span className={styles.tdInfoLabel}>Active Users</span>
                            <span className={styles.tdInfoValue}>{tenantDetails.tenant.usage?.activeUsers || 0}</span>
                          </div>
                          <div className={styles.tdInfoItem}>
                            <span className={styles.tdInfoLabel}>Total Invoices</span>
                            <span className={styles.tdInfoValue}>{tenantDetails.tenant.usage?.invoiceCount || 0}</span>
                          </div>
                          <div className={styles.tdInfoItem}>
                            <span className={styles.tdInfoLabel}>API Calls (This Month)</span>
                            <span className={styles.tdInfoValue}>{tenantDetails.tenant.usage?.apiCallsThisMonth || 0}</span>
                          </div>
                          <div className={styles.tdInfoItem}>
                            <span className={styles.tdInfoLabel}>Storage</span>
                            <span className={styles.tdInfoValue}>{tenantDetails.tenant.usage?.storageMB || 0} MB</span>
                          </div>
                        </div>

                        {tenantDetails.tenant.branches?.length > 0 && (
                          <>
                            <h3 className={styles.tdCardTitle} style={{ marginTop: 24 }}>Branches</h3>
                            <div className={styles.tdInfoGrid}>
                              {tenantDetails.tenant.branches.map((b, i) => (
                                <div className={styles.tdInfoItem} key={i}>
                                  <span className={styles.tdInfoLabel}>{b.name || `Branch ${i + 1}`}</span>
                                  <span className={styles.tdInfoValue}>{[b.city, b.state].filter(Boolean).join(', ') || 'No address'}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Team Members Tab */}
                    {tenantDetailTab === 'team' && (
                      <div className={styles.tdCard}>
                        <h3 className={styles.tdCardTitle}>Team Members ({tenantDetails.users?.length || 0})</h3>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Email</th>
                              <th>Role</th>
                              <th>Status</th>
                              <th>Last Login</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tenantDetails.users?.length > 0 ? tenantDetails.users.map((user) => (
                              <tr key={user._id}>
                                <td>{user.name}</td>
                                <td>{user.email}</td>
                                <td style={{ textTransform: 'capitalize' }}>{user.role}</td>
                                <td>
                                  <span className={`${styles.tdBadge} ${user.status === 'active' ? styles.tdBadgeGreen : styles.tdBadgeRed}`}>
                                    {user.status}
                                  </span>
                                </td>
                                <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}</td>
                                <td className={styles.actions}>
                                  <button className={styles.btnSmall} onClick={() => loginAsUser(user._id)}>Login As</button>
                                  <button className={styles.btnSmall} onClick={() => openPasswordModal(user._id, user.name)} style={{ background: '#f59e0b' }}>Reset Pwd</button>
                                  {user.status === 'active' && (
                                    <button className={styles.btnSmallDanger} onClick={() => confirmUserStatusChange(user._id, user.name, 'locked')}>Lock</button>
                                  )}
                                  {user.status === 'locked' && (
                                    <button className={styles.btnSmallSuccess} onClick={() => confirmUserStatusChange(user._id, user.name, 'active')}>Unlock</button>
                                  )}
                                </td>
                              </tr>
                            )) : (
                              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>No team members found</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Invoices Tab */}
                    {tenantDetailTab === 'invoices' && (
                      <div className={styles.tdCard}>
                        <h3 className={styles.tdCardTitle}>Invoices ({tenantDetails.invoices?.length || 0})</h3>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Invoice #</th>
                              <th>Amount</th>
                              <th>Status</th>
                              <th>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tenantDetails.invoices?.length > 0 ? tenantDetails.invoices.map((inv) => (
                              <tr key={inv._id}>
                                <td>{inv.invoiceNumber}</td>
                                <td>${(inv.amount / 100).toFixed(2)}</td>
                                <td>
                                  <span className={`${styles.tdBadge} ${inv.status === 'paid' ? styles.tdBadgeGreen : inv.status === 'overdue' ? styles.tdBadgeRed : styles.tdBadgeYellow}`}>
                                    {inv.status}
                                  </span>
                                </td>
                                <td>{new Date(inv.createdAt).toLocaleDateString()}</td>
                              </tr>
                            )) : (
                              <tr><td colSpan={4} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>There are no records to display</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Settings Tab (Edit) */}
                    {tenantDetailTab === 'settings' && (
                      <div className={styles.tdCard}>
                        <h3 className={styles.tdCardTitle}>Tenant Settings</h3>
                        {editingTenant && tenantForm ? (
                          <>
                            <div className={styles.settingsGrid}>
                              <div className={styles.formGroup}>
                                <label>Company Name</label>
                                <input type="text" value={tenantForm.name} onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })} />
                              </div>
                              <div className={styles.formGroup}>
                                <label>Email</label>
                                <input type="email" value={tenantForm.email} onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })} />
                              </div>
                              <div className={styles.formGroup}>
                                <label>Plan</label>
                                <select value={tenantForm.plan} onChange={(e) => setTenantForm({ ...tenantForm, plan: e.target.value })} style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
                                  {plans.length > 0 ? plans.map(p => <option key={p._id} value={p.slug}>{p.name}</option>) : (
                                    <>
                                      <option value="trial">Trial</option>
                                      <option value="basic">Basic</option>
                                      <option value="pro">Pro</option>
                                      <option value="enterprise">Enterprise</option>
                                    </>
                                  )}
                                </select>
                              </div>
                              <div className={styles.formGroup}>
                                <label>Timezone</label>
                                <select value={tenantForm.timezone} onChange={(e) => setTenantForm({ ...tenantForm, timezone: e.target.value })} style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
                                  {['UTC', 'EST', 'CST', 'MST', 'PST', 'IST', 'CET', 'AEST'].map(tz => <option key={tz} value={tz}>{tz}</option>)}
                                </select>
                              </div>
                              <div className={styles.formGroup}>
                                <label>Currency</label>
                                <select value={tenantForm.currency} onChange={(e) => setTenantForm({ ...tenantForm, currency: e.target.value })} style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
                                  {['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </div>
                              <div className={styles.formGroup}>
                                <label>GST Enabled</label>
                                <select value={tenantForm.gst_enabled ? 'yes' : 'no'} onChange={(e) => setTenantForm({ ...tenantForm, gst_enabled: e.target.value === 'yes' })} style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
                                  <option value="no">No</option>
                                  <option value="yes">Yes</option>
                                </select>
                              </div>
                              {tenantForm.gst_enabled && (
                                <div className={styles.formGroup}>
                                  <label>GST Number</label>
                                  <input type="text" value={tenantForm.gst_number} onChange={(e) => setTenantForm({ ...tenantForm, gst_number: e.target.value })} />
                                </div>
                              )}
                            </div>
                            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                              <button className={styles.btnSmallSuccess} style={{ padding: '8px 20px' }} onClick={saveTenant}>Save Changes</button>
                              <button className={styles.btnSmallDanger} style={{ padding: '8px 20px' }} onClick={() => setEditingTenant(false)}>Cancel</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className={styles.tdInfoGrid}>
                              <div className={styles.tdInfoItem}>
                                <span className={styles.tdInfoLabel}>Timezone</span>
                                <span className={styles.tdInfoValue}>{tenantDetails.tenant.settings?.timezone || 'UTC'}</span>
                              </div>
                              <div className={styles.tdInfoItem}>
                                <span className={styles.tdInfoLabel}>Currency</span>
                                <span className={styles.tdInfoValue}>{tenantDetails.tenant.settings?.currency || 'USD'}</span>
                              </div>
                              <div className={styles.tdInfoItem}>
                                <span className={styles.tdInfoLabel}>GST</span>
                                <span className={styles.tdInfoValue}>{tenantDetails.tenant.settings?.gst_enabled ? `Enabled (${tenantDetails.tenant.settings?.gst_number || 'N/A'})` : 'Disabled'}</span>
                              </div>
                              <div className={styles.tdInfoItem}>
                                <span className={styles.tdInfoLabel}>VAT</span>
                                <span className={styles.tdInfoValue}>{tenantDetails.tenant.settings?.vat_enabled ? `Enabled (${tenantDetails.tenant.settings?.vat_number || 'N/A'})` : 'Disabled'}</span>
                              </div>
                            </div>
                            <button className={styles.btnSmall} onClick={startEditTenant} style={{ marginTop: 16 }}>✏️ Edit Settings</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Sidebar */}
                  <div className={styles.tdSidebar}>
                    {/* Key Metrics */}
                    <div className={styles.tdSideCard}>
                      <h3 className={styles.tdSideTitle}>Key Metrics</h3>
                      <div className={styles.tdMetricsRow}>
                        <div className={styles.tdMetricBox}>
                          <div className={styles.tdMetricIcon} style={{ background: '#eff6ff', color: '#2563eb' }}>📊</div>
                          <div className={styles.tdMetricLabel}>Invoices</div>
                          <div className={styles.tdMetricVal}>{tenantDetails.tenant.usage?.invoiceCount || 0}</div>
                        </div>
                        <div className={styles.tdMetricBox}>
                          <div className={styles.tdMetricIcon} style={{ background: '#f0fdf4', color: '#16a34a' }}>👥</div>
                          <div className={styles.tdMetricLabel}>Users</div>
                          <div className={styles.tdMetricVal}>{tenantDetails.tenant.usage?.activeUsers || 0}</div>
                        </div>
                        <div className={styles.tdMetricBox}>
                          <div className={styles.tdMetricIcon} style={{ background: '#fef3c7', color: '#d97706' }}>📦</div>
                          <div className={styles.tdMetricLabel}>Storage</div>
                          <div className={styles.tdMetricVal}>{tenantDetails.tenant.usage?.storageMB || 0} MB</div>
                        </div>
                      </div>
                    </div>

                    {/* Tenant Details */}
                    <div className={styles.tdSideCard}>
                      <h3 className={styles.tdSideTitle}>Tenant Details</h3>

                      <div className={styles.tdSideSection}>
                        <div className={styles.tdSideSectionTitle}>📧 Contact</div>
                        <div className={styles.tdSideRow}>
                          <span className={styles.tdSideLabel}>Email</span>
                          <span className={styles.tdSideValue}>{tenantDetails.tenant.email}</span>
                        </div>
                      </div>

                      <div className={styles.tdSideDivider} />

                      <div className={styles.tdSideSection}>
                        <div className={styles.tdSideSectionTitle}>🏢 Account</div>
                        <div className={styles.tdSideRow}>
                          <span className={styles.tdSideLabel}>Status</span>
                          <span className={`${styles.tdBadge} ${tenantDetails.tenant.status === 'active' ? styles.tdBadgeGreen : tenantDetails.tenant.status === 'suspended' ? styles.tdBadgeRed : styles.tdBadgeYellow}`}>
                            {tenantDetails.tenant.status}
                          </span>
                        </div>
                        <div className={styles.tdSideRow}>
                          <span className={styles.tdSideLabel}>Plan</span>
                          <span className={styles.tdSideValue} style={{ textTransform: 'capitalize' }}>{tenantDetails.tenant.plan}</span>
                        </div>
                        <div className={styles.tdSideRow}>
                          <span className={styles.tdSideLabel}>Tenant ID</span>
                          <span className={styles.tdSideValue} style={{ fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all' }}>{tenantDetails.tenant._id}</span>
                        </div>
                        <div className={styles.tdSideRow}>
                          <span className={styles.tdSideLabel}>Created</span>
                          <span className={styles.tdSideValue}>{new Date(tenantDetails.tenant.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className={styles.tdSideDivider} />
                      <div className={styles.tdSideSection}>
                        <div className={styles.tdSideSectionTitle}>⚡ Quick Actions</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                          {tenantDetails.tenant.status === 'active' && (
                            <button className={styles.btnSmallDanger} style={{ width: '100%', padding: '8px 12px' }} onClick={() => confirmStatusChange(currentTenantId, tenantDetails.tenant.name, 'suspended')}>
                              Suspend Tenant
                            </button>
                          )}
                          {tenantDetails.tenant.status === 'suspended' && (
                            <button className={styles.btnSmallSuccess} style={{ width: '100%', padding: '8px 12px' }} onClick={() => confirmStatusChange(currentTenantId, tenantDetails.tenant.name, 'active')}>
                              Activate Tenant
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Company Name</th>
                    <th>Email</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Trial End</th>
                    <th>Users</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants?.map((tenant) => (
                    <tr key={tenant._id}>
                      <td>{tenant.name}</td>
                      <td>{tenant.email}</td>
                      <td>{tenant.plan}</td>
                      <td>{tenant.status}</td>
                      <td>{new Date(tenant.trialEndAt).toLocaleDateString()}</td>
                      <td>{tenant.usage?.activeUsers || 0}</td>
                      <td className={styles.actions}>
                        <button
                          className={styles.btnSmall}
                          onClick={() => fetchTenantDetails(tenant._id)}
                        >
                          View
                        </button>
                        {tenant.status === 'active' && (
                          <button
                            className={styles.btnSmallDanger}
                            onClick={() => confirmStatusChange(tenant._id, tenant.name, 'suspended')}
                          >
                            Suspend
                          </button>
                        )}
                        {tenant.status === 'suspended' && (
                          <button
                            className={styles.btnSmallSuccess}
                            onClick={() => confirmStatusChange(tenant._id, tenant.name, 'active')}
                          >
                            Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className={styles.pagination}>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    className={`${styles.pageBtn} ${pagination.page === page ? styles.active : ''}`}
                    onClick={() => fetchTenants(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Invoices Tab */}
        {activeTab === 'invoices' && !loading && (
          <section className={styles.tableSection}>
            <h2>All Invoices</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Tenant</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices?.map((invoice) => (
                  <tr key={invoice._id}>
                    <td>{invoice.invoiceNumber}</td>
                    <td>{invoice.tenantId?.name || 'N/A'}</td>
                    <td>${(invoice.amount / 100).toFixed(2)}</td>
                    <td>{invoice.status}</td>
                    <td>{new Date(invoice.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pagination.totalPages > 1 && (
              <div className={styles.pagination}>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    className={`${styles.pageBtn} ${pagination.page === page ? styles.active : ''}`}
                    onClick={() => fetchInvoices(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && payments && !loading && (
          <section className={styles.tableSection}>
            <h2>Payment Summary</h2>
            <h3>By Status</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Count</th>
                  <th>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.invoices?.map((inv) => (
                  <tr key={inv._id}>
                    <td>{inv._id}</td>
                    <td>{inv.count}</td>
                    <td>${(inv.total / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 style={{ marginTop: '30px' }}>Active Subscriptions by Plan</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Total Tenants</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {payments.byPlan?.map((plan) => (
                  <tr key={plan._id}>
                    <td>{plan._id}</td>
                    <td>{plan.count}</td>
                    <td>{plan.activeCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && !loading && (
          <section className={styles.tableSection}>
            <h2>System Activity</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Tenant</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activityLogs?.map((log) => (
                  <tr key={log._id}>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>{log.userId?.name || 'System'}</td>
                    <td>{log.tenantId?.name || 'Platform'}</td>
                    <td>{log.action}</td>
                    <td>{log.resource}</td>
                    <td>{log.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pagination.totalPages > 1 && (
              <div className={styles.pagination}>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    className={`${styles.pageBtn} ${pagination.page === page ? styles.active : ''}`}
                    onClick={() => fetchActivityLogs(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Plans Tab */}
        {activeTab === 'plans' && !loading && (
          <section className={styles.tableSection}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2>Subscription Plans</h2>
              <button className={styles.btnSmall} style={{ padding: '10px 20px' }} onClick={() => openPlanForm()}>+ Add Plan</button>
            </div>

            {showPlanForm && (
              <div style={{ background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>{editingPlan ? 'Edit Plan' : 'Create New Plan'}</h3>
                <div className={styles.settingsGrid}>
                  <div className={styles.formGroup}>
                    <label>Plan Name</label>
                    <input type="text" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} placeholder="e.g. Pro" />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Slug</label>
                    <input type="text" value={planForm.slug} onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} placeholder="e.g. pro" disabled={!!editingPlan} style={editingPlan ? { background: '#eee' } : {}} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Price ($)</label>
                    <input type="number" min="0" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Billing Cycle</label>
                    <select value={planForm.billingCycle} onChange={(e) => setPlanForm({ ...planForm, billingCycle: e.target.value })} style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
                      <option value="free">Free</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                      <option value="one-time">One-Time</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Sort Order</label>
                    <input type="number" min="0" value={planForm.sortOrder} onChange={(e) => setPlanForm({ ...planForm, sortOrder: e.target.value })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Status</label>
                    <select value={planForm.isActive ? 'active' : 'inactive'} onChange={(e) => setPlanForm({ ...planForm, isActive: e.target.value === 'active' })} style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className={styles.formGroup} style={{ marginTop: '12px' }}>
                  <label>Description</label>
                  <input type="text" value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} placeholder="Brief description of the plan" />
                </div>
                <h4 style={{ margin: '16px 0 8px', fontSize: '14px', color: '#555' }}>Feature Limits</h4>
                <div className={styles.settingsGrid}>
                  <div className={styles.formGroup}>
                    <label>Max Users</label>
                    <input type="number" min="1" value={planForm.maxUsers} onChange={(e) => setPlanForm({ ...planForm, maxUsers: e.target.value })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Max Branches</label>
                    <input type="number" min="1" value={planForm.maxBranches} onChange={(e) => setPlanForm({ ...planForm, maxBranches: e.target.value })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Max Products</label>
                    <input type="number" min="1" value={planForm.maxProducts} onChange={(e) => setPlanForm({ ...planForm, maxProducts: e.target.value })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Max Invoices/Month</label>
                    <input type="number" min="1" value={planForm.maxInvoicesPerMonth} onChange={(e) => setPlanForm({ ...planForm, maxInvoicesPerMonth: e.target.value })} />
                  </div>
                </div>
                <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                  <button className={styles.btnSmall} style={{ padding: '10px 24px' }} onClick={savePlan}>
                    {editingPlan ? 'Update Plan' : 'Create Plan'}
                  </button>
                  <button className={styles.btnSmall} style={{ padding: '10px 24px', background: '#6b7280' }} onClick={() => setShowPlanForm(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Price</th>
                  <th>Cycle</th>
                  <th>Users</th>
                  <th>Branches</th>
                  <th>Products</th>
                  <th>Invoices/Mo</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan, idx) => (
                  <tr key={plan._id}>
                    <td>{idx + 1}</td>
                    <td><strong>{plan.name}</strong></td>
                    <td><code>{plan.slug}</code></td>
                    <td>${plan.price}</td>
                    <td>{plan.billingCycle}</td>
                    <td>{plan.features?.maxUsers}</td>
                    <td>{plan.features?.maxBranches}</td>
                    <td>{plan.features?.maxProducts}</td>
                    <td>{plan.features?.maxInvoicesPerMonth}</td>
                    <td>
                      <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '12px', background: plan.isActive ? '#d1fae5' : '#fee2e2', color: plan.isActive ? '#065f46' : '#991b1b' }}>
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className={styles.actions}>
                      <button className={styles.btnSmall} onClick={() => openPlanForm(plan)}>Edit</button>
                      <button className={styles.btnSmallDanger} onClick={() => confirmDeletePlan(plan)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {plans.length === 0 && (
                  <tr><td colSpan="11" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No plans found</td></tr>
                )}
              </tbody>
            </table>
          </section>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && settingsForm && !loading && (
          <section className={styles.tableSection}>
            <h2>Platform Settings</h2>
            {settingsSaved && (
              <div style={{ background: '#d4edda', color: '#155724', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>
                ✅ Settings saved successfully!
              </div>
            )}

            <h3 style={{ marginTop: '20px', marginBottom: '12px', fontSize: '16px', color: '#555' }}>Branding</h3>
            <div className={styles.settingsGrid}>
              <div className={styles.formGroup}>
                <label>App Name</label>
                <input
                  type="text"
                  value={settingsForm.appName}
                  onChange={(e) => setSettingsForm({ ...settingsForm, appName: e.target.value })}
                  placeholder="e.g. BikeFlow"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Tagline</label>
                <input
                  type="text"
                  value={settingsForm.tagline}
                  onChange={(e) => setSettingsForm({ ...settingsForm, tagline: e.target.value })}
                  placeholder="e.g. Cloud POS for medium businesses"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Logo URL</label>
                <input
                  type="text"
                  value={settingsForm.logoUrl}
                  onChange={(e) => setSettingsForm({ ...settingsForm, logoUrl: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Primary Color</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={settingsForm.primaryColor}
                    onChange={(e) => setSettingsForm({ ...settingsForm, primaryColor: e.target.value })}
                    style={{ width: '40px', height: '36px', padding: '2px', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={settingsForm.primaryColor}
                    onChange={(e) => setSettingsForm({ ...settingsForm, primaryColor: e.target.value })}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
            </div>

            <h3 style={{ marginTop: '24px', marginBottom: '12px', fontSize: '16px', color: '#555' }}>Contact Info</h3>
            <div className={styles.settingsGrid}>
              <div className={styles.formGroup}>
                <label>Support Email</label>
                <input
                  type="email"
                  value={settingsForm.supportEmail}
                  onChange={(e) => setSettingsForm({ ...settingsForm, supportEmail: e.target.value })}
                  placeholder="support@company.com"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Support Phone</label>
                <input
                  type="text"
                  value={settingsForm.supportPhone}
                  onChange={(e) => setSettingsForm({ ...settingsForm, supportPhone: e.target.value })}
                  placeholder="+1 234 567 8900"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Website</label>
                <input
                  type="text"
                  value={settingsForm.website}
                  onChange={(e) => setSettingsForm({ ...settingsForm, website: e.target.value })}
                  placeholder="https://company.com"
                />
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <button className={styles.btnSmall} style={{ padding: '10px 24px', fontSize: '14px' }} onClick={saveSettings}>
                Save Settings
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className={styles.modalOverlay} onClick={() => setConfirmModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} data-type={confirmModal.type}>
              {confirmModal.type === 'danger' ? '⚠️' : '✅'} {confirmModal.title}
            </div>
            <div className={styles.modalBody}>
              <p>{confirmModal.message}</p>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.btnSmall}
                style={{ padding: '10px 24px', background: '#6b7280' }}
                onClick={() => setConfirmModal(null)}
              >
                Cancel
              </button>
              <button
                className={confirmModal.type === 'danger' ? styles.btnSmallDanger : styles.btnSmallSuccess}
                style={{ padding: '10px 24px' }}
                onClick={confirmModal.onConfirm}
              >
                Yes, {confirmModal.title}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {passwordModal && (
        <div className={styles.modalOverlay} onClick={() => setPasswordModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader} data-type="info">
              🔑 Reset Password — {passwordModal.userName}
            </div>
            <div className={styles.modalBody}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className={styles.formGroup}>
                  <label>New Password</label>
                  <input
                    type="text"
                    value={pwdForm.password}
                    onChange={(e) => setPwdForm({ ...pwdForm, password: e.target.value })}
                    placeholder="Enter new password"
                    autoFocus
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Confirm Password</label>
                  <input
                    type="text"
                    value={pwdForm.confirmPassword}
                    onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                    placeholder="Confirm password"
                  />
                </div>
                <button
                  type="button"
                  onClick={generatePassword}
                  style={{ alignSelf: 'flex-start', padding: '8px 16px', fontSize: '13px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  🎲 Generate Password
                </button>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.btnSmall}
                style={{ padding: '10px 24px', background: '#6b7280' }}
                onClick={() => setPasswordModal(null)}
              >
                Cancel
              </button>
              <button
                className={styles.btnSmallSuccess}
                style={{ padding: '10px 24px' }}
                onClick={submitPasswordReset}
              >
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperadminDashboard;
