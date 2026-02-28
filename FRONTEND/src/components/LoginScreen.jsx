import React, { useState } from 'react';
import styles from './BillingScreen.module.css';

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || 'Login failed');
      }

      // Store token for apiService
      localStorage.setItem('token', data.token);
      localStorage.setItem('authToken', data.token); // legacy compatibility
      localStorage.setItem('authUser', JSON.stringify(data.user));
      onLogin({ ...data.user, token: data.token });
    } catch (err) {
      setError(err.message || 'Unable to login right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginShell}>
        <section className={styles.loginBrand}>
          <div className={styles.brandGlow} />
          <h1 className={styles.brandHeading}>Bike Parts POS</h1>
          <p className={styles.brandText}>
            Billing, inventory, and supplier operations from one control point.
          </p>
          <div className={styles.brandStats}>
            <span>Fast Billing</span>
            <span>Live Inventory</span>
            <span>Staff Roles</span>
          </div>
        </section>

        <section className={styles.loginCard}>
          <div className={styles.loginHeader}>Sign In</div>
          <p className={styles.loginSubtext}>Use your staff account credentials</p>

          <form onSubmit={handleSubmit} className={styles.loginForm}>
            <label className={styles.loginLabel} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className={styles.loginInput}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
            />

            <label className={styles.loginLabel} htmlFor="password">
              Password
            </label>
            <div className={styles.passwordWrap}>
              <input
                id="password"
                className={styles.loginInput}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(prev => !prev)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            <button className={styles.loginButton} type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <div className={styles.loginMetaRow}>
              <span className={styles.loginMeta}>Encrypted session</span>
              <span className={styles.loginMeta}>Role-based access</span>
            </div>

            {error && <div className={styles.loginError}>{error}</div>}
          </form>
        </section>
      </div>
    </div>
  );
}

export default LoginScreen;
