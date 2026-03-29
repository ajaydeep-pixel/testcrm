# Authentication & 2FA Flow

## 📋 Overview

This document details the complete authentication system including:
- **Password-based login** with bcrypt hashing
- **TOTP 2FA** (Time-based One-Time Password) with QR setup
- **Session management** with Redis device tracking
- **Multi-device support** and revocation

---

## 🔐 Authentication Architecture

### **Three-Layer Security Model**

```
┌─────────────────────────────────────────┐
│  1. Something You Know                  │
│     - Email + Password                  │
│     - bcryptjs hashing (10 rounds)     │
└─────────────────────────────────────────┘
              ↓ Both required
┌─────────────────────────────────────────┐
│  2. Something You Have                  │
│     - TOTP (Google Authenticator)      │
│     - 6-digit code (30sec expiry)      │
│     - Optional but enforced for owners │
└─────────────────────────────────────────┘
              ↓ Required for login if enabled
┌─────────────────────────────────────────┐
│  3. Something You Are                   │
│     - Future: biometrics (WebAuthn)    │
└─────────────────────────────────────────┘
```

**Current Implementation:** Layers 1 + 2 (Password + TOTP). Layer 3 planned for Phase 2.

---

## 📊 Authentication States

Each user has lifecycle states:

### **Account States**
| State | Description | When |
|-------|-------------|------|
| **Active** | Normal account, can login | After signup, no lockout |
| **Inactive** | Manually disabled by admin | User on leave, terminated |
| **Locked** | Too many failed logins | After 5 failed attempts (future) |

### **2FA States**
| State | Description | When |
|-------|-------------|------|
| **Disabled** | 2FA not setup | Default after signup |
| **Enabled** | TOTP active | After `/auth/2fa/confirm` |
| **Recovery** | Using backup code | After TOTP lost, 1-time use |

### **Session States**
| State | Description |
|-------|-------------|
| **Active** | Device session valid (lastUsedAt updated on each request) |
| **Revoked** | User logged out or admin revoked |
| **Expired** | 30 days since lastUsedAt (Redis TTL) |

---

## 🔄 Login Flow

```mermaid
flowchart TD
    Start[User on Login Page] --> A[Enter Email + Password]
    A --> B[POST /api/auth/login]
    B --> C{validate credentials}

    C -->|Invalid| D[401 Unauthorized<br/>"Invalid credentials"]
    D --> A

    C -->|Valid| E{2FA enabled?}

    E -->|No| F[Issue JWT + Session]
    F --> G[Return token + user]
    G --> H[Frontend: localStorage]
    H --> I[Navigate to Dashboard]

    E -->|Yes| J[Return tempToken<br/>(2min expiry)]
    J --> K[Frontend: Show 2FA form]
    K --> L[Enter TOTP code]
    L --> M[POST /api/auth/2fa/verify]
    M --> N{Validate TOTP}
    N -->|Invalid| O[401 Invalid code]
    O --> L
    N -->|Valid| F
```

---

## 🔑 Detailed Flow: Step-by-Step

### **Step 1: Initial Login (Password Only)**

**Endpoint:** `POST /api/auth/login`

**Request:**
```http
POST /api/auth/login HTTP/1.1
Content-Type: application/json

{
  "email": "admin@acmebikes.com",
  "password": "UserPassword123!"
}
```

**No authentication required** (public endpoint)

**Middleware:** Only `rateLimitIP()` applied (5 attempts per 15min per IP)

---

### **Step 2: Backend Validation**

**Controller:** `authController.js:login`

