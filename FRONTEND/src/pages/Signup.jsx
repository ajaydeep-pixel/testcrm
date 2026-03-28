import React, { useState, useEffect } from 'react';
import { authAPI, billingAPI } from '../services/api';
import { getPlanDisplayName } from '../utils/planDisplay';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');
const resolveAssetUrl = (url) => (url && url.startsWith('/uploads/') ? `${API_ORIGIN}${url}` : url);

const formatPlanPrice = (plan) => {
  if (!plan || Number(plan.price || 0) === 0) return 'Free';
  return `$${Number(plan.price).toFixed(2)}`;
};

const formatPlanDuration = (plan) => {
  if (!plan) return '';
  if (plan.paymentType === 'subscription') {
    return plan.cycleType === 'yearly' ? '/year' : '/month';
  }
  if (plan.cycleType === 'custom' && plan.customDays) {
    return `${plan.customDays} days`;
  }
  if (plan.cycleType === 'yearly') return 'Yearly access';
  if (plan.cycleType === 'monthly') return '30 days';
  return '';
};

const formatPlanDescription = (plan) => {
  if (!plan) return '';
  if (Number(plan.price || 0) === 0 && plan.cycleType === 'custom' && plan.customDays) {
    return `${plan.customDays}-day free trial`;
  }
  return plan.description || '';
};

