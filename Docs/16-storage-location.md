# Storage Location Configuration

## 📋 Overview

This document details how BikeFlow stores and serves files including product images, invoice PDFs, and other user-uploaded content.

---

## 🗂️ Current Storage Architecture

### **Local File System Storage**

**Location:** `BACKEND/uploads/`

```
BACKEND/
├── app.js
├── src/
├── uploads/          ← All uploaded files stored here
│   ├── products/
│   │   ├── abc123-def456.png
│   │   └── ghi789-jkl012.jpg
│   ├── invoices/
│   │   ├── invoice-1711699200000-1234.pdf
│   │   └── invoice-1711699300000-5678.pdf
│   └── temp/
│       └── upload-12345.tmp
└── ...
```

**Serving:** Static middleware in `app.js`:
```javascript
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```

**Access URL:** `http://localhost:4000/uploads/products/abc123-def456.png`

---

## 📁 Storage Directory Structure

### **Purpose-Based Organization**

```
uploads/
├── products/          Product images (optimized, max 2MB)
│   ├── {filename}    → Publicly accessible (via /uploads/products/*)
│   └── thumbnails/   → Resized versions (future)
├── invoices/          Generated invoice PDFs
│   └── {invoiceNumber}.pdf
├── receipts/          Payment receipts (future)
├── avatars/           User profile pictures (future)
├── temp/              Temporary uploads (auto-clean after 24h)
└── backups/           Database backups (future)
```

**Rationale:**
- Organization by domain makes cleanup efficient
- Can apply different retention policies per folder
- Easy to migrate to cloud storage by replicating this structure

---

## 📤 File Upload Flow

### **Current Implementation: Multer**

**Package:** `multer 1.4.5-lts.1` (middleware for handling `multipart/form-data`)

**Example: Product Image Upload**

**Frontend:**
```javascript
// Form with file input
<input type="file" name="image" accept="image/*" onChange={handleFileSelect} />

// POST to backend with FormData
const formData = new FormData();
formData.append('image', file);  // File object from input
formData.append('name', 'Brake Pad Set');
formData.append('price', 49.99);

await productsAPI.createProduct(formData);  // Note: not JSON!
```

**Backend Route:**
```javascript
// productRoutes.js
const multer = require('multer');
const path = require('path');

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/products'));
  },
  filename: (req, file, cb) => {
    // Generate unique filename: {uuid}.{ext}
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },  // 2MB max
  fileFilter: (req, file, cb) => {
    // Only images
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only images allowed'), false);
    }
    cb(null, true);
  }
});

router.post(
  '/',
  protectedStack,
  authorize('Product', 'CREATE'),
  upload.single('image'),  // ← Multer processes file before controller
  productController.create
);
```

**Controller Access:**
```javascript
exports.create = async (req, res) => {
  // req.file contains file info (if uploaded)
  // req.body contains other form fields
  const { name, price, brandId, categoryId } = req.body;

  let imageUrl = null;
  if (req.file) {
    imageUrl = `/uploads/products/${req.file.filename}`;  // Public URL
  }

  const product = new Product({
    name,
    price,
    brandId,
    categoryId,
    imageUrl,
    tenantId: req.tenantId,
  });

  await product.save();
  res.status(201).json(product);
};
```

---

## 🔐 Security Considerations

### **1. Tenant Isolation for Files**

**Problem:** Local file storage doesn't enforce tenant isolation at filesystem level.

**Risk:**
```
/uploads/products/tenant-a-image.jpg   ← Tenant A's image
/uploads/products/tenant-b-image.jpg   ← Tenant B's image

Both accessible via direct URL guessing if filenames predictable.
```