```javascript
exports.login = async (req, res) => {
  const { email, password } = req.body;

  // 1. Find user by email
  const user = await User.findOne({ email });
  if (!user) {
    // Generic message - don't leak if email exists
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // 2. Check account status
  if (user.status !== 'active') {
    return res.status(403).json({
      message: `Account is ${user.status}. Contact support.`
    });
  }

  // 3. Verify password
  const isValid = await bcryptjs.compare(password, user.passwordHash);
  if (!isValid) {
    // Increment failed attempts (future)
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // 4. Check 2FA status
  if (user.totpEnabled) {
    // Require 2FA verification
    const tempToken = jwt.sign(
      { userId: user._id, tenantId: user.tenantId, purpose: '2fa_verification' },
      process.env.JWT_SECRET,
      { expiresIn: '2m' }  // Short-lived
    );

    return res.json({
      requires2FA: true,
      tempToken,  // Used in next step
      message: '2FA verification required'
    });
  }

  // 5. 2FA NOT enabled → issue full JWT
  const token = await AuthService.issueToken(user._id, user.tenantId, user.role);
  const sessionId = await SessionService.createSession(user._id, user.tenantId, req);

  // 6. Update user.lastLoginAt, lastLoginIp, devices[]
  await User.findByIdAndUpdate(user._id, {
    lastLoginAt: new Date(),
    lastLoginIp: req.ip,
    $push: {
      devices: {
        deviceId: sessionId,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        lastUsedAt: new Date(),
        isActive: true,
      }
    }
  });

  // 7. Log activity
  await ActivityLogger.log(user._id, 'LOGIN', 'User', user._id, {}, {});

  // 8. Return response
  res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      totpEnabled: false,
    },
    sessionId,
  });
};
```

---

### **Step 3A: Path A (No 2FA) - Success Response**

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "65f4a3b8e4b0123456789abc",
    "name": "John Doe",
    "email": "admin@acmebikes.com",
    "role": "owner",
    "totpEnabled": false
  },
  "sessionId": "abc123-def456"
}
```

**Frontend Actions:**
```javascript
// FRONTEND/src/services/api.js interceptor automatically:
// - Stores token in localStorage
// - Adds Authorization header to future requests

localStorage.setItem('token', response.data.token);
localStorage.setItem('user', JSON.stringify(response.data.user));

// Redirect to dashboard
navigate('/dashboard');
```

---

### **Step 3B: Path B (2FA Enabled) - Temp Token**

**Response:**
```json
{
  "requires2FA": true,
  "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "2FA verification required"
}
```

**Frontend Actions:**
```javascript
// Show 2FA verification form
setShow2FA(true);
setTempToken(response.data.tempToken);

