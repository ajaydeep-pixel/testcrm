const mongoose = require('mongoose');
const Plan = require('../models/Plan');

function inferPlanShape(plan) {
  const rateLimit = {
    requests: plan.rateLimit?.requests || 100,
    window: plan.rateLimit?.window || 3600,
  };

  let paymentType = plan.paymentType;
  let cycleType = plan.cycleType;
  let customDays = plan.customDays;

  if (!paymentType || !cycleType) {
    switch (plan.billingCycle) {
      case 'monthly':
        paymentType = paymentType || 'subscription';
        cycleType = cycleType || 'monthly';
        break;
      case 'yearly':
        paymentType = paymentType || 'subscription';
        cycleType = cycleType || 'yearly';
        break;
      case 'one-time':
      case 'one-time-monthly':
        paymentType = paymentType || 'one_time';
        cycleType = cycleType || 'monthly';
        break;
      case 'one-time-yearly':
        paymentType = paymentType || 'one_time';
        cycleType = cycleType || 'yearly';
        break;
      case 'free':
        paymentType = paymentType || 'one_time';
        cycleType = cycleType || 'custom';
        customDays = customDays || 14;
        break;
      case 'custom':
        paymentType = paymentType || 'one_time';
        cycleType = cycleType || 'custom';
        customDays = customDays || 30;
        break;
      default:
        paymentType = paymentType || (plan.price > 0 ? 'subscription' : 'one_time');
        cycleType = cycleType || (plan.price > 0 ? 'monthly' : 'custom');
        if (cycleType === 'custom') {
          customDays = customDays || (plan.slug === 'trial' ? 14 : 30);
        }
        break;
    }
  }

  if (cycleType !== 'custom') {
    customDays = null;
  }

  return { paymentType, cycleType, customDays, rateLimit };
}

async function backfillPlanStructure() {
  const plans = await Plan.find({});
  let updatedCount = 0;

  for (const plan of plans) {
    const inferred = inferPlanShape(plan);
    let dirty = false;

    for (const [key, value] of Object.entries(inferred)) {
      const current = plan[key];
      const same = typeof value === 'object'
        ? JSON.stringify(current || {}) === JSON.stringify(value || {})
        : current === value;
      if (!same) {
        plan[key] = value;
        dirty = true;
      }
    }

    if (dirty) {
      await plan.save();
      updatedCount += 1;
      console.log(`Updated plan ${plan.slug}`);
    }
  }

  console.log(`Backfill complete. Updated ${updatedCount} plan(s).`);
}

async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aicoding';
  await mongoose.connect(mongoUri);
  try {
    await backfillPlanStructure();
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Plan backfill failed:', err);
    process.exit(1);
  });
}

module.exports = backfillPlanStructure;
