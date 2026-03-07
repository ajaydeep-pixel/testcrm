const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'platform',
      unique: true,
    },
    branding: {
      appName: { type: String, default: 'BikeFlow' },
      tagline: { type: String, default: 'Cloud POS for medium businesses' },
      logoUrl: { type: String, default: '' },
      faviconUrl: { type: String, default: '' },
      primaryColor: { type: String, default: '#2563eb' },
    },
    contact: {
      supportEmail: { type: String, default: '' },
      supportPhone: { type: String, default: '' },
      website: { type: String, default: '' },
    },
  },
  { collection: 'platform_settings', timestamps: true }
);

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
