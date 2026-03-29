# Deployment & Environment Configuration Flow

## 📋 Overview

This document explains how to deploy the BikeFlow platform from development to production, including environment configuration, process management, SSL/TLS, and troubleshooting.

---

## 🏗️ Deployment Architecture

### **Production Stack**

```
┌─────────────────────────────────────────────────────┐
│                   Internet / Users                  │
└─────────────────────────┬───────────────────────────┘
                          │ HTTPS (443)
                          ▼
┌─────────────────────────────────────────────────────┐
│              Load Balancer (NGINX)                  │
│  - SSL Termination                                 │
│  - Static file serving (frontend build)            │
│  - Rate limiting (optional)                       │
│  - Reverse proxy to Node.js                        │
└─────────────────────────┬───────────────────────────┘
                          │ HTTP (localhost:3000)
                          ▼
┌─────────────────────────────────────────────────────┐
│           Node.js Application (PM2)                │
│  - Cluster mode (multi-core)                      │
│  - Auto-restart on crash                          │
│  - Log rotation                                   │
└─────────────────────────┬───────────────────────────┘
                          │
                ┌─────────┴─────────┐
                ▼                   ▼
        ┌─────────────┐   ┌─────────────┐
        │   MongoDB   │   │    Redis    │
        │   (Atlas)   │   │   (Cloud)   │
        └─────────────┘   └─────────────┘
                          │
                          ▼
                ┌─────────────────────┐
                │ External Services   │
                │ Stripe / Razorpay   │
                │ Email (SendGrid)    │
                └─────────────────────┘
```

---

## 📦 Pre-Deployment Checklist

### **1. Infrastructure Provisioning**

| Service | Recommended Provider | Minimum Specs | Config |
|---------|---------------------|---------------|--------|
| **Compute** | AWS EC2, DigitalOcean Droplet, VPS | 2 vCPU, 4GB RAM, 80GB SSD | Ubuntu 22.04 LTS |
| **Database** | MongoDB Atlas | M10 cluster (shared RAM), 2+ nodes | Username/password auth, IP whitelist |
| **Cache** | Redis Cloud, AWS ElastiCache | 1GB RAM, single node | Password auth, TLS |
| **Domain** | Namecheap, Route53 | - | A record → server IP |
| **SSL** | Let's Encrypt (Certbot) | - | Auto-renew every 90 days |

---

### **2. Server Setup**

```bash
# 1. SSH into server
ssh root@your-server-ip

# 2. Update system
apt update && apt upgrade -y

# 3. Install Node.js 18+ (use NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# 4. Install PM2 (process manager)
npm install -g pm2

# 5. Install Nginx (reverse proxy)
apt install -y nginx

# 6. Install Certbot (for SSL)
apt install -y certbot python3-certbot-nginx

# 7. Install MongoDB client (optional, for migrations)
apt install -y mongodb-clients

# 8. Install Redis CLI (optional)
apt install -y redis-tools

# 9. Create app user (non-root)
adduser --system --group bikeflow
usermod -aG sudo bikeflow  # Optional: allow sudo for deployment

# 10. Set up firewall (UFW)
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP (redirects to HTTPS)
ufw allow 443/tcp     # HTTPS
ufw enable
```

---

### **3. Code Deployment**

```bash
# Server: Clone repository
cd /home/bikeflow
git clone https://github.com/your-org/bikeflow.git
cd bikeflow

# Install backend dependencies
cd BACKEND
npm ci --only=production  # Faster than npm install

# Build frontend (production)
cd ../FRONTEND
npm ci
npm run build  # Creates /dist folder

# Copy build to backend (serving static)
cp -r dist ../BACKEND/dist/

# Or configure NGINX to serve /dist directly (recommended)
```

**Alternative:** Use CI/CD pipeline (GitHub Actions, Jenkins, GitLab CI).

---

## 🔐 Environment Configuration

### **Backend `.env` (production)**

```env
# Server
NODE_ENV=production
PORT=3000  # PM2 runs on 3000, Nginx proxies to it

# Database
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/aicoding?retryWrites=true&w=majority
# Or with Atlas connection string including SRV record

# JWT
JWT_SECRET=your-super-secret-random-string-min-64-chars-use-openssl-rand-base64-64
JWT_EXPIRY=15m

# Redis
REDIS_URL=redis://:password@redis-12345.cloud.redislabs.com:12345

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_live_...
STRIPE_PUBLIC_KEY=pk_live_...

# Razorpay
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...

# Frontend URL (for CORS, webhook redirects)
FRONTEND_URL=https://app.bikeflow.com

# Email (SendGrid or similar)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxx
FROM_EMAIL=noreply@bikeflow.com

# Logging
LOG_LEVEL=warn  # Error in prod, info in dev
```

