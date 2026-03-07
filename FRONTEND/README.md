# BikeFlow Frontend - Cloud Dashboard

This folder contains React 18 dashboard with Tailwind CSS for multi-tenant SaaS POS & inventory.

## Quick Start

```bash
cd FRONTEND
npm install
npm run dev
```

Starts dev server at http://localhost:3000 with HMR (hot reload).

## Stack

- React 18 + React Router v6 for navigation
- Tailwind CSS for responsive UI  
- Axios for API calls
- Webpack 5 for bundling

## Key Features

- Multi-tenant Login/Signup with 2FA (TOTP)
- Dashboard with sales, inventory, usage widgets
- Rate-limit monitoring per plan
- Low stock alerts
- Top products analytics
- Session management
- Responsive mobile design

## Environment

Create `.env` file:

```env
REACT_APP_API_URL=http://localhost:4000/api
```

## Project Structure

- `pages/` → Login, Signup, Dashboard pages
- `components/` → Widget components (Sales, Inventory, RateLimit, TopProducts)
- `services/api.js` → Axios instance + all endpoints
- `styles/global.css` → Tailwind utilities

---

**Status**: Phase 0 MVP ✅  
**Last Updated**: March 7, 2026
