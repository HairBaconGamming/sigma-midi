// client/src/pages/LeaderboardPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getLeaderboard } from '../services/apiAuth'; // Hoặc từ apiUsers.js
import { FaTrophy, FaFileUpload, FaEye, FaDownload, FaUserCircle, FaMedal } from 'react-icons/fa';
import '../assets/css/LeaderboardPage.css'; // Tạo file CSS này

const LeaderboardPage = () => {
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('uploads'); // 'uploads', 'views', 'downloads'
  const limit = 25; // Số lượng user hiển thị

  const fetchLeaderboard = useCallback(async (currentSortBy) => {
    setLoading(true);
    setError('');
    try {
      const params = { sortBy: currentSortBy, limit };
      const res = await getLeaderboard(params);
      setLeaderboardData(res.data);
    } catch (err) {
      console.error(`Failed to fetch leaderboard (sorted by ${currentSortBy}):`, err);
      setError('Could not load leaderboard data. Please try again later.');
      setLeaderboardData([]);
    } finally {
      setLoading(false);
    }
  }, [limit]); // limit is stable

  useEffect(() => {
    fetchLeaderboard(sortBy);
  }, [sortBy, fetchLeaderboard]);

  const handleSortChange = (newSortBy) => {
    setSortBy(newSortBy);
  };

  const getRankIcon = (rank) => {
    if (rank === 0) return <FaMedal style={{ color: '#FFD700' }} title="Gold Medal"/>; // Gold
    if (rank === 1) return <FaMedal style={{ color: '#C0C0C0' }} title="Silver Medal"/>; // Silver
    if (rank === 2) return <FaMedal style={{ color: '#CD7F32' }} title="Bronze Medal"/>; // Bronze
    return <span className="rank-number">{rank + 1}</span>;
  };

  const getSortMetric = (user) => {
    if (sortBy === 'uploads') return user.totalUploads;
    if (sortBy === 'views') return user.totalViews;
    if (sortBy === 'downloads') return user.totalDownloads;
    return 0;
  };

  const getSortMetricLabel = () => {
    if (sortBy === 'uploads') return 'Uploads';
    if (sortBy === 'views') return 'Total Views';
    if (sortBy === 'downloads') return 'Total Downloads';
    return '';
  };

  if (loading) {
    return (
      <div className="loading-container-page">
        <div className="spinner-page"></div>
        <p>Loading Leaderboard...</p>
      </div>
    );
  }

  return (
    <div className="leaderboard-page-container container">
      <header className="leaderboard-header">
        <FaTrophy className="header-icon" />
        <h1>Top Contributors</h1>
        <p>See who's leading the sigmaMIDI community!</p>
      </header>

      <div className="leaderboard-controls">
        <button
          onClick={() => handleSortChange('uploads')}
          className={`btn-sort ${sortBy === 'uploads' ? 'active' : ''}`}
        >
          <FaFileUpload /> Most Uploads
        </button>
        <button
          onClick={() => handleSortChange('views')}
          className={`btn-sort ${sortBy === 'views' ? 'active' : ''}`}
        >
          <FaEye /> Most Views
        </button>
        <button
          onClick={() => handleSortChange('downloads')}
          className={`btn-sort ${sortBy === 'downloads' ? 'active' : ''}`}
        >
          <FaDownload /> Most Downloads
        </button>
      </div>

      {error && <p className="alert-message alert-error">{error}</p>}

      {!loading && !error && leaderboardData.length === 0 && (
        <p className="no-results-message">No leaderboard data available for this category yet.</p>
      )}

      {!loading && !error && leaderboardData.length > 0 && (
        <div className="leaderboard-table-container">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th className="rank-col">Rank</th>
                <th className="user-col">User</th>
                <th className="metric-col">{getSortMetricLabel()}</th>
                <th className="midis-col">MIDIs</th> {/* If applicable */}
              </tr>
            </thead>
            <tbody>
              {leaderboardData.map((user, index) => (
                <tr key={user.userId || user._id || index} className={`rank-${index + 1}`}>
                  <td className="rank-col">{getRankIcon(index)}</td>
                  <td className="user-col">
                    <Link to={`/profile/${user.userId || user._id}`} className="user-link">
                      {user.profile_picture_url ? (
                        <img src={user.profile_picture_url} alt={user.username} className="leaderboard-avatar" />
                      ) : (
                        <FaUserCircle className="leaderboard-avatar-placeholder" />
                      )}
                      <span className="leaderboard-username">{user.username}</span>
                    </Link>
                  </td>
                  <td className="metric-col">{getSortMetric(user) || 0}</td>
                  <td className="midis-col">{user.totalMidis !== undefined ? user.totalMidis : (sortBy === 'uploads' ? user.totalUploads : 'N/A')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LeaderboardPage;