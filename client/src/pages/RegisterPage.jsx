// client/src/pages/RegisterPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FaUserPlus, FaUser, FaLock } from 'react-icons/fa';
import '../assets/css/AuthForm.css';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { register, isAuthenticated, loading: authLoading } = useAuth();

  const { username, password, confirmPassword } = formData;

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, authLoading, navigate]);

  const onChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await register(username, password);
      // navigate('/'); // Will be handled by useEffect
    } catch (err) {
      setError(err.response?.data?.msg || 'Registration failed. Please try again.');
      console.error("Registration error:", err.response ? err.response.data : err.message);
    }
    setLoading(false);
  };

  if (authLoading) {
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
          <FaUserPlus className="auth-form-icon" />
          <h2>Create Your Account</h2>
          <p>Join sigmaMIDI and start sharing your music!</p>
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
              placeholder="Password (min. 6 characters)"
              value={password}
              onChange={onChange}
              minLength="6"
              required
              aria-label="Password"
            />
          </div>
          <div className="form-group-auth">
            <FaLock className="input-icon" />
            <input
              type="password"
              name="confirmPassword"
              id="confirmPassword"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={onChange}
              minLength="6"
              required
              aria-label="Confirm Password"
            />
          </div>
          <button type="submit" className="btn-auth btn-submit-auth" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner-btn"></span> Registering...
              </>
            ) : 'Create Account'}
          </button>
        </form>
        <p className="auth-switch-prompt">
          Already have an account? <Link to="/login" className="auth-link">Login here</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;