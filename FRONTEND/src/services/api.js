import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Interceptor to handle 401 responses (token expired)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (email, password) => api.post('/auth/login', { email, password }),
  setup2FA: () => api.post('/auth/2fa/setup'),
  confirm2FA: (token, backupCodes) => api.post('/auth/2fa/confirm', { token, backupCodes }),
  verify2FA: (totp) => api.post('/auth/2fa/verify', { totp }),
  logout: () => api.post('/auth/logout'),
  listSessions: () => api.get('/auth/sessions'),
  revokeSession: (sessionId) => api.delete(`/auth/sessions/${sessionId}`),
};

// Billing API
export const billingAPI = {
  getPlans: () => api.get('/billing/plans'),
  getSubscriptionStatus: () => api.get('/billing/subscription'),
  createCheckoutSession: (planSlug) => api.post('/billing/create-checkout-session', { planSlug }),
  getCheckoutStatus: (sessionId) => api.get('/billing/checkout-status', { params: { session_id: sessionId } }),
  changePlan: (newPlanName) => api.post('/billing/change-plan', { newPlanName }),
  cancelSubscription: (immediate = false) => api.post('/billing/cancel', { immediate }),
  listInvoices: (page = 1, limit = 20) =>
    api.get('/billing/invoices', { params: { page, limit } }),
  getInvoice: (invoiceId) => api.get(`/billing/invoices/${invoiceId}`),
  checkUsageLimits: () => api.get('/billing/usage'),
  recordUsage: (metric, count) => api.post('/billing/usage', { metric, count }),
};

// Usage & Rate-limiting API
export const usageAPI = {
  getCurrentUsage: () => api.get('/usage/current'),
  getRateLimitStatus: () => api.get('/usage/rate-limit-status'),
  getDashboard: () => api.get('/usage/dashboard'),
  resetUsage: () => api.post('/usage/reset'),
  syncUsage: () => api.post('/usage/sync'),
};

// Audit API
export const auditAPI = {
  getLogs: (filters = {}) => api.get('/audit/logs', { params: filters }),
  getUserActivity: (userId) => api.get(`/audit/user-activity/${userId}`),
  getResourceHistory: (resource, resourceId) => 
    api.get(`/audit/resource-history/${resource}/${resourceId}`),
  exportLogs: (format = 'json') => api.get(`/audit/export?format=${format}`),
  getSummary: () => api.get('/audit/summary'),
};

// Settings API
export const settingsAPI = {
  getBusinessInfo: () => api.get('/settings/business-info'),
  updateBusinessInfo: (business_info) => api.put('/settings/business-info', { business_info }),
  getBillingInfo: () => api.get('/settings/billing-info'),
  updateBillingInfo: (billing_info) => api.put('/settings/billing-info', { billing_info }),
  getProfileInfo: () => api.get('/settings/profile-info'),
  updateProfileInfo: (profile_info) => api.put('/settings/profile-info', { profile_info }),
};

// Products API
export const productsAPI = {
  getProducts: (page = 1, limit = 20) => 
    api.get('/products', { params: { page, limit } }),
  createProduct: (data) => api.post('/products', data),
  updateProduct: (id, data) => api.put(`/products/${id}`, data),
  deleteProduct: (id) => api.delete(`/products/${id}`),
  searchProducts: (query) => api.get('/products/search', { params: { q: query } }),
};

// Sales API
export const salesAPI = {
  getSales: (page = 1, limit = 20) => 
    api.get('/sales', { params: { page, limit } }),
  createSale: (data) => api.post('/sales', data),
  getSale: (id) => api.get(`/sales/${id}`),
  getTodaysSales: () => api.get('/sales/today'),
  getTopProducts: (limit = 10) => api.get('/sales/top-products', { params: { limit } }),
};

// Inventory API
export const inventoryAPI = {
  getInventory: (page = 1, limit = 20) => 
    api.get('/inventory', { params: { page, limit } }),
  getLowStockItems: (threshold = 10) => 
    api.get('/inventory/low-stock', { params: { threshold } }),
  updateStock: (productId, quantity) => 
    api.patch(`/inventory/${productId}`, { quantity }),
};

export default api;
