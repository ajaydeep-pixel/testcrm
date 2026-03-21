import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

export default function Login({ onLoginSuccess }) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('password');
  const [sessionData, setSessionData] = useState(null);
  const [branding, setBranding] = useState({ appName: '', tagline: '' });
  const isDark = theme === 'dark';

  useEffect(() => {
    fetch('http://localhost:4000/api/branding')
      .then((r) => r.json())
      .then((data) => setBranding(data))
      .catch(() => setBranding({ appName: 'BikeFlow', tagline: 'Cloud POS for medium businesses' }));
  }, []);

  const handleLoginSuccess = (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    onLoginSuccess?.(user.role);

    if (user.role === 'superadmin') {
      navigate('/admin');
    } else {
      navigate('/dashboard');
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');

      const response = await authAPI.login(email, password);
      const { token, user, requiresTOTP, sessionId } = response.data;

      if (requiresTOTP) {
        setStep('totp');
        setSessionData({ sessionId });
      } else {
        handleLoginSuccess(token, user);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTOTPSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');

      const response = await authAPI.verify2FA(totp);
      const { token, user } = response.data;

      handleLoginSuccess(token, user);
    } catch (err) {
      setError(err.response?.data?.message || 'TOTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-600 px-4 py-10">
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 self-center">
            <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Welcome to {branding.appName || 'BikeFlow'}</h1>
            <p className="text-gray-600 mt-2">{branding.tagline || 'Set up your business in minutes'}</p>
          </div>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          {step === 'password' ? (
            <form onSubmit={handlePasswordSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="you@company.com"
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="********"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleTOTPSubmit}>
              <div className="mb-4 p-4 bg-blue-50 rounded">
                <p className="text-sm text-gray-700">
                  Two-factor authentication is enabled. Please enter the code from your authenticator app.
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Authenticator Code
                </label>
                <input
                  type="text"
                  value={totp}
                  onChange={(e) => setTotp(e.target.value.slice(0, 6))}
                  maxLength="6"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
                  placeholder="000000"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || totp.length !== 6}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>

              <button
                type="button"
                onClick={() => setStep('password')}
                className="w-full mt-3 text-blue-600 py-2 rounded-lg font-medium hover:bg-blue-50 transition"
              >
                Back to Email/Password
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-sm">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <a href="/signup" className="text-blue-600 hover:underline font-medium">
                Sign up
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