**Current Mitigation:**
- Filenames are UUIDs (`abc123-def456.png`) - not guessable
- No public directory listing (express.static doesn't list)
- But if someone discovers URL, they can access any image

**Attack Scenario:**
1. Tenant A uploads `product-image.jpg` → stored as `uploads/products/uuid1.jpg`
2. Tenant B guesses URL: `http://api/uploads/products/uuid1.jpg` → **works!** (no auth check)

**Solution Options:**

**Option A: Authenticated file serving** (recommended for sensitive files)
```javascript
// Replace express.static with authenticated route
router.get('/uploads/:type/:filename', verifyToken, async (req, res) => {
  const { type, filename } = req.params;

  // Verify tenant has permission to access this file
  // Check database: does a Product with this imageUrl belong to req.tenantId?

  const filePath = path.join(__dirname, '../uploads', type, filename);
  res.sendFile(filePath);
});
```

**Option B: Store tenantId in filename or subdirectory**
```
uploads/
├── products/
│   ├── {tenantId}/
│   │   ├── {uuid}.jpg
│   │   └── {uuid}.jpg
```
Then static middleware checks path prefix? Not secure without auth middleware.

**Option C: Move to cloud storage with signed URLs**
- AWS S3 with per-tenant prefixes + signed URLs
- CloudFlare R2
- Cloudinary

**Recommended:** Use **Option A** for now (protect uploads route with auth), migrate to S3 long-term.

---

### **2. File Type Validation**

**Current:** `fileFilter` checks `file.mimetype.startsWith('image/')`

**Issue:** MIME type can be spoofed (client sends `image/jpeg` but file is actually script).

**Better:**
```javascript
const fileType = require('file-type');  // npm package

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: async (req, file, cb) => {
    // 1. Check extension
    const allowedExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExt.includes(ext)) {
      return cb(new Error('Invalid file extension'), false);
    }

    // 2. Check actual magic bytes (more reliable)
    const buffer = await fs.promises.readFile(file.path);  // File already written to temp
    const type = await fileType.fromBuffer(buffer);
    if (!type || !type.mime.startsWith('image/')) {
      // Delete the file
      await fs.promises.unlink(file.path);
      return cb(new Error('File is not a valid image'), false);
    }

    cb(null, true);
  }
});
```

---

### **3. File Size Limits**

**Current:** `limits: { fileSize: 2 * 1024 * 1024 }` (2MB)

**Enforced by Multer** before writing to disk.

**Error handling:**
```javascript
// Multer error middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large (max 2MB)' });
    }
  }
  next(err);
});
```

---

### **4. Directory Traversal Prevention**

**Risk:** User submits filename with `../../../etc/passwd`

**Multer diskStorage sanitizes filename** but still validate:

```javascript
filename: (req, file, cb) => {
  // UUID only - no user input in filename
  const ext = path.extname(file.originalname).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
    return cb(new Error('Invalid extension'), null);
  }
  const filename = `${uuidv4()}${ext}`;  // No user-controlled path
  cb(null, filename);
}
```

---

## 💾 Usage Metering for Storage

**Track storage usage per tenant per month:**

```javascript
// In product controller when uploading image
const fileStats = await fs.promises.stat(filePath);
const fileSizeMB = fileStats.size / (1024 * 1024);

await redis.incrby(
  `usage:${tenantId}:storage_mb:${monthKey}`,
  Math.ceil(fileSizeMB)  // Round up to nearest MB
);
```

**On image deletion (product delete):**
```javascript
if (product.imageUrl) {
  const filePath = path.join(__dirname, '..', product.imageUrl);
  await fs.promises.unlink(filePath);  // Delete file

  // Decrement usage (approximate)
  const fileSizeMB = Math.ceil(fileStats.size / (1024 * 1024));
  await redis.decrby(`usage:${tenantId}:storage_mb:${monthKey}`, fileSizeMB);
}
```

**Note:** Exact decrementing is approximate (need to store file size separately). Simpler: don't decrement - usage tracks cumulative uploads (not deletions). For accurate storage calculation, periodically scan filesystem and compute actual size.

---

## 🔄 File Migration to Cloud Storage (Future)

### **Why Migrate?**

Local filesystem limitations:
- ❌ No CDN (slow downloads for distant users)
- ❌ No backups (unless manually configured)
- ❌ Single server (can't scale horizontally)
- ❌ No versioning (recover from accidental delete)
- ❌ Cannot share files between backend instances (if load balanced)

---

### **Migration Strategy: AWS S3**

**Step 1: Install SDK**
```bash
cd BACKEND
npm install aws-sdk
```

**Step 2: Configure**
```javascript
// config/s3.js
const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  signatureVersion: 'v4',
});

module.exports = s3;
```

**Step 3: Update Upload Middleware**

```javascript
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const s3 = require('../config/s3');

const upload = multer({
  storage: multer.memoryStorage(),  // Store in memory, upload to S3 directly
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Validate as before
    cb(null, true);
  }
});

router.post('/', upload.single('image'), async (req, res) => {
  if (req.file) {
    // Upload to S3
    const key = `products/${req.tenantId}/${uuidv4()}${path.extname(req.file.originalname)}`;
    await s3.putObject({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: 'private',  // Only accessible via signed URLs
    }).promise();

    // Generate signed URL (valid 1 hour)
    const url = s3.getSignedUrl('getObject', {
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Expires: 3600,
    });

    // Store S3 key in DB (not full URL)
    product.imageS3Key = key;
  }

  // ... save product
});
```

**Step 4: Serve Files via Signed URLs**

```javascript
// GET /api/products/:id/image
router.get('/products/:id/image', verifyToken, async (req, res) => {
  const product = await Product.findOne({
    _Id: req.params.id,
    $or: [{ tenantId: req.tenantId }, { tenantId: null }]
  });

  if (!product || !product.imageS3Key) {
    return res.status(404).json({ message: 'Image not found' });
  }

  // Generate fresh signed URL (valid 1 hour)
  const url = s3.getSignedUrl('getObject', {
    Bucket: process.env.S3_BUCKET,
    Key: product.imageS3Key,
    Expires: 3600,
  });

  res.json({ url });
});
```

**Frontend:**
```javascript
// Load image via signed URL
const { data } = await api.get(`/api/products/${productId}/image`);
// data.url is signed URL, use <img src={data.url} />
```

---

### **Alternative: CloudFlare R2**

- Same S3-compatible API
- No egress fees (cheaper for high traffic)
- Global CDN built-in

---

## 📦 Invoice PDF Generation

### **Current State: Not Implemented**

**Planned:** Generate PDF invoices using `pdfkit` or `puppeteer`.

**Storage location:** `uploads/invoices/{invoiceNumber}.pdf`

**Flow:**
1. Sale created → `Invoice` document created
2. Background job (BullMQ) generates PDF
3. PDF uploaded to S3/local
4. `invoice.pdfUrl` stored in DB
5. User can download from dashboard

**Implementation (future):**
```javascript
const PDFDocument = require('pdfkit');

async function generateInvoicePDF(invoice) {
  const doc = new PDFDocument();
  const buffers = [];

  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', async () => {
    const pdfBuffer = Buffer.concat(buffers);

    // Upload to S3 or local
    const filename = `invoices/${invoice.invoiceNumber}.pdf`;
    await s3.putObject({
      Bucket: process.env.S3_BUCKET,
      Key: filename,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    }).promise();

    // Update invoice
    await Invoice.findByIdAndUpdate(invoice._id, { pdfUrl: filename });
  });

  // Render PDF content
  doc.fontSize(25).text('Invoice', { align: 'center' });
  doc.text(`Invoice #: ${invoice.invoiceNumber}`);
  doc.text(`Date: ${invoice.createdAt.toISOString().split('T')[0]}`);
  // ... more content

  doc.end();
}
```

---

## 🧹 Cleanup & Maintenance

### **Orphaned Files**

Problem: Product deleted but image file remains on disk.

**Solution 1: Manual cleanup script**
```javascript
// scripts/cleanup-orphaned-files.js
const fs = require('fs');
const path = require('path');
const Product = require('../src/models/Product');

async function cleanup() {
  // 1. Get all referenced image URLs from DB
  const products = await Product.find({}, 'imageUrl');
  const referencedFiles = new Set(
    products.map(p => p.imageUrl).filter(Boolean)
  );

  // 2. Scan filesystem
  const uploadsDir = path.join(__dirname, '../uploads/products');
  const files = await fs.promises.readdir(uploadsDir);

  // 3. Delete unreferenced
  for (const file of files) {
    const relativePath = `/uploads/products/${file}`;
    if (!referencedFiles.has(relativePath)) {
      await fs.promises.unlink(path.join(uploadsDir, file));
      console.log(`Deleted orphan: ${file}`);
    }
  }
}

cleanup();
```

**Schedule:** Run weekly via cron.

---

### **Temp Files Cleanup**

`uploads/temp/` should auto-delete after 24 hours:

```javascript
// scripts/cleanup-temp.js
const fs = require('fs');
const path = require('path');

async function cleanupTemp() {
  const tempDir = path.join(__dirname, '../uploads/temp');
  const files = await fs.promises.readdir(tempDir);

  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  for (const file of files) {
    const filePath = path.join(tempDir, file);
    const stat = await fs.promises.stat(filePath);
    if (stat.mtimeMs < oneDayAgo) {
      await fs.promises.unlink(filePath);
      console.log(`Deleted temp file: ${file}`);
    }
  }
}

cleanupTemp();
```

**Schedule:** Run hourly via cron.

---

## 📊 Storage Quotas

**From Plan model (Plan.limits):**

```javascript
{
  "trial": {
    "storageMB": 500  // 500 MB total
  },
  "basic": {
    "storageMB": 5000  // 5 GB total
  },
  "pro": {
    "storageMB": 50000  // 50 GB total
  },
  "enterprise": {
    "storageMB": -1  // Unlimited (or custom contract)
  }
}
```

**Enforcement:**
```javascript
// Before allowing upload
const currentUsage = await redis.get(`usage:${tenantId}:storage_mb:${monthKey}`) || 0;
const limit = plan.limits.storageMB;

if (limit !== -1 && currentUsage + requestedFileSizeMB > limit) {
  return res.status(403).json({
    message: `Storage limit exceeded. Current: ${currentUsage}MB, Limit: ${limit}MB`
  });
}
```

---

## 🔒 Permissions for File Operations

**Only authorized users can upload/delete files.**

**Upload:** Route protected by `authorize('Product', 'CREATE')` or `UPDATE`

**Delete:** When product deleted, image file also deleted (controller handles).

```javascript
exports.remove = async (req, res) => {
  const product = await Product.findOneAndDelete({
    _id: req.params.id,
    tenantId: req.tenantId
  });

  if (product && product.imageUrl) {
    // Delete file from disk/S3
    const filePath = path.join(__dirname, '..', product.imageUrl);
    await fs.promises.unlink(filePath).catch(() => {});  // Ignore if already deleted
  }

  res.json({ message: 'Product deleted' });
};
```

---

## 📈 Monitoring Storage

### **Metrics to Track**

| Metric | How to Collect | Alert Threshold |
|--------|----------------|-----------------|
| Total disk usage | `du -sh uploads/` | >80% of disk capacity |
| Files per tenant | Count by tenantId from Product.imageUrl | Single tenant >10,000 files (abuse?) |
| Upload rate | Count new files/hour | Spike >10x baseline |
| Upload failures | Multer errors | >5% of upload attempts fail |

---

### **Dashboard Queries**

```javascript
// Get tenant's storage usage
const products = await Product.find({ tenantId });
let totalSizeMB = 0;

for (const p of products) {
  if (p.imageUrl) {
    const filePath = path.join(__dirname, '..', p.imageUrl);
    const stat = await fs.promises.stat(filePath);
    totalSizeMB += stat.size / (1024 * 1024);
  }
}

console.log(`Tenant ${tenantId} uses ${totalSizeMB.toFixed(2)} MB`);
```

---

## 🚀 Recommended Improvements (Priority Order)

### **1. Protect `/uploads` Route with Auth** (Critical - Security)

**Current:** Anyone with URL can access any file.

**Fix:** Use authenticated route:
```javascript
// Replace express.static
router.get('/uploads/:type/:filename', verifyToken, async (req, res, next) => {
  const { type, filename } = req.params;

  // Only allow access to files belonging to this tenant
  const filePath = path.join(__dirname, '../uploads', type, filename);

  // Check if file is associated with tenant
  if (type === 'products') {
    const product = await Product.findOne({
      imageUrl: `/uploads/products/${filename}`,
      $or: [{ tenantId: req.tenantId }, { tenantId: null }]
    });
    if (!product) {
      return res.status(404).json({ message: 'File not found' });
    }
  }
  // Add similar checks for invoices, etc.

  res.sendFile(filePath);
});
```

---

### **2. Migrate to Cloud Storage** (High)

**Benefits:**
- CDN for fast global access
- Automatic redundancy/backups
- No disk space limits
- Signed URLs for security

**Implementation:** See AWS S3 section above.

---

### **3. Backblaze B2 or CloudFlare R2** (Alternative to S3)

**Why:** S3 egress fees can be expensive ($0.09/GB). R2 has no egress fees.

**Migration:** Same S3-compatible API, just change endpoint and credentials.

---

### **4. Image Optimization**

**Current:** Upload original image (could be 5MB+)

**Better:**
- Resize to max dimensions (e.g., 2000x2000)
- Compress (mozjpeg, sharp)
- Generate thumbnails (200x200 for grid view)
- WebP conversion (smaller files)

**Library:** `sharp` (npm package)

```javascript
const sharp = require('sharp');

async function processImage(buffer) {
  // Resize, compress, convert to WebP
  const optimized = await sharp(buffer)
    .resize(2000, 2000, { fit: 'inside' })
    .webp({ quality: 80 })
    .toBuffer();

  return optimized;
}
```

---

### **5. Virus Scanning**

**Risk:** Malicious user uploads executable disguised as image.

**Solution:** ClamAV integration.

```javascript
const clamav = require('clamav.js');

const upload = multer({
  storage,
  fileFilter: async (req, file, cb) => {
    const buffer = await fs.promises.readFile(file.path);
    const isClean = await clamav.scanBuffer(buffer);
    if (!isClean) {
      await fs.promises.unlink(file.path);
      return cb(new Error('File contains virus'), false);
    }
    cb(null, true);
  }
});
```

---

### **6. File Deduplication**

**Problem:** Same image uploaded multiple times → duplicate storage.

**Solution:** Hash file content, check if already exists.

```javascript
const crypto = require('crypto');

async function getFileHash(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

// In upload:
const hash = await getFileHash(filePath);
const existing = await FileMetadata.findOne({ hash });
if (existing) {
  // Reuse existing file
  product.imageUrl = existing.url;
} else {
  // Save new file + store hash
  await new FileMetadata({ hash, url: `/uploads/...` }).save();
}
```

---

### **7. CDN Integration**

**If using S3, enable CloudFront or CloudFlare CDN:**

```
S3 bucket: bikeflow-uploads.s3.amazonaws.com
CloudFront: cdn.bikeflow.com/uploads/...
```

**Benefits:**
- Faster downloads (edge caching)
- Reduced origin bandwidth costs
- DDoS protection

---

## 🗑️ Deletion & GDPR Compliance

### **User Account Deletion**

When user requests account deletion (GDPR right to erasure):

1. **Delete all uploaded files** belonging to that tenant
2. **Delete all AuditLog entries** older than retention? No - audit logs must be kept for compliance. Redact instead.
3. **Anonymize** (not delete) business data:
   - Set `name` = "Deleted User"
   - Set `email` = null
   - Keep financial records (invoices) but redact PII

**Implementation:**
```javascript
exports.deleteAccount = async (req, res) => {
  const tenantId = req.tenantId;

  // 1. Find all products with images
  const products = await Product.find({ tenantId });
  for (const p of products) {
    if (p.imageUrl) {
      await fs.promises.unlink(path.join(__dirname, '..', p.imageUrl));
    }
  }

  // 2. Soft-delete tenant (mark as deleted, anonymize)
  await Tenant.findByIdAndUpdate(tenantId, {
    status: 'deleted',
    name: '[DELETED]',
    email: null,
    phone: null,
  });

  // 3. Log deletion
  await ActivityLogger.log(req.user.userId, 'ACCOUNT_DELETED', 'Tenant', tenantId, {}, {});

  res.json({ message: 'Account deleted' });
};
```

---

## 🔍 Storage Auditing

### **Monthly Storage Report**

Generate report for billing/overage charges:

```javascript
async function generateStorageReport(tenantId) {
  const products = await Product.find({ tenantId });
  let totalMB = 0;

  for (const p of products) {
    if (p.imageUrl) {
      const filePath = path.join(__dirname, '..', p.imageUrl);
      const stat = await fs.promises.stat(filePath);
      totalMB += stat.size / (1024 * 1024);
    }
  }

  return {
    tenantId,
    totalMB: Math.round(totalMB),
    limitMB: await getPlanLimit(tenantId),
    overageMB: Math.max(0, totalMB - limitMB),
    overageCost: overageMB * 0.10,  // $0.10 per MB over
  };
}
```

---

## 📝 Code References

| Component | File | Purpose |
|-----------|------|---------|
| Static serving | `BACKEND/app.js:19` | `app.use('/uploads', express.static(...))` |
| Multer config | `BACKEND/src/routes/productRoutes.js` | File upload middleware |
| Storage metering | `BACKEND/src/middleware/usageMeteringMiddleware.js` | Increment storageMB counter |
| Product model | `BACKEND/src/models/Product.js` | `imageUrl` field |

---

## 🐛 Known Issues

1. **No auth on `/uploads` route** - Critical security issue, fix immediately
2. **No file type validation beyond mimetype** - Spoofed images possible
3. **No virus scanning** - Malware upload risk
4. **No deduplication** - Wasted storage
5. **No image optimization** - Large files slow page loads
6. **No cleanup of orphans** - Deleted products leave files behind
7. **No CDN** - Slow global access
8. **Local storage limits** - Cannot scale horizontally

---

## 🎯 Migration Checklist

**Phase 1: Security**
- [x] Prototype authenticated file serving
- [ ] Deploy to production
- [ ] Test tenant isolation

**Phase 2: Cloud Storage**
- [ ] Set up AWS S3 or CloudFlare R2
- [ ] Implement S3 upload middleware
- [ ] Generate signed URLs
- [ ] Migrate existing files (rsync)
- [ ] Update DB (add `imageS3Key` field)
- [ ] Remove local storage writes

**Phase 3: Optimization**
- [ ] Implement image compression (sharp)
- [ ] Generate thumbnails
- [ ] Add deduplication
- [ ] Add virus scanning

**Phase 4: Maintenance**
- [ ] Weekly orphan cleanup cron
- [ ] Daily temp file cleanup
- [ ] Monthly storage usage reports
- [ ] Backup S3 to Glacier (archival)

---

## 📊 Cost Estimation

### **AWS S3 (us-east-1)**

| Resource | Cost |
|----------|------|
| Storage | $0.023/GB/month (first 50 TB) |
| PUT requests | $0.005/1000 requests |
| GET requests | $0.0004/1000 requests (first 1B) |
| Data transfer out | $0.09/GB (first 10 TB) |
| CloudFront CDN | $0.085/GB (first 10 TB) |

**Example:** 100 tenants × 5GB average = 500GB
- Storage: 500 × $0.023 = **$11.50/month**
- Requests (10,000/day): ~$0.50/month
- CDN (if 100GB egress): ~$8.50/month
- **Total: ~$20-30/month**

**vs Local server:** Storage cost similar, but S3 provides durability, CDN, scalability.

---

## 🔗 Related Documents

- [07-billing-flow.md](07-billing-flow.md) - Storage used in usage metering
- [09-rate-limiting-flow.md](09-rate-limiting-flow.md) - Storage quota enforcement
- [06-multi-tenancy-flow.md](06-multi-tenancy-flow.md) - Tenant isolation for files needed
- [02-request-flow.md](02-request-flow.md) - Static file serving in middleware

---

**Status:** ⚠️ **Needs Immediate Attention** - Security issue: `/uploads` route lacks authentication. Fix priority: HIGH.

---

**Next:** Review all file access points and implement authenticated serving.