**Important:**
- Never commit `.env` to git
- Use strong random secrets (generate with `openssl rand -base64 64`)
- Store secrets in environment variables on server (not in files if possible)
- Consider using AWS Secrets Manager or HashiCorp Vault for enterprise

---

### **Frontend `.env.production`**

```env
REACT_APP_API_URL=https://api.bikeflow.com/api
REACT_APP_STRIPE_PUBLIC_KEY=pk_live_...
# REACT_APP_GOOGLE_ANALYTICS_ID=UA-...
```

**Note:** Build process reads `.env.production` when running `npm run build`.

---

## 🔄 Process Management (PM2)

### **Start Application**

```bash
cd /home/bikeflow/bikeflow/BACKEND

# Ecosystem file: ecosystem.config.js
module.exports = {
  apps: [{
    name: 'bikeflow-api',
    script: 'app.js',
    cwd: '/home/bikeflow/bikeflow/BACKEND',
    instances: 'max',  // Use all CPU cores
    exec_mode: 'cluster',  // Multi-process
    env: {
      NODE_ENV: 'production',
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/err.log',
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    merge_logs: true,
    log_rotate: {
      max_size: '10M',
      retain: 10,  // Keep 10 log files
    },
    restart_delay: 5000,  // Wait 5s before restart after crash
    max_memory_restart: '1G',  // Restart if >1GB memory
  }],
};

# Start
pm2 start ecosystem.config.js

# Save PM2 list (auto-start on reboot)
pm2 save

# Generate startup script
pm2 startup
# Copy and run the command it outputs (as root)
```

---

### **PM2 Commands**

```bash
# View all processes
pm2 list

# View logs (live)
pm2 logs bikeflow-api

# View logs with filtering
pm2 logs bikeflow-api --lines 100

# Restart specific app
pm2 restart bikeflow-api

# Stop
pm2 stop bikeflow-api

# Delete from PM2 list
pm2 delete bikeflow-api

# Monitor (CPU, memory)
pm2 monit

# Show stats
pm2 show bikeflow-api
```

---

### **Log Rotation**

PM2 handles rotation automatically with `log_rotate` config.

**Log locations (relative to app cwd):**
```
BACKEND/logs/
├── combined.log    (all output)
├── out.log         (stdout)
├── err.log         (stderr)
├── combined-2024-03-15.log
└── ...
```

---

## 🌐 Nginx Configuration

### **Site Configuration**

`/etc/nginx/sites-available/bikeflow`:

```nginx
upstream bikeflow_backend {
    # PM2 runs Node.js on port 3000 (cluster mode)
    # Use 127.0.0.1 to avoid network overhead
    server 127.0.0.1:3000;
    # If multiple Node instances on different ports:
    # server 127.0.0.1:3000;
    # server 127.0.0.1:3001;
    # server 127.0.0.1:3002;
}

server {
    listen 80;
    server_name app.bikeflow.com api.bikeflow.com;
    return 301 https://$server_name$request_uri;  # Redirect HTTP → HTTPS
}

server {
    listen 443 ssl http2;
    server_name app.bikeflow.com api.bikeflow.com;

    # SSL Certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/app.bikeflow.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.bikeflow.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Frontend (React build) - serve static files
    location / {
        root /home/bikeflow/bikeflow/BACKEND/dist;  # React build output
        try_files $uri /index.html;  # SPA routing - fallback to index.html
    }

    # API proxy
    location /api/ {
        proxy_pass http://bikeflow_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Uploads (protect with auth or use separate subdomain)
    location /uploads/ {
        # Option 1: Serve directly (if auth checked by app)
        alias /home/bikeflow/bikeflow/BACKEND/uploads/;

        # Option 2: Proxy to app with auth (more secure)
        # proxy_pass http://bikeflow_backend;

        # Cache images for 1 year
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://bikeflow_backend;
    }
}
```

---

### **Enable Site & Test**

```bash
# Create symlink
ln -s /etc/nginx/sites-available/bikeflow /etc/nginx/sites-enabled/

# Test nginx config
nginx -t

# If OK, reload
systemctl reload nginx

# If error, check:
# - syntax: nginx -t
# - logs: tail -f /var/log/nginx/error.log
```

---

## 🔒 SSL/TLS with Let's Encrypt

### **Auto-Setup with Certbot**

```bash
# Install Certbot (already done in server setup)
certbot --nginx -d app.bikeflow.com -d api.bikeflow.com

# Follow prompts:
# - Email: admin@bikeflow.com
# - Agree to TOS
# - No redirect HTTP → HTTPS? Choose Yes (redirect)

# Certbot auto-modifies nginx config and installs certs
```

