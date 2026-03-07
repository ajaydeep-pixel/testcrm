# Redis Setup Guide

BikeFlow uses Redis for:
- Session management (device tracking, fast lookups)
- Rate-limiting (API limits per plan)
- Usage metering (monthly usage counters)

## Development Mode (Automatic Fallback)

**Good news**: If Redis is not running, the app automatically falls back to an in-memory store for development.

```bash
cd BACKEND
npm run dev
```

You'll see:
```
⚠️ Redis unavailable, using in-memory store for development
```

This works fine for local development, but data won't persist across server restarts.

---

## Production Mode (Recommended: Real Redis)

### Option 1: Docker (Easiest)

```bash
# Start Redis container
docker run -d -p 6379:6379 --name redis redis:latest

# Or with persistent storage
docker run -d -p 6379:6379 --name redis -v redis-data:/data redis:latest
```

### Option 2: Install Redis Locally

#### Windows (using WSL 2 or Chocolatey)

```powershell
# Using Chocolatey
choco install redis-64

# Or download from: https://github.com/microsoftarchive/redis/releases
```

Then start it:
```powershell
redis-server
```

#### macOS

```bash
# Using Homebrew
brew install redis

# Start Redis
redis-server
```

#### Linux (Ubuntu/Debian)

```bash
sudo apt-get install redis-server

# Start Redis
sudo service redis-server start
```

### Option 3: Cloud Redis (AWS, Azure, etc.)

Use a cloud Redis service and set the environment variable:

```bash
# In .env
REDIS_URL=redis://user:password@hostname:6379
```

---

## Verify Redis is Running

```bash
# Install redis-cli (Redis command-line tool)
redis-cli

# In redis-cli, test connection
> ping
PONG
```

Or check with curl:
```bash
curl -i telnet://localhost:6379
```

---

## Configuration

### Environment Variables

```env
# .env file
REDIS_URL=redis://localhost:6379

# For cloud Redis (e.g., AWS ElastiCache with password)
REDIS_URL=redis://default:password@host:6379
```

---

## Troubleshooting

### "Connection Refused" Error

```
Redis Client Error AggregateError [ECONNREFUSED]
```

**Solution**: Remove `.env` Redis URL or make sure Redis is running:

```bash
# Check if Redis is listening
netstat -an | grep 6379
# or
lsof -i :6379
```

### "Max retries exceeded"

Redis is not available. Either:
1. Start Redis: `redis-server`
2. Or let the app use in-memory store (happens automatically)

### Memory Issues with In-Memory Store

If using in-memory fallback in production, sessions/limits will be lost on restart. **Always use real Redis in production.**

---

## Monitoring Redis

```bash
# Monitor command (see all Redis calls in real-time)
redis-cli monitor

# Check memory usage
redis-cli info memory

# Check connected clients
redis-cli info clients

# List all keys
redis-cli keys '*'

# Flush all data (be careful!)
redis-cli flushall
```

---

## Development vs. Production

| Aspect | Development | Production |
|---|---|---|
| Redis Required | ❌ No (fallback to memory) | ✅ **Yes (required)** |
| Data Persistence | ❌ Lost on restart | ✅ Persists |
| Rate-Limits | Per-request CPU | O(1) Redis ops |
| Session Storage | JSON in memory | Distributed Redis |
| Cost | Free | $5-50/mo (cloud) |

---

For local development, the in-memory fallback is fine. For production and team testing, set up real Redis.

**Need help?** Check the main [README.md](../README.md) or [PHASE_0_SUMMARY.md](../PHASE_0_SUMMARY.md).