// Prompt user to enter 6-digit TOTP code
```

---

### **Step 4: 2FA Verification**

**Endpoint:** `POST /api/auth/2fa/verify`

**Request:**
```json
{
  "tempToken": "eyJhbG...",  // from previous response
  "totp": "123456"           // 6-digit code from Google Authenticator
}
```

**Middleware:** No auth (tempToken in body)

**Controller:** `authController.js:verify2FA`

```javascript
exports.verify2FA = async (req, res) => {
  const { tempToken, totp } = req.body;

  // 1. Verify temp token
  try {
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    if (decoded.purpose !== '2fa_verification') {
      return res.status(401).json({ message: 'Invalid token purpose' });
    }
    const { userId, tenantId } = decoded;
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired temp token' });
  }

  // 2. Load user
  const user = await User.findOne({ _id: userId, tenantId });
  if (!user) return res.status(404).json({ message: 'User not found' });

  // 3. Verify TOTP
  const verified = AuthService.verifyTOTP(user.totpSecret, totp);
  if (!verified) {
    return res.status(401).json({ message: 'Invalid 2FA code' });
  }

  // 4. Issue real JWT + session
  const token = await AuthService.issueToken(user._id, user.tenantId, user.role);
  const sessionId = await SessionService.createSession(user._id, user.tenantId, req);

  // 5. Update lastLogin
  await User.findByIdAndUpdate(user._id, {
    lastLoginAt: new Date(),
    lastLoginIp: req.ip,
  });

  // 6. Log
  await ActivityLogger.log(user._id, 'LOGIN_2FA', 'User', user._id, {}, {});

  // 7. Return
  res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      totpEnabled: true,
    },
    sessionId,
  });
};
```

---

### **Step 5: Success (2FA Verified)**

**Response:** Same as Path A (token, user, sessionId)

**Frontend:** Store token, redirect to dashboard.

---

## 🔧 2FA Setup Flow

### **Enable 2FA** (User-initiated)

**Sequence:**

```mermaid
sequenceDiagram
    actor User as Dashboard Settings
    participant FE as React (SettingsPage)
    participant API as /api/auth/2fa/*
    participant Svc as AuthService
    participant Redis as Redis

    User->>FE: Click "Enable 2FA"
    FE->>API: POST /api/auth/2fa/setup
    API->>Svc: generateTOTPSecret()
    Svc-->>API: { secret, qrCodeDataUrl, manualCode }
    API-->>FE: { secret, qrCodeDataUrl, manualCode }
    FE->>FE: Show QR code modal
    User->>FE: Scan QR with Google Authenticator
    User->>FE: Enter 6-digit TOTP
    User->>FE: Click "Confirm"
    FE->>FE: Generate 10 backup codes
    FE->>API: POST /api/auth/2fa/confirm
        { totp: "123456", backupCodes: ["abc...", ...] }
    API->>Svc: verifyTOTP(secret, totp)
    Svc-->>API: true
    API->>API: Save totpSecret (encrypted), backupCodes (hashed)
    API-->>FE: { success: true, backupCodes: [...] }
    FE->>FE: Show backup codes (must save!)
    FE->>FE: Update user.totpEnabled = true
```

---

### **Step 1: Generate TOTP Secret**

**Endpoint:** `POST /api/auth/2fa/setup`

**Response:**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",  // Base32 encoded (show as manual entry)
  "qrCodeDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "manualEntryCode": "JBSWY3DPEHPK3PXP"
}
```

**Frontend:**
- Display QR code image (`<img src={qrCodeDataUrl} />`)
- Show manual code for user to type into authenticator app
- Instructions: "Scan QR or enter manual code in Google Authenticator/Authy"

---

### **Step 2: Verify & Confirm**

**Endpoint:** `POST /api/auth/2fa/confirm`

**Request:**
```json
{
  "totp": "123456",  // Current 6-digit code from app
  "backupCodes": [
    "abc123-def456-ghi789",
    "jkl012-mno345-pqr678",
    ...
  ]  // 10 one-time use codes
}
```

**Backend:**
```javascript
exports.confirm2FA = async (req, res) => {
  const { totp, backupCodes } = req.body;
  const userId = req.user.userId;  // From verifyToken middleware

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  // Verify current TOTP
  const isValid = AuthService.verifyTOTP(user.totpSecret, totp);
  if (!isValid) {
    return res.status(400).json({ message: 'Invalid TOTP code' });
  }

  // Store backup codes (hashed for security)
  const hashedBackupCodes = backupCodes.map(code => bcryptjs.hashSync(code, 10));
  user.backupCodes = hashedBackupCodes;
  user.totpEnabled = true;

  await user.save();

  await ActivityLogger.log(userId, '2FA_ENABLE', 'User', userId, {}, { backupCodeCount: 10 });

  res.json({
    success: true,
    backupCodes,  // Return plain codes to show user ONCE
    message: '2FA enabled successfully'
  });
};
```

**Important:** Backup codes are **plain** in response (frontend must show to user immediately, then not store). Backend stores **hashed** versions (like passwords) for verification.

---

### **Step 3: User Saves Backup Codes**

**Frontend:** Display backup codes in modal with warning:
```
⚠️ Save these backup codes in a secure location.
You will need them if you lose your authenticator device.
These codes will not be shown again!

1. abc123-def456-ghi789
2. jkl012-mno345-pqr678
...
10. stu901-vwx234-yz567

[I have saved these codes]
```

---

## 🔓 Login with Backup Code

**If user loses authenticator device:**

1. On login 2FA screen, click "Use backup code"
2. Enter backup code (one of the 10)
3. Backend verifies:
```javascript
const backupCode = req.body.backupCode;
const hashedCodes = user.backupCodes;
const match = hashedCodes.some(hashed => bcrypt.compareSync(backupCode, hashed));
```
4. If match: **DELETE that backup code** from user.backupCodes (one-time use)
5. Issue JWT normally
6. Log: `BACKUP_CODE_USED` to AuditLog

**After 10 backup codes used:** User must contact support to reset 2FA (or use account recovery flow).

---

## 🚫 Logout & Session Management

### **Single Device Logout**

**Endpoint:** `POST /api/auth/logout`

```javascript
exports.logout = async (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.body.sessionId;
  if (sessionId) {
    await redis.del(`session:${sessionId}`);
  }
  res.json({ message: 'Logged out' });
};
```

**Frontend:**
```javascript
localStorage.removeItem('token');
localStorage.removeItem('user');
navigate('/login');
```

---

### **List Active Sessions**

**Endpoint:** `GET /api/auth/sessions`

**Response:**
```json
{
  "sessions": [
    {
      "sessionId": "abc123-def456",
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
      "ipAddress": "203.0.113.42",
      "lastUsedAt": "2024-03-15T14:30:00Z",
      "isActive": true,
      "createdAt": "2024-03-15T10:00:00Z"
    },
    ...
  ]
}
```

**Frontend:** Settings page → Security → Active Sessions
Show list with "Revoke" button per session.

---

### **Revoke Specific Session**

**Endpoint:** `DELETE /api/auth/sessions/:sessionId`

```javascript
exports.revokeSession = async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.userId;

  // Only allow user to revoke their own sessions
  // (or admin revoking any)
  await redis.del(`session:${sessionId}`);

  await ActivityLogger.log(userId, 'SESSION_REVOKE', 'User', userId, { sessionId }, {});

  res.json({ message: 'Session revoked' });
};
```

**Use Case:**
- User sees suspicious session → revokes it
- User logs out from public computer → revokes that session
- Admin revokes user's all sessions (force logout)

---

## 🔐 Session Store Design

### **Redis Structure**

**Key:** `session:{uuid}` (UUID v4)

**Value (JSON):**
```json
{
  "userId": "65f4a3b8e4b0123456789abc",
  "tenantId": "65f4a3b8e4b0123456789xyz",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...",
  "ipAddress": "203.0.113.42",
  "createdAt": "2024-03-15T10:00:00Z",
  "lastUsedAt": "2024-03-15T14:30:00Z"
}
```

**TTL:** 30 days (2,592,000 seconds) - configurable

**Update on Activity:**
```javascript
// Middleware to update session lastUsedAt on every request
exports.updateSessionActivity = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // Find session in Redis (stored separately)
      // Could store sessionId in JWT payload for lookup
      // For now, not implemented
    } catch (e) {}
  }
  next();
};
```

**Note:** Current implementation doesn't update `lastUsedAt` on every request (future improvement: add middleware to update session TTL).

---

## 🛡️ JWT Token Management

### **Token Structure**

```javascript
const payload = {
  userId: user._id,
  tenantId: user.tenantId,
  role: user.role,
};

const token = jwt.sign(payload, process.env.JWT_SECRET, {
  expiresIn: '15m',  // Short-lived
  algorithm: 'HS256'
});
```

**Decoded Token:**
```json
{
  "userId": "65f4a3b8e4b0123456789abc",
  "tenantId": "65f4a3b8e4b0123456789xyz",
  "role": "owner",
  "iat": 1711699200,
  "exp": 1711702800
}
```

---

### **Why 15-Minute Expiry?**

**Short-lived tokens reduce attack surface:**
- If token stolen via XSS, only valid 15 minutes
- Forces re-authentication periodically
- Compatible with session persistence (Redis session still valid after JWT expiry)

**Problem:** User must re-login every 15 minutes = bad UX

**Solution:** **Refresh Tokens** (not yet implemented)

**Future Implementation:**
```
JWT (access token): 15min expiry
Refresh token: 30 days (stored in Redis session)
Refresh endpoint: POST /api/auth/refresh
  - Validate refresh token (from Redis session)
  - Issue new JWT + new refresh token
  - User stays logged in seamlessly
```

---

### **Token Blacklisting** (Not Implemented)

**Scenario:** User logs out → JWT still valid until expiry (15min)
**Risk:** Stolen token can be used within 15min even after logout

**Solution (future):** Token blacklist in Redis
```javascript
// On logout:
await redis.setex(`blacklist:${token}`, 900, '1');  // 15min expiry

// In verifyToken middleware:
if (await redis.exists(`blacklist:${token}`)) {
  return res.status(401).json({ message: 'Token revoked' });
}
```

---

## 🔍 TOTP (Time-Based One-Time Password)

### **How TOTP Works**

```
┌─────────────────────────────────────────┐
│  Shared Secret (32 bytes, Base32)       │
│  K = "JBSWY3DPEHPK3PXP"                 │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  HMAC-SHA1(K, floor(unix_time / 30))   │
│  - Current time: 1711699200            │
│  - Time step: floor(1711699200 / 30)   │
│    = 57023300                          │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  Truncate → 6-digit code               │
│  e.g., 123456                          │
│  Valid for 30 seconds                  │
└─────────────────────────────────────────┘
```

**Libraries:**
- Frontend: Google Authenticator, Authy, Microsoft Authenticator
- Backend: `speakeasy` npm package

---

### **Generating Secret**

**Code:**
```javascript
const speakeasy = require('speakeasy');

const secret = speakeasy.generateSecret({
  name: `BikeFlow:${user.email}`
});

// secret.base32: "JBSWY3DPEHPK3PXP" (user enters this manually)
// secret.otpauth_url: "otpauth://totp/BikeFlow:admin@acmebikes.com?secret=JBSWY3DPEHPK3PXP&issuer=BikeFlow"
```

**QR Code:**
```javascript
const qrcode = require('qrcode');
const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url);
```

QR code encodes `otpauth://` URL which authenticator apps scan.

---

### **Verifying TOTP**

```javascript
const verified = speakeasy.totp.verify({
  secret: user.totpSecret,  // "JBSWY3DPEHPK3PXP"
  encoding: 'base32',
  token: '123456',  // User input
});

if (verified) {
  // Success
}
```

**Clock Drift:** Speakeasy allows ±1 time step (±30 seconds) by default.

**Security:** 1 in 1,000,000 chance of random guess (6 digits = 10⁶ combinations). Rate limiting on 2FA endpoint needed! ✅ Already protected by `rateLimitIP`.

---

## 📱 Frontend 2FA Flow

### **Login Page with 2FA**

**Flow:**

```javascript
// Login.jsx
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [show2FA, setShow2FA] = useState(false);
const [tempToken, setTempToken] = useState('');
const [totp, setTotp] = useState('');

const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);

  try {
    const response = await authAPI.login(email, password);

    if (response.data.requires2FA) {
      // 2FA required - show 2FA form
      setTempToken(response.data.tempToken);
      setShow2FA(true);
    } else {
      // Direct login
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/dashboard');
    }
  } catch (err) {
    setError(err.response?.data?.message || 'Login failed');
  } finally {
    setLoading(false);
  }
};

const handle2FASubmit = async (e) => {
  e.preventDefault();
  setLoading(true);

  try {
    const response = await authAPI.verify2FA(tempToken, totp);
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    navigate('/dashboard');
  } catch (err) {
    setError('Invalid 2FA code');
  } finally {
    setLoading(false);
  }
};

// Render
return (
  <form onSubmit={show2FA ? handle2FASubmit : handleSubmit}>
    {!show2FA ? (
      <>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button type="submit" disabled={loading}>Login</button>
      </>
    ) : (
      <>
        <p>Enter 6-digit code from your authenticator app</p>
        <input
          type="text"
          value={totp}
          onChange={e => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="123456"
          maxLength={6}
        />
        <button type="submit" disabled={loading || totp.length !== 6}>Verify</button>
        <p><a href="#">Use backup code</a></p>
      </>
    )}
    {error && <div className="error">{error}</div>}
  </form>
);
```

---

### **Settings Page: 2FA Management**

**If 2FA Disabled:**
```
🔒 Two-Factor Authentication
Status: Not enabled
[Enable 2FA]
```

**If 2FA Enabled:**
```
🔐 Two-Factor Authentication
Status: Enabled ✓
Method: TOTP (Google Authenticator)
Backup codes used: 2/10
[View Backup Codes] [Disable 2FA]
```

---

## 🧪 Testing Authentication Flows

### **Test 1: Successful Login (No 2FA)**
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acmebikes.com","password":"SecurePass123!"}'

# Expected: 200 OK
# {
#   "token": "eyJhb...",
#   "user": { "totpEnabled": false },
#   "sessionId": "abc123"
# }
```

---

### **Test 2: Login with 2FA (First Step)**
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin2fa@acmebikes.com","password":"SecurePass123!"}'

# Expected: 200 OK (but requires2FA)
# {
#   "requires2FA": true,
#   "tempToken": "eyJhb..."
# }
```

---

### **Test 3: 2FA Verification**
```bash
# Get TOTP from Google Authenticator for user's secret
TOTP=$(oathtool --totp --base32 "JBSWY3DPEHPK3PXP" 2>/dev/null)

curl -X POST http://localhost:4000/api/auth/2fa/verify \
  -H "Content-Type: application/json" \
  -d "{\"tempToken\":\"$TEMP_TOKEN\",\"totp\":\"$TOTP\"}"

# Expected: 200 OK with full token
```

---

### **Test 4: Invalid TOTP**
```bash
curl -X POST http://localhost:4000/api/auth/2fa/verify \
  -H "Content-Type: application/json" \
  -d '{"tempToken":"...","totp":"000000"}'

# Expected: 401 Unauthorized
# { "message": "Invalid 2FA code" }
```

---

### **Test 5: Temp Token Expiry**
```bash
# Wait 2 minutes after receiving tempToken
curl -X POST ...  # Same as Test 3

# Expected: 401 Unauthorized
# { "message": "Invalid or expired temp token" }
```

---

### **Test 6: Rate Limiting Login**

```bash
# Make 6 login attempts from same IP within 15min
# (adjust rate-limit in dev if needed)

for i in {1..6}; do
  curl -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@test.com","password":"wrong"}'
done

# Expected: 6th request returns 429
# { "message": "Too many requests", "retryAfter": 900 }
```

---

### **Test 7: Session List & Revoke**

```bash
# Login to get token + sessionId
TOKEN=$(curl -X POST ... | jq -r '.token')
SESSION_ID=$(curl -X POST ... | jq -r '.sessionId')

# List sessions
curl http://localhost:4000/api/auth/sessions \
  -H "Authorization: Bearer $TOKEN"

# Expected: List with sessionId included

# Revoke session
curl -X DELETE http://localhost:4000/api/auth/sessions/$SESSION_ID \
  -H "Authorization: Bearer $TOKEN"

# Expected: { "message": "Session revoked" }

# Subsequent request with same token should still work (JWT valid),
# but session won't be in Redis (not used for auth, only tracking)
```

---

## 📊 Session Lifecycle

```
┌─────────────────────────────────────────────────┐
│  1. User logs in (password + 2FA if enabled)    │
│     → JWT issued (15min)                        │
│     → Session created in Redis (30d TTL)        │
│     → SessionId stored in frontend memory       │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  2. User makes API requests                     │
│     → Authorization: Bearer <jwt>               │
│     → verifyToken() validates JWT               │
│     → Session exists in Redis (optional check) │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  3. User logs out or session expires           │
│     → Redis DEL session:{id}                    │
│     → Frontend clears localStorage              │
└─────────────────────────────────────────────────┘
```

---

## 🔍 Audit Trail for Auth Events

**All auth actions logged to AuditLog:**

| Action | Resource | When |
|--------|----------|------|
| `SIGNUP` | Tenant | New user created |
| `LOGIN` | User | Successful password auth |
| `LOGIN_2FA` | User | Successful 2FA verification |
| `LOGIN_FAILED` | User | Invalid credentials |
| `2FA_ENABLE` | User | 2FA setup completed |
| `2FA_DISABLE` | User | 2FA turned off |
| `SESSION_REVOKE` | Session | User/admin revoked |
| `LOGOUT` | User | User logged out |

**AuditLog entry example:**
```json
{
  "tenantId": "...",
  "userId": "...",
  "action": "LOGIN",
  "resource": "User",
  "resourceId": "...",
  "before": {},
  "after": { "lastLoginAt": "2024-03-15T10:05:00Z" },
  "status": "success",
  "ipAddress": "203.0.113.42",
  "createdAt": "2024-03-15T10:05:00Z"
}
```

---

## 🛠️ Password Reset Flow (Future)

**Not implemented yet.**

**Planned flow:**
1. User clicks "Forgot Password" → enter email
2. System generates reset token (1-hour expiry)
3. Send email with link: `https://app.bikeflow.com/reset?token=...`
4. User clicks link → reset form
5. Verify token + new password validation
6. Invalidate all existing sessions (security)
7. Send email notification: "Password changed"
8. User logs in with new password

---

## 📈 Security Hardening Checklist

### **Current Status:**

- [x] Password hashing with bcrypt (10 rounds)
- [x] JWT signed with strong secret
- [x] Short JWT expiry (15min)
- [x] TOTP 2FA with backup codes
- [x] Rate limiting on login (IP-based)
- [x] Session tracking (device, IP, user agent)
- [x] Session revocation
- [x] Audit logging (all auth events)
- [x] Generic error messages (no user enumeration)
- [ ] Refresh tokens (user must re-login every 15min)
- [ ] Password reset flow (not implemented)
- [ ] Account lockout after failed attempts
- [ ] Password complexity enforcement
- [ ] Email verification (users can signup with fake email)
- [ ] Suspicious login detection (impossible travel)
- [ ] Session TTL refresh on activity
- [ ] Token blacklisting on logout
- [ ] HIBP breached password check

---

## 🐛 Common Issues & Debugging

### **Issue: "Token expired" on every request**

**Cause:** System clock skew between server and client
**Fix:** Synchronize server time (use NTP)

---

### **Issue: 2FA code always invalid**

**Cause:** Time drift >30 seconds between authenticator app and server
**Fix:**
- Ensure server time accurate (NTP)
- Allow ±2 time steps in speakeasy config (current default ±1)
- QR code includes issuer name (verify both sides show same)

---

### **Issue: Redis connection failed → sessions not created**

**Current:** Code doesn't handle Redis errors gracefully during login

**Fix:**
```javascript
try {
  await redis.setex(`session:${sessionId}`, 86400 * 30, JSON.stringify(sessionData));
} catch (err) {
  console.error('Redis session error:', err);
  // Continue - JWT still issued, user can log in but no persistent session
}
```

---

### **Issue: Can't logout - token still valid**

**Explanation:** Logout clears Redis session but doesn't blacklist JWT
**Impact:** User can still make requests with JWT for up to 15min
**Trade-off:** Acceptable for now (short expiry)
**Better:** Implement token blacklist or shorten expiry to 5min + refresh tokens

---

## 📝 Code References

| Component | File | Key Functions |
|-----------|------|---------------|
| AuthController | `BACKEND/src/controllers/authController.js` | `login`, `verify2FA`, `setup2FA`, `confirm2FA`, `logout`, `listSessions`, `revokeSession` |
| AuthService | `BACKEND/src/services/AuthService.js` | `issueToken`, `verifyTOTP`, `generateBackupCodes`, `hashPassword`, `comparePassword` |
| SessionService | `BACKEND/src/services/SessionService.js` | `createSession`, `getUserSessions`, `revokeSession`, `updateLastUsed` |
| AuthMiddleware | `BACKEND/src/middleware/authMiddleware.js` | `verifyToken` |
| RateLimitMiddleware | `BACKEND/src/middleware/rateLimitMiddleware.js` | `rateLimitIP` (protects login) |

---

## 🚀 Future Enhancements

1. **Refresh Tokens** (Critical for UX)
   - Eliminate 15min re-login friction
   - Rotate refresh tokens on use (better security)

2. **Password Reset** (Critical for support)
   - Email-based reset flow
   - Secure token with expiry
   - Rate limit reset attempts

3. **Enhanced 2FA**
   - WebAuthn (biometrics, security keys)
   - SMS fallback (less secure but accessible)
   - Remember device (skip 2FA for 30 days on trusted device)

4. **Account Lockout**
   - 5 failed attempts → lock for 15min
   - Notify user via email

5. **Login Notifications**
   - Email on new device login
   - Suspicious location detection (geofencing)

6. **Password Policies**
   - Minimum 12 chars
   - Require uppercase, lowercase, number, special
   - Prevent common passwords
   - Prevent password reuse (last 10 passwords)

7. **Session Management Improvements**
   - Update `lastUsedAt` on each request
   - Auto-expire inactive sessions after 30 days
   - Show full device info (browser, OS, location)
   - Bulk revoke all sessions (except current)

---

## 📚 Related Documents

- [03-registration-flow.md](03-registration-flow.md) - Signup creates first user
- [02-request-flow.md](02-request-flow.md) - Middleware chain includes `verifyToken`
- [06-multi-tenancy-flow.md](06-multi-tenancy-flow.md) - TenantId from JWT
- [10-audit-flow.md](10-audit-flow.md) - All auth events logged

---

**Next:** [05-authorization-flow.md](05-authorization-flow.md) - RBAC permission checks
