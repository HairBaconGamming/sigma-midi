// client/src/pages/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FaUser, FaLock, FaSignInAlt } from 'react-icons/fa';
import '../assets/css/AuthForm.css';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // Local loading for form submission
  const navigate = useNavigate();
  const { login, isAuthenticated, loading: authLoading } = useAuth(); // authLoading for global auth state

  const { username, password } = formData;

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/'); // Redirect if already logged in and auth state is resolved
    }
  }, [isAuthenticated, authLoading, navigate]);

  const onChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(username, password);
      // Navigation will be handled by useEffect or can be explicit here
      // navigate('/');
    } catch (err) {
      setError(err.response?.data?.msg || 'Login failed. Please check your credentials.');
      console.error("Login error:", err.response ? err.response.data : err.message);
    }
    setLoading(false);
  };

  if (authLoading) { // Show loading while checking auth status
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }


  return (
    <div className="auth-page-container">
      <div className="auth-form-card">
        <div className="auth-form-header">
          <FaSignInAlt className="auth-form-icon" />
          <h2>Welcome Back!</h2>
          <p>Login to access your sigmaMIDI account.</p>
        </div>

        {error && <p className="error-message-form">{error}</p>}

        <form onSubmit={onSubmit} className="auth-form">
          <div className="form-group-auth">
            <FaUser className="input-icon" />
            <input
              type="text"
              name="username"
              id="username"
              placeholder="Username"
              value={username}
              onChange={onChange}
              required
              aria-label="Username"
            />
          </div>
          <div className="form-group-auth">
            <FaLock className="input-icon" />
            <input
              type="password"
              name="password"
              id="password"
              placeholder="Password"
              value={password}
              onChange={onChange}
              required
              aria-label="Password"
            />
          </div>
          <button type="submit" className="btn-auth btn-submit-auth" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner-btn"></span> Logging in...
              </>
            ) : 'Login'}
          </button>
        </form>
        <p className="auth-switch-prompt">
          Don't have an account? <Link to="/register" className="auth-link">Sign up here</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;