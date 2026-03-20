// Bike Parts Inventory API
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');
const seedDatabase = require('./src/scripts/seed');

const app = express();
app.use(cors());

// Stripe webhook needs raw body — MUST be registered before express.json()
const { stripeWebhook, razorpayWebhook } = require('./src/controllers/billingController');
app.post('/api/billing/webhook/stripe', express.raw({ type: 'application/json' }), stripeWebhook);
app.post('/api/billing/webhook/razorpay', express.json(), razorpayWebhook);

app.use(express.json());

connectDB().then(() => {
  seedDatabase().catch(err => console.error('Seeding failed:', err));
});

// Middleware
const { verifyToken } = require('./src/middleware/authMiddleware');
const { extractTenant, verifyTenantAccess } = require('./src/middleware/tenantMiddleware');
const { rateLimitTenant, rateLimitIP } = require('./src/middleware/rateLimitMiddleware');
const { recordUsage, checkUsageAndWarn } = require('./src/middleware/usageMeteringMiddleware');

// Global rate limiting
app.use('/api/', rateLimitIP(100, 3600)); // 100 req per IP per hour

// Routes (public)
app.use('/api/auth', require('./src/routes/authRoutes'));

// Public branding endpoint (no auth)
const { getPublicBranding } = require('./src/controllers/adminController');
app.get('/api/branding', getPublicBranding);

// Public plans endpoint (no auth)
const { getPlans } = require('./src/controllers/billingController');
app.get('/api/billing/plans', getPlans);

// Superadmin routes (only verifyToken + superadmin check, no tenant middleware)
app.use('/api/admin', require('./src/routes/adminRoutes'));

// Apply rate limiting + usage metering to all authenticated routes
app.use('/api/billing', verifyToken, extractTenant, verifyTenantAccess, rateLimitTenant(), recordUsage, checkUsageAndWarn, require('./src/routes/billingRoutes'));
app.use('/api/audit', verifyToken, extractTenant, verifyTenantAccess, rateLimitTenant(), recordUsage, checkUsageAndWarn, require('./src/routes/auditRoutes'));
app.use('/api/usage', verifyToken, extractTenant, verifyTenantAccess, rateLimitTenant(), recordUsage, checkUsageAndWarn, require('./src/routes/usageRoutes'));
app.use('/api/settings', verifyToken, extractTenant, verifyTenantAccess, rateLimitTenant(), recordUsage, checkUsageAndWarn, require('./src/routes/settingsRoutes'));

// Secure these routes with auth + tenant + rate limit + usage metering
app.use('/api/products', verifyToken, extractTenant, verifyTenantAccess, rateLimitTenant(), recordUsage, checkUsageAndWarn, require('./src/routes/productRoutes'));
app.use('/api/sales', verifyToken, extractTenant, verifyTenantAccess, rateLimitTenant(), recordUsage, checkUsageAndWarn, require('./src/routes/saleRoutes'));
app.use('/api/purchases', verifyToken, extractTenant, verifyTenantAccess, rateLimitTenant(), recordUsage, checkUsageAndWarn, require('./src/routes/purchaseRoutes'));
app.use('/api/suppliers', verifyToken, extractTenant, verifyTenantAccess, rateLimitTenant(), recordUsage, checkUsageAndWarn, require('./src/routes/supplierRoutes'));
app.use('/api/inventory', verifyToken, extractTenant, verifyTenantAccess, rateLimitTenant(), recordUsage, checkUsageAndWarn, require('./src/routes/inventoryRoutes'));
app.use('/api/brands', verifyToken, extractTenant, verifyTenantAccess, rateLimitTenant(), recordUsage, checkUsageAndWarn, require('./src/routes/brandRoutes'));
app.use('/api/categories', verifyToken, extractTenant, verifyTenantAccess, rateLimitTenant(), recordUsage, checkUsageAndWarn, require('./src/routes/categoryRoutes'));
app.use('/api/customers', verifyToken, extractTenant, verifyTenantAccess, rateLimitTenant(), recordUsage, checkUsageAndWarn, require('./src/routes/customerRoutes'));

app.get('/', (req, res) => res.send('Bike Parts Inventory API'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
