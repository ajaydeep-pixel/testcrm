const Tenant = require('../models/Tenant');
const User = require('../models/User');

const BUSINESS_FIELDS = ['name', 'email', 'phone', 'address', 'country', 'state', 'city', 'zip'];
const BILLING_FIELDS = ['name', 'email', 'phone', 'address', 'country', 'state', 'city', 'zip'];

const emptyBusiness = () => ({
  name: '',
  email: '',
  phone: '',
  address: '',
  country: '',
  state: '',
  city: '',
  zip: '',
});

const emptyBilling = () => ({
  sameAsBusiness: false,
  name: '',
  email: '',
  phone: '',
  address: '',
  country: '',
  state: '',
  city: '',
  zip: '',
});

const emptyProfile = () => ({
  name: '',
  email: '',
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const pickFields = (source = {}, fields = []) => {
  const result = {};
  fields.forEach((key) => {
    result[key] = source[key] ?? '';
  });
  return result;
};

const buildBusinessInfo = (tenant) => ({
  name: tenant?.name || '',
  email: tenant?.email || '',
  phone: tenant?.phone || '',
  address: tenant?.address || '',
  country: tenant?.country || '',
  state: tenant?.state || '',
  city: tenant?.city || '',
  zip: tenant?.zip || '',
});

const buildBillingInfo = (tenant) => {
  const billing = {
    ...emptyBilling(),
    ...pickFields(tenant?.billing || {}, BILLING_FIELDS),
    sameAsBusiness: Boolean(tenant?.billing?.sameAsBusiness),
  };

  if (billing.sameAsBusiness) {
    return {
      ...billing,
      ...buildBusinessInfo(tenant),
      sameAsBusiness: true,
    };
  }

  return billing;
};

const legacyBillingFromUser = async (req) => {
  const user = await User.findOne({ _id: req.user.userId || req.user.id, tenantId: req.tenantId }).select('billing_info');
  if (!user?.billing_info) return null;

  const legacy = pickFields(user.billing_info, BILLING_FIELDS);
  const hasValue = BILLING_FIELDS.some((key) => legacy[key]);
  return hasValue ? legacy : null;
};

const buildProfileInfo = (user) => ({
  ...emptyProfile(),
  name: user?.name || '',
  email: user?.email || '',
});

exports.getBusinessInfo = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId).select('name email phone address country state city zip');
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    res.json({ business_info: buildBusinessInfo(tenant) });
  } catch (err) {
    console.error('Error fetching business info:', err);
    res.status(500).json({ message: 'Failed to fetch business info', error: err.message });
  }
};

exports.updateBusinessInfo = async (req, res) => {
  try {
    const payload = req.body?.business_info || req.body || {};
    const update = {};

    BUSINESS_FIELDS.forEach((key) => {
      if (payload[key] !== undefined) {
        update[key] = payload[key];
      }
    });

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'No business fields provided' });
    }

    const tenant = await Tenant.findById(req.tenantId).select('billing');
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    Object.entries(update).forEach(([key, value]) => {
      tenant[key] = value;
    });

    if (tenant.billing?.sameAsBusiness) {
      BILLING_FIELDS.forEach((key) => {
        tenant.billing[key] = tenant[key] || '';
      });
    }

    await tenant.save();

    res.json({
      message: 'Business info updated',
      business_info: buildBusinessInfo(tenant),
    });
  } catch (err) {
    console.error('Error updating business info:', err);
    res.status(500).json({ message: 'Failed to update business info', error: err.message });
  }
};

exports.getBillingInfo = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId).select('name email phone address country state city zip billing');
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const billingData = tenant.billing ? pickFields(tenant.billing, BILLING_FIELDS) : emptyBilling();
    const hasBillingData = BILLING_FIELDS.some((key) => billingData[key]);

    if (!hasBillingData && !tenant.billing?.sameAsBusiness) {
      const legacy = await legacyBillingFromUser(req);
      if (legacy) {
        tenant.billing = {
          ...tenant.billing?.toObject?.(),
          ...legacy,
          sameAsBusiness: false,
        };
        await tenant.save();
      }
    }

    const freshTenant = await Tenant.findById(req.tenantId).select('name email phone address country state city zip billing');
    res.json({ billing_info: buildBillingInfo(freshTenant) });
  } catch (err) {
    console.error('Error fetching billing info:', err);
    res.status(500).json({ message: 'Failed to fetch billing info', error: err.message });
  }
};

exports.updateBillingInfo = async (req, res) => {
  try {
    const payload = req.body?.billing_info || req.body || {};
    const tenant = await Tenant.findById(req.tenantId).select('name email phone address country state city zip billing');
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const sameAsBusiness = payload.sameAsBusiness === true;

    if (sameAsBusiness) {
      tenant.billing = {
        ...tenant.billing?.toObject?.(),
        ...buildBusinessInfo(tenant),
        sameAsBusiness: true,
      };
    } else {
      tenant.billing = {
        ...tenant.billing?.toObject?.(),
        ...pickFields(payload, BILLING_FIELDS),
        sameAsBusiness: false,
      };
    }

    await tenant.save();

    res.json({
      message: 'Billing info updated',
      billing_info: buildBillingInfo(tenant),
    });
  } catch (err) {
    console.error('Error updating billing info:', err);
    res.status(500).json({ message: 'Failed to update billing info', error: err.message });
  }
};

exports.getProfileInfo = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.user.userId || req.user.id,
      tenantId: req.tenantId,
    }).select('name email');

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ profile_info: buildProfileInfo(user) });
  } catch (err) {
    console.error('Error fetching profile info:', err);
    res.status(500).json({ message: 'Failed to fetch profile info', error: err.message });
  }
};

exports.updateProfileInfo = async (req, res) => {
  try {
    const payload = req.body?.profile_info || req.body || {};
    const name = (payload.name || '').trim();
    const email = (payload.email || '').trim().toLowerCase();

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Valid email is required' });
    }

    const currentUserId = req.user.userId || req.user.id;
    const existingUser = await User.findOne({
      tenantId: req.tenantId,
      email,
      _id: { $ne: currentUserId },
    }).select('_id');

    if (existingUser) {
      return res.status(409).json({ message: 'Email already exists for another user' });
    }

    const user = await User.findOneAndUpdate(
      { _id: currentUserId, tenantId: req.tenantId },
      { $set: { name, email } },
      { new: true, runValidators: true }
    ).select('name email role tenantId');

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      message: 'Profile info updated',
      profile_info: buildProfileInfo(user),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
    });
  } catch (err) {
    console.error('Error updating profile info:', err);
    res.status(500).json({ message: 'Failed to update profile info', error: err.message });
  }
};