**Certs stored at:**
```
/etc/letsencrypt/live/app.bikeflow.com/
├── fullchain.pem  (certificate chain)
└── privkey.pem    (private key)
```

---

### **Auto-Renewal**

```bash
# Test renewal
certbot renew --dry-run

# Cron job (auto-added by certbot)
# /etc/cron.d/certbot: runs twice daily
# Systemd timer also available: certbot.timer
```

---

## 🔄 Deployment Workflow

### **Manual Deployment (Simple)**

```bash
# On your local machine
git pull origin main
git push origin production-branch  # Or just push to main

# On server
cd /home/bikeflow/bikeflow
git pull origin production-branch

# Install dependencies
cd BACKEND && npm ci --only=production && cd ..
cd FRONTEND && npm ci && npm run build && cd ..

# Copy frontend build
cp -r FRONTEND/dist/* BACKEND/dist/

# Restart app
pm2 restart bikeflow-api

# Check status
pm2 list
pm2 logs bikeflow-api --lines 50
```

---

### **GitHub Actions CI/CD (Automated)**

**.github/workflows/deploy.yml:**

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd BACKEND && npm ci --only=production && cd ..
          cd FRONTEND && npm ci && npm run build && cd ..

      - name: Build frontend
        run: |
          cd FRONTEND
          npm run build

      - name: Deploy to server via SSH
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /home/bikeflow/bikeflow
            git pull origin main
            cd BACKEND && npm ci --only=production && cd ..
            cp -rf FRONTEND/dist/* BACKEND/dist/
            pm2 restart bikeflow-api
```

**Secrets:** Set in GitHub repo Settings → Secrets:
- `HOST`: server IP
- `USERNAME`: server user (bikeflow)
- `SSH_KEY`: Private SSH key

---

## 🧪 Production Verification

### **Health Check**

```bash
# 1. Is Node.js running?
pm2 list
# bikeflow-api should be "online"

# 2. Is Nginx running?
systemctl status nginx
# Active: active (running)

# 3. Can reach health endpoint?
curl https://api.bikeflow.com/health
# Expected: {"status":"ok","uptime":12345}

# 4. Check logs for errors
pm2 logs bikeflow-api --lines 50 --err

# 5. Test API endpoint
curl https://api.bikeflow.com/api/branding
# Expected: {"name":"BikeFlow","supportEmail":"..."}

# 6. Check SSL
curl -I https://api.bikeflow.com
# HTTP/2 200
# strict-transport-security header present

# 7. Load test (basic)
ab -n 100 -c 10 https://api.bikeflow.com/api/branding
# Should handle 100 requests without error
```

---

### **Database Connection**

```bash
# Connect to MongoDB Atlas
mongosh "mongodb+srv://cluster.mongodb.net/aicoding" \
  -u user -p password

# Check collections
show collections
# products, users, tenants, auditlogs, ...

# Count documents
db.tenants.count()  # Should be ~1 (your test tenant)

# Check indexes
db.products.getIndexes()
# Should have { tenantId: 1, ... }
```

---

## 🐛 Troubleshooting

### **Issue: "Cannot find module"**

**Cause:** Dependencies not installed on server

**Fix:**
```bash
cd /home/bikeflow/bikeflow/BACKEND
npm ci --only=production
pm2 restart bikeflow-api
```

---

### **Issue: 502 Bad Gateway**

**Cause:** Node.js not running or port mismatch

**Check:**
```bash
pm2 list  # Is bikeflow-api online?
netstat -tlnp | grep :3000  # Is something listening on port 3000?
```

**Fix:** Start app, check Nginx `proxy_pass` target matches PM2 port.

---

### **Issue: SSL Certificate Not Trusted**

**Cause:** Certbot failed or domain doesn't match

**Fix:**
```bash
certbot certonly --nginx -d app.bikeflow.com
# Or manually renew
certbot renew --force-renewal
```

---

### **Issue: MongoDB Connection Failed**

**Cause:** IP not whitelisted in Atlas, wrong URI, network issue

**Check:**
```bash
# Test connection from server
mongosh "your-atlas-uri"
```

**Fix:**
- Add server IP to Atlas Network Access (IP whitelist)
- Verify `MONGO_URI` in `.env` correct
- Check DNS resolution if using SRV record

---

### **Issue: High Memory Usage (>80%)**

**Cause:** Memory leak in Node.js, too many PM2 instances

**Check:**
```bash
pm2 monit  # Watch memory per process
pm2 show bikeflow-api  # memory usage
```

**Fix:**
```bash
# Reduce PM2 instances (use fewer cores)
# In ecosystem.config.js: instances: 2 (instead of 'max')
pm2 restart bikeflow-api
```

---

### **Issue: 429 Rate Limit (Production)**

**Cause:** Legitimate traffic exceeded plan limits OR attack

**Check:**
```bash
# View Redis rate limit keys
redis-cli
KEYS rate_limit:*
GET rate_limit:{tenantId}

# If many distinct IPs hitting limits → DoS attack
# Consider CloudFlare or additional NGINX rate limiting
```

**Mitigation:**
- Upgrade plan for affected tenants
- Implement NGINX `limit_req_zone` for burst protection
- Use CloudFlare (DDoS protection)

---

## 📊 Performance Optimization

### **Node.js Optimization**

```javascript
// ecosystem.config.js
{
  instances: 'max',  // Use all CPU cores
  exec_mode: 'cluster',
  max_memory_restart: '1G',  // Restart before OOM
  node_args: '--max-old-space-size=1024',  // Limit heap to 1GB
}
```

---

### **Nginx Optimization**

```nginx
# /etc/nginx/nginx.conf
events {
    worker_connections 4096;  # Increase from 1024
    use epoll;  # Efficient connection processing on Linux
}

http {
    # Enable sendfile (zero-copy)
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;

    # Keep-alive
    keepalive_timeout 65;
    keepalive_requests 1000;

    # Gzip compression
    gzip on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript;

    # Rate limiting zone (optional)
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
}
```

---

### **MongoDB Optimization**

- Use Atlas (managed, auto-scaling)
- Choose appropriate tier (M10 for small, M20 for medium)
- Add indexes on query patterns (`tenantId`, `createdAt`)
- Use connection pooling (Mongoose default: 5 connections per instance)

---

## 🔄 Zero-Downtime Deployments

### **Blue-Green Deployment with PM2**

```bash
# 1. Deploy new code to separate directory
cd /home/bikeflow/bikeflow-new
git pull origin main
npm ci --only=production
# Build frontend, etc.

# 2. Start new PM2 app with different name
pm2 start ecosystem.js --name bikeflow-api-v2

# 3. Warm up (send few test requests)
curl https://api.bikeflow.com/health

# 4. Switch Nginx to new upstream (if using different port)
# Or test new version on different subdomain first

# 5. Stop old version
pm2 stop bikeflow-api
pm2 delete bikeflow-api

# 6. Rename new to old
pm2 rename bikeflow-api-v2 bikeflow-api
```

**Alternative:** Use `pm2 reload` for zero-downtime (only works with cluster mode):
```bash
pm2 reload bikeflow-api  # Graceful reload - existing connections finish
```

---

## 📈 Monitoring Setup

### **PM2 Monitoring**

```bash
# Install PM2 Plus (optional)
pm2 plus

# Or use pm2 monit for real-time
pm2 monit
```

---

### **Server Metrics**

```bash
# System stats
htop  # CPU, memory
df -h  # Disk usage
netstat -tlnp  # Open ports

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# App logs
pm2 logs bikeflow-api --lines 100
```

---

## 🧹 Maintenance Tasks

### **Daily**

- Monitor logs for errors (`pm2 logs --err`)
- Check disk space (`df -h`)
- Verify SSL certificate validity

### **Weekly**

- Backup MongoDB (Atlas automated already)
- Review slow queries (MongoDB Atlas Performance Advisor)
- Check PM2 memory usage, restart if leaks

### **Monthly**

- Update dependencies (security patches)
- Review PM2 logs for warnings
- Audit active tenants (check for abuse)
- Verify backups (restore test)

### **Quarterly**

- Security audit (npm audit, dependency updates)
- Performance review (slow queries, optimize indexes)
- Cost analysis (AWS/DigitalOcean billing)

---

## 🔄 Backup & Recovery

### **MongoDB Atlas**

- Automatic daily backups with 35-day retention (on paid tiers)
- Point-in-time recovery (PITR) enabled
- Snapshots every 6 hours

**Manual backup (if needed):**
```bash
mongodump --uri="connection-string" --out=backup-2024-03-15
# Upload to S3/Google Drive
```

---

### **Redis**

- Not persistent in current setup (data is cache/sessions)
- Sessions can be lost (users re-login)
- Rate limiting and usage counters reset

**To enable Redis persistence:**
```
# In redis.conf
save 900 1
save 300 10
save 60 10000
appendonly yes
```

---

### **Local Files**

**Backup uploads directory:**
```bash
# Daily cron
0 2 * * * tar -czf /backups/uploads-$(date +\%Y-\%m-\%d).tar.gz /home/bikeflow/bikeflow/BACKEND/uploads
# Keep last 30 days
```

**Restore:**
```bash
tar -xzf uploads-2024-03-15.tar.gz -C /home/bikeflow/bikeflow/BACKEND/
```

---

## 📋 Deployment Checklist

### **Pre-Launch**

- [ ] Server provisioned with Ubuntu 22.04
- [ ] Node.js 18+ installed
- [ ] PM2 installed globally
- [ ] Nginx installed
- [ ] Domain DNS points to server IP
- [ ] MongoDB Atlas cluster created, IP whitelist includes server
- [ ] Redis instance provisioned
- [ ] SSL certificate obtained (Let's Encrypt)
- [ ] All environment variables configured (`.env`)
- [ ] Code deployed to `/home/bikeflow/bikeflow`
- [ ] Dependencies installed (`npm ci --only=production`)
- [ ] Frontend built and copied (`npm run build`)
- [ ] Nginx config tested (`nginx -t`)
- [ ] Nginx reloaded
- [ ] PM2 app started
- [ ] Health check passes (`/health` endpoint)
- [ ] Can login via API (`/api/auth/login`)
- [ ] Can create product (tenant created)

---

### **Post-Launch (First 24h)**

- [ ] Monitor logs every hour for errors
- [ ] Check PM2 status (no crash loops)
- [ ] Verify Redis connection (rate limiting working)
- [ ] Test Stripe webhook endpoint (Stripe CLI)
- [ ] Check MongoDB Atlas metrics
- [ ] Verify SSL renewal is scheduled
- [ ] Set up monitoring alerts (optional: Sentry, UptimeRobot)
- [ ] Run load test (ab, k6) to verify capacity

---

## 🔐 Security Hardening

### **Server Level**

- [ ] Disable password SSH login, use SSH keys only
- [ ] Change default SSH port (22 → custom)
- [ ] Install fail2ban (block brute force)
- [ ] Enable firewall (UFW) - only 22, 80, 443 open
- [ ] Regular security updates: `apt update && apt upgrade -y`
- [ ] Install intrusion detection (OSSEC, Wazuh)

---

### **Application Level**

- [ ] All APIs require authentication (except `/api/auth/*`, `/api/branding`, `/api/billing/plans`)
- [ ] Rate limiting enabled (already in code)
- [ ] CORS restricted to trusted origins (in production)
- [ ] Helmet.js middleware (security headers)
- [ ] Input validation on all endpoints (add Joi/Yup)
- [ ] No stack traces in production errors
- [ ] MongoDB credentials have readWrite only (not admin)
- [ ] Redis password set

---

## 💾 Cost Optimization

### **Free Tier Options**

| Service | Free Tier | Limitations |
|---------|-----------|-------------|
| **MongoDB Atlas** | M0 (512MB) | Single region, no backups, for dev only |
| **Redis Cloud** | 30MB | 1 database, no persistence |
| **AWS EC2** | t2.micro (750h/month) | 1 year free, then paid |
| **CloudFlare** | Unlimited | Free CDN, DDoS protection |

**Production minimum:** Expect $50-100/month for:
- DigitalOcean droplet ($20-40)
- MongoDB Atlas M10 ($50-100)
- Redis Cloud ($10-30)

---

## 📚 Related Documents

- [QUICKSTART.md](../QUICKSTART.md) - Local development setup
- [01-system-architecture.md](01-system-architecture.md) - Architecture diagrams
- [02-request-flow.md](02-request-flow.md) - Request lifecycle
- [07-billing-flow.md](07-billing-flow.md) - Payment gateway setup (Stripe keys)
- [16-storage-location.md](16-storage-location.md) - File upload serving

---

## 🎯 Next Steps After Deployment

1. **Load Testing:** Verify can handle expected traffic (100 concurrent users minimum)
2. **Backup Verification:** Restore from backup to test recovery
3. **Monitoring:** Set up alerts (errors, high CPU, disk full)
4. **Security Scan:** Run `npm audit`, OWASP ZAP scan
5. **Performance:** Lighthouse scores, optimize frontend bundle
6. **Documentation:** Update USER_MANUAL.md with production URL
7. **Beta Testing:** Invite 5-10 real users, collect feedback

---

**Success Criteria:**
- ✅ No errors in PM2 logs for 24 hours
- ✅ Health endpoint returns 200 OK
- ✅ Can create tenant, login, create product
- ✅ Stripe webhook verified working (checkout)
- ✅ SSL certificate valid (no warnings)
- ✅ Disk usage <70%
- ✅ Memory usage <80%

---

**Deployment Complete! 🚀**