export default function Signup({ onSignupSuccess }) {
  const [step, setStep] = useState('company');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [branding, setBranding] = useState({ appName: '', tagline: '', logoUrl: '' });

  // Company info
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Branch info
  const [branchName, setBranchName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [currency, setCurrency] = useState('USD');
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstNumber, setGstNumber] = useState('');

  // Plan
  const [selectedPlan, setSelectedPlan] = useState('basic');
  const [plans, setPlans] = useState([
    { id: 'trial', name: 'Trial', priceLabel: 'Free', duration: 'Trial access', description: 'Free starter access' },
    { id: 'basic', name: 'Basic', priceLabel: '$29.99', duration: '/month', description: 'Up to 1,000 invoices/month' },
    { id: 'pro', name: 'Pro', priceLabel: '$79.99', duration: '/month', description: 'Up to 10,000 invoices/month' },
  ]);

  const timezones = ['UTC', 'EST', 'CST', 'MST', 'PST', 'IST', 'CET', 'AEST'];
  const currencies = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD'];

  useEffect(() => {
    fetch(`${API_BASE_URL}/branding`)
      .then(r => r.json())
      .then(data => setBranding(data))
      .catch(() => setBranding({ appName: 'BikeFlow', tagline: 'Set up your business in minutes', logoUrl: '' }));
  }, []);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const response = await billingAPI.getPlans();
        const activePlans = (response.data?.plans || [])
          .filter((plan) => plan.isActive)
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
          .map((plan) => ({
            ...plan,
            id: plan.slug,
            priceLabel: formatPlanPrice(plan),
            duration: formatPlanDuration(plan),
            description: formatPlanDescription(plan),
          }));

        if (activePlans.length > 0) {
          setPlans(activePlans);
          setSelectedPlan((current) => (
            activePlans.some((plan) => plan.slug === current) ? current : activePlans[0].slug
          ));
        }
      } catch {
        // Keep the fallback plan cards if plan loading fails.
      }
    };

    loadPlans();
  }, []);

  const handleCompanySubmit = (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setStep('branch');
  };

  const handleBranchSubmit = (e) => {
    e.preventDefault();
    setError('');
    setStep('pricing');
  };

  const handlePricingSubmit = (e) => {
    e.preventDefault();
    setError('');
    setStep('review');
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');

      const signupData = {
        companyName,
        email,
        password,
        branch: {
          name: branchName,
          timezone,
          currency,
        },
        timezone,
        gst_enabled: gstEnabled,
        gst_number: gstNumber,
        plan: selectedPlan
      };

      const response = await authAPI.signup(signupData);
      const { token, user, tenant } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      if (tenant) localStorage.setItem('tenant', JSON.stringify(tenant));

      if (selectedPlan !== 'trial') {
        window.location.href = `/checkout/${selectedPlan}`;
      } else {
        onSignupSuccess?.();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed. Please try again.');
      setStep('company');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-8">
        
        <div className="text-center mb-8">
          {branding.logoUrl ? (
            <img
              src={resolveAssetUrl(branding.logoUrl)}
              alt={branding.appName || 'BikeFlow'}
              className="mx-auto mb-4"
              style={{ maxHeight: 64, maxWidth: 220, objectFit: 'contain' }}
            />
          ) : (
            <h1 className="text-3xl font-bold text-gray-900">Welcome to {branding.appName || 'BikeFlow'}</h1>
          )}
          <p className="text-gray-600 mt-2">{branding.tagline || 'Set up your business in minutes'}</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between mb-8">
          {['Company', 'Branch', 'Plan', 'Review'].map((label, idx) => (
            <div key={label} className="flex flex-col items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-2 ${
                  ['company', 'branch', 'pricing', 'review'].indexOf(step) >= idx
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}
              >
                {idx + 1}
              </div>
              <span className="text-sm text-gray-600">{label}</span>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Company Step */}
        {step === 'company' && (
          <form onSubmit={handleCompanySubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name *
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Acme Bike Parts"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="admin@acmebikes.com"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password *
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Continue
            </button>
          </form>
        )}

        {/* Branch Step */}
        {step === 'branch' && (
          <form onSubmit={handleBranchSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Branch Name *
              </label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Downtown Store"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {currencies.map((cur) => (
                    <option key={cur} value={cur}>
                      {cur}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={gstEnabled}
                  onChange={(e) => setGstEnabled(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Enable GST/VAT</span>
              </label>
            </div>

            {gstEnabled && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GST/VAT Number (optional)
                </label>
                <input
                  type="text"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="123456789"
                />
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setStep('company')}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition"
              >
                Continue
              </button>
            </div>
          </form>
        )}

        {/* Pricing Step */}
        {step === 'pricing' && (
          <form onSubmit={handlePricingSubmit}>
            <p className="text-gray-700 mb-6 text-center">
              Choose a plan. You can upgrade or downgrade anytime.
            </p>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                    selectedPlan === plan.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <h3 className="font-bold text-lg text-gray-900">{getPlanDisplayName(plan)}</h3>
                  <p className="text-2xl font-bold text-blue-600 mt-2">
                    {plan.priceLabel || plan.price}
                  </p>
                  <p className="text-sm text-gray-600">{plan.duration}</p>
                  <p className="text-xs text-gray-500 mt-2">{plan.description}</p>
                  <input
                    type="radio"
                    checked={selectedPlan === plan.id}
                    className="mt-4"
                    readOnly
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setStep('branch')}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition"
              >
                Review
              </button>
            </div>
          </form>
        )}

        {/* Review Step */}
        {step === 'review' && (
          <form onSubmit={handleSignup}>
            <div className="bg-gray-50 rounded-lg p-6 mb-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600">Company Name</p>
                <p className="font-semibold text-gray-900">{companyName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Admin Email</p>
                <p className="font-semibold text-gray-900">{email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Primary Branch</p>
                <p className="font-semibold text-gray-900">
                  {branchName} ({timezone}, {currency})
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Selected Plan</p>
                <p className="font-semibold text-gray-900">
                  {plans.find((p) => p.id === selectedPlan)?.name}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 transition mb-4"
            >
              {loading ? 'Setting up...' : 'Create Account'}
            </button>

            <button
              type="button"
              onClick={() => setStep('pricing')}
              className="w-full bg-gray-200 text-gray-800 py-2 rounded-lg font-medium hover:bg-gray-300 transition"
            >
              Back
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-sm">
          <p className="text-gray-600">
            Already have an account?{' '}
            <a href="/login" className="text-blue-600 hover:underline font-medium">
              Login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
