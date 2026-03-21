/**
 * Database Seeder
 * Initializes default superadmin user on first run
 */

const bcrypt = require('bcryptjs');
const User = require('../models/User');
const PlatformSettings = require('../models/PlatformSettings');
const Plan = require('../models/Plan');

const seedDatabase = async () => {
  try {
    // Check if superadmin already exists
    // Seed default plans (always check, independent of superadmin)
    const existingPlans = await Plan.countDocuments();
    if (existingPlans === 0) {
      await Plan.insertMany([
        {
          name: 'Trial',
          slug: 'trial',
          price: 0,
          paymentType: 'one_time',
          cycleType: 'custom',
          customDays: 14,
          features: { maxUsers: 2, maxBranches: 1, maxProducts: 50, maxInvoicesPerMonth: 20 },
          description: 'Free 14-day trial with limited features',
          isActive: true,
          sortOrder: 0,
        },
        {
          name: 'Basic',
          slug: 'basic',
          price: 29,
          paymentType: 'subscription',
          cycleType: 'monthly',
          features: { maxUsers: 5, maxBranches: 1, maxProducts: 500, maxInvoicesPerMonth: 200 },
          description: 'Perfect for small shops with a single location',
          isActive: true,
          sortOrder: 1,
        },
        {
          name: 'Pro',
          slug: 'pro',
          price: 79,
          paymentType: 'subscription',
          cycleType: 'monthly',
          features: { maxUsers: 15, maxBranches: 3, maxProducts: 5000, maxInvoicesPerMonth: 1000 },
          description: 'For growing businesses with multiple branches',
          isActive: true,
          sortOrder: 2,
        },
        {
          name: 'Enterprise',
          slug: 'enterprise',
          price: 199,
          paymentType: 'subscription',
          cycleType: 'monthly',
          features: { maxUsers: 100, maxBranches: 20, maxProducts: 50000, maxInvoicesPerMonth: 10000 },
          description: 'Unlimited scale for large enterprises',
          isActive: true,
          sortOrder: 3,
        },
      ]);
      console.log('✅ Default plans created (Trial, Basic, Pro, Enterprise)');
    }

    const trialPlan = await Plan.findOne({ slug: 'trial' });
    if (trialPlan && trialPlan.name !== 'Trial') {
      trialPlan.name = 'Trial';
      await trialPlan.save();
      console.log('✅ Trial plan name normalized to "Trial"');
    }

    // Seed default platform settings (always check)
    const existingSettings = await PlatformSettings.findOne({ key: 'platform' });
    if (!existingSettings) {
      await PlatformSettings.create({ key: 'platform' });
      console.log('✅ Default platform settings created');
    }

    const existingSuperadmin = await User.findOne({ role: 'superadmin' });
    
    if (existingSuperadmin) {
      console.log('✅ Superadmin already exists:', existingSuperadmin.email);
      return {
        created: false,
        message: 'Superadmin already exists',
        email: existingSuperadmin.email,
      };
    }

    // Create superadmin
    const superadminData = {
      name: 'Platform Administrator',
      email: 'superadmin@aicoding.local',
      passwordHash: await bcrypt.hash('SuperAdmin@2026', 10),
      role: 'superadmin',
      tenantId: null,
      status: 'active',
    };

    const superadmin = await User.create(superadminData);

    console.log('🎉 Superadmin created successfully!');
    console.log('📧 Email:', superadmin.email);
    console.log('🔐 Password: SuperAdmin@2026');
    console.log('⚠️  Please change the password after first login');

    return {
      created: true,
      message: 'Superadmin created',
      email: superadmin.email,
    };
  } catch (err) {
    console.error('❌ Seeding error:', err.message);
    throw err;
  }
};

module.exports = seedDatabase;
