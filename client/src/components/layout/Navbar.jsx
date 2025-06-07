// client/src/components/layout/Navbar.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { FaMusic, FaTrophy, FaDiscord, FaUpload, FaSignInAlt, FaUserCircle, FaSignOutAlt } from 'react-icons/fa'; // Using react-icons
import '../../assets/css/Navbar.css';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
    navigate('/');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <Link to="/" onClick={closeMobileMenu}>
            {/* You can use an SVG logo here if you have one */}
            <span className="brand-sigma">sigma</span>
            <span className="brand-midi">MIDI</span>
          </Link>
        </div>

        <div className="navbar-menu-icon" onClick={toggleMobileMenu}>
          <div className={`hamburger ${isMobileMenuOpen ? 'open' : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>

        <div className={`navbar-links ${isMobileMenuOpen ? 'open' : ''}`}>
          <ul>
            <li>
              <a href="/" target="_blank" rel="noopener noreferrer" title="Music Platform" onClick={closeMobileMenu}>
                <FaMusic /> <span className="nav-icon-text">Music</span>
              </a>
            </li>
            <li>
              <Link to="/leaderboard" title="Leaderboard" onClick={closeMobileMenu}>
                <FaTrophy /> <span className="nav-icon-text">Scores</span>
              </Link>
            </li>
            {isAuthenticated ? (
              <>
                <li>
                  <Link to="/upload" className="btn btn-nav btn-upload" title="Upload MIDI" onClick={closeMobileMenu}>
                    <FaUpload /> <span className="nav-button-text">Upload</span>
                  </Link>
                </li>
                <li className="nav-user-dropdown">
                  <div className="user-avatar-container">
                    <FaUserCircle className="user-avatar-icon" />
                    <span className="user-name">{user?.username}</span>
                  </div>
                  <ul className="dropdown-menu">
                    <li><Link to="/profile" onClick={closeMobileMenu}>My Profile</Link></li>
                    <li><Link to="/my-midis" onClick={closeMobileMenu}>My MIDIs</Link></li>
                    <li><button onClick={handleLogout} className="btn-dropdown-logout">
                        <FaSignOutAlt /> Logout
                    </button></li>
                  </ul>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link to="/login" className="btn btn-nav btn-login" title="Login" onClick={closeMobileMenu}>
                    <FaSignInAlt /> <span className="nav-button-text">Login</span>
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="btn btn-nav btn-register" title="Register" onClick={closeMobileMenu}>
                    Register
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;