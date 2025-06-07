import React from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Thêm useNavigate
import { useAuth } from '../../contexts/AuthContext';
import '../../assets/css/Navbar.css'; // Đảm bảo đã import CSS

// Placeholder icons (bạn nên thay thế bằng SVG hoặc thư viện icon)
const MusicNoteIcon = () => <span>🎵</span>;
const TrophyIcon = () => <span>🏆</span>;
const ChatIcon = () => <span>💬</span>; // Placeholder cho Discord hoặc forum
const UploadIcon = () => <span>📤</span>; // Icon cho nút Upload
const LoginIcon = () => <span>🔑</span>; // Icon cho nút Login/Register

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate(); // Hook để điều hướng

  const handleLogout = () => {
    logout();
    navigate('/'); // Điều hướng về trang chủ sau khi logout
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">nanoMIDI</Link>
      </div>

      <div className="navbar-center">
        {/* Có thể thêm các link điều hướng chính ở đây nếu cần */}
        {/* Ví dụ: <Link to="/browse">Browse</Link> */}
      </div>

      <div className="navbar-right">
        <ul>
          <li>
            <a href="https://your-music-platform-link.com" target="_blank" rel="noopener noreferrer" title="Music Platform">
              <MusicNoteIcon />
            </a>
          </li>
          <li>
            <Link to="/leaderboard" title="Leaderboard"> {/* Giả sử có trang leaderboard */}
              <TrophyIcon />
            </Link>
          </li>
          <li>
            <a href="https://your-discord-link.com" target="_blank" rel="noopener noreferrer" title="Discord Community">
              <ChatIcon />
            </a>
          </li>
          {isAuthenticated ? (
            <>
              <li>
                <Link to="/upload" className="btn btn-upload" title="Upload MIDI">
                  <UploadIcon /> {/* Hoặc <UploadIcon /> Upload */}
                </Link>
              </li>
              <li className="nav-user-info">
                {/* Có thể thêm avatar ở đây */}
                <span>Hi, {user?.username}</span>
              </li>
              <li>
                <button onClick={handleLogout} className="btn btn-logout" title="Logout">
                  Logout
                </button>
              </li>
            </>
          ) : (
            <>
              <li>
                <Link to="/login" className="btn btn-login-register" title="Login or Register">
                  <LoginIcon /> {/* Hoặc Login/Register */}
                </Link>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;