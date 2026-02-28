// Bike Parts Inventory API
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

// Routes
const { verifyToken } = require('./src/middleware/authMiddleware');

app.use('/api/auth', require('./src/routes/authRoutes'));

// Secure these routes
app.use('/api/products', verifyToken, require('./src/routes/productRoutes'));
app.use('/api/sales', verifyToken, require('./src/routes/saleRoutes'));
app.use('/api/purchases', verifyToken, require('./src/routes/purchaseRoutes'));
app.use('/api/suppliers', verifyToken, require('./src/routes/supplierRoutes'));
app.use('/api/inventory', verifyToken, require('./src/routes/inventoryRoutes'));
app.use('/api/brands', verifyToken, require('./src/routes/brandRoutes'));
app.use('/api/categories', verifyToken, require('./src/routes/categoryRoutes'));
app.use('/api/customers', verifyToken, require('./src/routes/customerRoutes'));

app.get('/', (req, res) => res.send('Bike Parts Inventory API'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
