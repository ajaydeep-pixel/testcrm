# Backend (Node.js + Express)

Quick start:

1. Copy `.env.example` to `.env` and update `MONGO_URI` and `JWT_SECRET`.
2. Install dependencies:

```bash
cd BACKEND
npm install
```

3. Run in dev:

```bash
npm run dev
```

API endpoints (starter):
- `GET /api/products/search?q=term` - search products by name/category/brand
- `GET /api/products/:id` - get product
- `POST /api/products` - create product (used by POS instant-add)
