# Quick Start Guide - BikeFlow SaaS Platform

Get the platform running locally in 5 minutes.

---

## 📋 Prerequisites

- **Node.js 16+** - [Download](https://nodejs.org)
- **MongoDB** - [Local setup](https://docs.mongodb.com/manual/installation/) or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (cloud)
- **Redis** (optional for dev) - See [REDIS_SETUP.md](./REDIS_SETUP.md)

---

## 🚀 Backend Setup

```bash
# Navigate to backend
cd BACKEND

# Install dependencies
npm install

# Create .env file from template
cp .env.example .env

# Edit .env with your values:
# MONGO_URI=mongodb://localhost:27017/aicoding
# JWT_SECRET=your_random_secret_here
# STRIPE_SECRET_KEY=sk_test_...
# RAZORPAY_KEY_ID=rzp_test_...
```

### Start Backend

```bash
npm run dev
```

✅ **Expected Output:**
```
✅ Connected to MongoDB
⚠️ Redis unavailable, using in-memory store for development
🚀 Server running on port 4000
```

If you get a MongoDB error, start MongoDB first:
```bash
# Windows (if installed)
mongod

# macOS with Homebrew
brew services start mongodb-community

# Linux
sudo service mongodb start
```

---

## 🎨 Frontend Setup

In a **second terminal**:

```bash
# Navigate to frontend
cd FRONTEND

# Install dependencies
npm install

# Create .env file from template
cp .env.example .env

# (Default settings are already correct)
```

### Start Frontend

```bash
npm run dev
```

✅ **Expected Output:**
```
<s> [webpack.Progress] 100%
ℹ Compiled successfully
ℹ Loopback: http://localhost:3000/
```

Your browser will auto-open at `http://localhost:3000`

---

## ✅ Testing the App

### 1. Sign Up (Create Tenant)

```
URL: http://localhost:3000/signup
Name: Acme Bike Shop
Email: admin@acmebikes.com
Password: password123
Branch: Downtown Store
Timezone: UTC
Currency: USD
Plan: Trial (14-day free)
```

Click **Create Account** → You're logged in!

### 2. Explore Dashboard

You'll see:
- 💰 Sales today: $0 (no invoices yet)
- 📦 Low stock items: (populated from inventory)
- ⚡ Rate-limit status: Plan tier + API usage
- 🏆 Top products: (empty until you create sales)
- ⚙️ Quick actions: Links to modules

### 3. Test 2FA Setup

1. Click on your profile
2. Enable 2FA → Scan QR code with authenticator app
3. Enter 6-digit code to verify
4. Save backup codes safely

### 4. Check Audit Trail

Open DevTools (F12) → Network tab and make API calls:

```bash
# In browser console:
fetch('/api/audit/logs', {
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
}).then(r => r.json()).then(console.log)
```

You'll see immutable activity logs.

---

## 🔧 Troubleshooting

### Backend Won't Start

**Error: "Connect ECONNREFUSED 127.0.0.1:27017"**
- MongoDB is not running
- Start MongoDB: `mongod` (or install if needed)

**Error: "Redis Client Error"**
- Redis is not required for development
- The app automatically falls back to in-memory storage
- See [REDIS_SETUP.md](./REDIS_SETUP.md) for Redis installation

### Frontend Won't Start

**Error: "port 3000 already in use"**
```bash
# Kill the process using port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux:
lsof -i :3000
kill -9 <PID>
```

**Error: "Cannot find module"**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### CORS Error

**"Access to XMLHttpRequest denied"**
- Backend is not running (should be on `:4000`)
- Check REACT_APP_API_URL in FRONTEND/.env

---

## 📊 Default Test Credentials

After signup, you can login with:

```
Email: admin@acmebikes.com
Password: password123
```

First-time login requires no 2FA. After you set it up, it'll be required.

---

## 🔑 Environment Variables

### Backend (.env)

```env
PORT=4000
MONGO_URI=mongodb://localhost:27017/aicoding
JWT_SECRET=your_secret_key_here
REDIS_URL=redis://localhost:6379

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...

NODE_ENV=development
```

### Frontend (.env)

```env
REACT_APP_API_URL=http://localhost:4000/api
REACT_APP_STRIPE_PUBLIC_KEY=pk_test_...
```

---

## 📚 Next Steps

1. **Explore Features**
   - Dashboard widgets
   - Login/logout flow
   - 2FA setup
   - Session management

2. **Check API Docs**
   - [BACKEND/README.md](./BACKEND/README.md)
   - [API_DOC.md](./BACKEND/API_DOC.md)

3. **Read Architecture**
   - [PHASE_0_SUMMARY.md](./PHASE_0_SUMMARY.md)
   - [plan.md](./plan.md)

4. **Set Up Real Redis** (for production)
   - Follow [REDIS_SETUP.md](./REDIS_SETUP.md)

---

## 🛠️ Development Commands

### Backend
```bash
npm run dev          # Start with nodemon (watches file changes)
npm run build        # Build for production
npm run test         # Run tests (coming soon)
```

### Frontend
```bash
npm run dev          # Start Webpack dev server with HMR
npm run build        # Production build to /dist
npm start            # Serve production build
```

---

## 🐛 Quick Debug Tips

**See all API requests:**
- Open DevTools (F12) → Network tab
- Check that requests go to `http://localhost:4000/api/*`

**Check stored token:**
- DevTools → Console: `localStorage.getItem('token')`

**See server logs:**
- Backend terminal will show all API calls + errors

**Clear everything & start fresh:**
```bash
# Backend
rm .env
cp .env.example .env
# Edit .env with MongoDB URI

# Frontend
rm .env
cp .env.example .env
```


---

## 🎯 What You Have Now

✅ Multi-tenant SaaS platform  
✅ JWT + 2FA authentication  
✅ Stripe/Razorpay billing ready  
✅ RBAC with 4 roles  
✅ Audit logs & compliance  
✅ Rate-limiting & usage metering  
✅ Responsive React dashboard  

**Next Phase:** Background jobs, admin panel, advanced reporting

---

**Questions?** Check the main README or dive into [PHASE_0_SUMMARY.md](./PHASE_0_SUMMARY.md).

**Ready to ship?** Review [DEPLOYMENT.md](./DEPLOYMENT.md) (coming Phase 1).
