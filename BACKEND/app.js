// Bike Parts Inventory API
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

// Middleware
const { verifyToken } = require('./src/middleware/authMiddleware');
const { extractTenant, verifyTenantAccess } = require('./src/middleware/tenantMiddleware');
const { rateLimitTenant, rateLimitIP } = require('./src/middleware/rateLimitMiddleware');
const { recordUsage, checkUsageAndWarn } = require('./src/middleware/usageMeteringMiddleware');

// Global rate limiting
app.use('/api/', rateLimitIP(100, 3600)); // 100 req per IP per hour

// Routes (public)
app.use('/api/auth', require('./src/routes/authRoutes'));

// Apply rate limiting + usage metering to all authenticated routes
app.use('/api/billing', verifyToken, extractTenant, verifyTenantAccess, rateLimitTenant(), recordUsage, checkUsageAndWarn, require('./src/routes/billingRoutes'));
app.use('/api/audit', verifyToken, extractTenant, verifyTenantAccess, rateLimitTenant(), recordUsage, checkUsageAndWarn, require('./src/routes/auditRoutes'));
app.use('/api/usage', verifyToken, extractTenant, verifyTenantAccess, rateLimitTenant(), recordUsage, checkUsageAndWarn, require('./src/routes/usageRoutes'));

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
