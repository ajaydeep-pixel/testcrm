import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import OperationsPage from './pages/OperationsPage';
import CheckoutPage from './pages/CheckoutPage';
import CheckoutSuccess from './pages/CheckoutSuccess';
import CheckoutCancel from './pages/CheckoutCancel';
import SuperadminDashboard from './components/SuperadminDashboard';
import SettingsPage from './pages/SettingsPage';
import './styles/global.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      setIsAuthenticated(true);
      try {
        const parsed = JSON.parse(user);
        setUserRole(parsed.role);
      } catch (e) {
        setUserRole(null);
      }
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to={userRole === 'superadmin' ? '/admin' : '/dashboard'} replace />
            ) : (
              <Login onLoginSuccess={(role) => { setIsAuthenticated(true); setUserRole(role); }} />
            )
          }
        />
        <Route
          path="/signup"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Signup onSignupSuccess={() => { setIsAuthenticated(true); setUserRole('owner'); }} />
            )
          }
        />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            !isAuthenticated ? <Navigate to="/login" replace /> :
            userRole === 'superadmin' ? <Navigate to="/admin" replace /> :
            <Dashboard />
          }
        />
        <Route
          path="/operations/*"
          element={
            !isAuthenticated ? <Navigate to="/login" replace /> :
            userRole === 'superadmin' ? <Navigate to="/admin" replace /> :
            <OperationsPage />
          }
        />
        <Route
          path="/crm/*"
          element={<Navigate to="/operations" replace />}
        />
        <Route
          path="/admin/*"
          element={
            isAuthenticated && userRole === 'superadmin' ? (
              <SuperadminDashboard />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Settings Route */}
        <Route
          path="/settings"
          element={!isAuthenticated ? 
          <Navigate to="/login" replace /> : <SettingsPage />}
        />

        {/* Checkout Routes */}
        <Route
          path="/checkout/success"
          element={!isAuthenticated ? <Navigate to="/login" replace /> : <CheckoutSuccess />}
        />
        <Route
          path="/checkout/cancel"
          element={!isAuthenticated ? <Navigate to="/login" replace /> : <CheckoutCancel />}
        />
        <Route
          path="/checkout/:planSlug"
          element={!isAuthenticated ? <Navigate to="/login" replace /> : <CheckoutPage />}
        />

        {/* Catch-all */}
        <Route
          path="/"
          element={
            <Navigate
              to={isAuthenticated ? (userRole === 'superadmin' ? '/admin' : '/dashboard') : '/login'}
              replace
            />
          }
        />
      </Routes>
    </Router>
    </ToastProvider>
  );
}

export default App;
