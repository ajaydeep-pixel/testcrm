const mongoose = require('mongoose');
const Plan = require('../models/Plan');

async function normalizeTrialPlanName() {
  const trialPlan = await Plan.findOne({ slug: 'trial' });

  if (!trialPlan) {
    console.log('No trial plan found.');
    return { updated: false, reason: 'missing' };
  }

  if (trialPlan.name === 'Trial') {
    console.log('Trial plan name is already normalized.');
    return { updated: false, reason: 'already-normalized' };
  }

  const previousName = trialPlan.name;
  trialPlan.name = 'Trial';
  await trialPlan.save();

  console.log(`Trial plan name updated from "${previousName}" to "Trial".`);
  return { updated: true, previousName };
}

async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aicoding';
  await mongoose.connect(mongoUri);
  try {
    await normalizeTrialPlanName();
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Trial plan normalization failed:', err);
    process.exit(1);
  });
}

module.exports = normalizeTrialPlanName;
