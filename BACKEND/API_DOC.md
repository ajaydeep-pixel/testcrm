# Bike Parts Inventory & Billing System - Backend API

## Setup
1. Copy `.env.example` to `.env` and update values.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start server:
   ```bash
   npm run dev
   ```

## Core Endpoints

### Auth
- `POST /api/auth/register` — Register user (admin/staff)
- `POST /api/auth/login` — Login, returns JWT

### Products
- `GET /api/products/search?q=term` — Search products
- `POST /api/products` — Add product (instant add during billing)
- `PUT /api/products/:id` — Edit product
- `GET /api/products/:id` — Get product

### Inventory
- `GET /api/inventory/product/:productId` — Get inventory entries for product
- `POST /api/inventory` — Add inventory entry
- `GET /api/inventory/low-stock?threshold=5` — Low stock alert

### Sales
- `POST /api/sales` — Create sale (billing)
- `GET /api/sales/:invoiceNo` — Get sale by invoice

### Purchases
- `POST /api/purchases` — Create purchase order
- `GET /api/purchases/:purchaseOrderNo` — Get purchase order

### Suppliers
- `POST /api/suppliers` — Add supplier
- `GET /api/suppliers` — List suppliers
- `GET /api/suppliers/:id` — Get supplier by id

### Activity Logs
- `GET /api/activity` — (to be implemented)

## Notes
- All endpoints (except auth) require JWT in `Authorization: Bearer <token>` header.
- For bulk upload, use `/api/products/bulk` (to be implemented).
- For PDF invoice, use `/api/sales/:invoiceNo/pdf` (to be implemented).
