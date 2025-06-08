// client/src/pages/LeaderboardPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { getLeaderboard } from "../services/apiAuth"; // Or from apiUsers.js
import {
  FaTrophy,
  FaFileUpload,
  FaEye,
  FaDownload,
  FaUserCircle,
  FaMedal,
} from "react-icons/fa";
import "../assets/css/LeaderboardPage.css";

// Helper function to check if a string is a valid 24-char hex (ObjectId format)
const isValidObjectIdFormat = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

const LeaderboardPage = () => {
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState("uploads"); // 'uploads', 'views', 'downloads'
  const limit = 25;

  const fetchLeaderboard = useCallback(
    async (currentSortBy) => {
      setLoading(true);
      setError("");
      try {
        const params = { sortBy: currentSortBy, limit };
        const res = await getLeaderboard(params);
        setLeaderboardData(res.data);
      } catch (err) {
        console.error(
          `Failed to fetch leaderboard (sorted by ${currentSortBy}):`,
          err.response ? err.response.data : err.message
        );
        setError("Could not load leaderboard data. Please try again later.");
        setLeaderboardData([]);
      } finally {
        setLoading(false);
      }
    },
    [limit] 
  );

  useEffect(() => {
    fetchLeaderboard(sortBy);
  }, [sortBy, fetchLeaderboard]);

  const handleSortChange = (newSortBy) => {
    setSortBy(newSortBy);
  };

  const getRankIcon = (rank) => {
    if (rank === 0)
      return <FaMedal style={{ color: "#FFD700" }} title="Gold Medal" />;
    if (rank === 1)
      return <FaMedal style={{ color: "#C0C0C0" }} title="Silver Medal" />;
    if (rank === 2)
      return <FaMedal style={{ color: "#CD7F32" }} title="Bronze Medal" />;
    return <span className="rank-number">{rank + 1}</span>;
  };

  const getSortMetric = (user) => {
    if (sortBy === "uploads") return user.totalUploads;
    if (sortBy === "views") return user.totalViews;
    if (sortBy === "downloads") return user.totalDownloads;
    return 0;
  };

  const getSortMetricLabel = () => {
    if (sortBy === "uploads") return "Uploads";
    if (sortBy === "views") return "Total Views";
    if (sortBy === "downloads") return "Total Downloads";
    return "";
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
          onClick={() => handleSortChange("uploads")}
          className={`btn-sort ${sortBy === "uploads" ? "active" : ""}`}
        >
          <FaFileUpload /> Most Uploads
        </button>
        <button
          onClick={() => handleSortChange("views")}
          className={`btn-sort ${sortBy === "views" ? "active" : ""}`}
        >
          <FaEye /> Most Views
        </button>
        <button
          onClick={() => handleSortChange("downloads")}
          className={`btn-sort ${sortBy === "downloads" ? "active" : ""}`}
        >
          <FaDownload /> Most Downloads
        </button>
      </div>

      {error && <p className="alert-message alert-error">{error}</p>}

      {!loading && !error && leaderboardData.length === 0 && (
        <p className="no-results-message">
          No leaderboard data available for this category yet.
        </p>
      )}

      {!loading && !error && leaderboardData.length > 0 && (
        <div className="leaderboard-table-container">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th className="rank-col">Rank</th>
                <th className="user-col">User</th>
                <th className="metric-col">{getSortMetricLabel()}</th>
                <th className="midis-col">MIDIs</th>
              </tr>
            </thead>
            <tbody>
              {leaderboardData.map((userData, index) => {
                const profileId = userData.userId || userData._id; // userId from aggregation, _id if User object directly
                
                // Use the helper function for frontend ObjectId format validation
                const canLinkToProfile = profileId && isValidObjectIdFormat(profileId);

                return (
                  <tr key={profileId || index} className={`rank-${index + 1}`}>
                    <td className="rank-col">{getRankIcon(index)}</td>
                    <td className="user-col">
                      {canLinkToProfile ? (
                        <Link
                          to={`/profile/${profileId}`}
                          className="user-link"
                        >
                          {userData.profile_picture_url ? (
                            <img
                              src={userData.profile_picture_url}
                              alt={userData.username}
                              className="leaderboard-avatar"
                            />
                          ) : (
                            <FaUserCircle className="leaderboard-avatar-placeholder" />
                          )}
                          <span className="leaderboard-username">
                            {userData.username}
                          </span>
                        </Link>
                      ) : (
                        <div className="user-link-no-profile">
                          {userData.profile_picture_url ? (
                            <img
                              src={userData.profile_picture_url}
                              alt={userData.username}
                              className="leaderboard-avatar"
                            />
                          ) : (
                            <FaUserCircle className="leaderboard-avatar-placeholder" />
                          )}
                          <span className="leaderboard-username">
                            {userData.username || "N/A"}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="metric-col">
                      {getSortMetric(userData) ?? 0} {/* Use nullish coalescing for default */}
                    </td>
                    <td className="midis-col">
                      {/* Prefer totalMidis if available, otherwise use totalUploads for that specific sort metric */}
                      {userData.totalMidis !== undefined
                        ? userData.totalMidis
                        : sortBy === "uploads" && userData.totalUploads !== undefined
                        ? userData.totalUploads
                        : "N/A"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LeaderboardPage;