import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import '../../assets/css/Navbar.css'; // Tạo file CSS này

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();

  const authLinks = (
    <ul>
      <li><Link to="/upload">Upload MIDI</Link></li>
      <li><span>Hi, {user && user.username}</span></li>
      <li><a onClick={logout} href="#!">Logout</a></li>
    </ul>
  );

  const guestLinks = (
    <ul>
      <li><Link to="/register">Register</Link></li>
      <li><Link to="/login">Login</Link></li>
    </ul>
  );

  return (
    <nav className="navbar">
      <h1><Link to="/">nanoMIDI</Link></h1>
      {isAuthenticated ? authLinks : guestLinks}
      {/* Thêm các icon như trong screenshot */}
      <div className="nav-icons">
        {/* Placeholder for icons */}
        <span>🎵</span> <span>🏆</span> <span>💬</span>
        {isAuthenticated && <Link to="/profile" className="profile-icon-placeholder">👤</Link>}
      </div>
    </nav>
  );
};

export default Navbar;