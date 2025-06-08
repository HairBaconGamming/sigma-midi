// client/src/pages/UserProfilePage.jsx (Ví dụ cơ bản)
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getUserPublicProfile } from '../services/apiAuth'; // Hoặc apiUsers
import '../assets/css/ProfilePage.css'; // Dùng chung CSS với MyProfilePage hoặc tạo riêng

const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

const UserProfilePage = () => {
  const { userId } = useParams(); // Đây là ID từ URL
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId || !isValidObjectId(userId)) { // Kiểm tra ID hợp lệ trước khi fetch
      setError('Invalid user profile link.');
      setLoading(false);
      return;
    }

    const fetchUserProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getUserPublicProfile(userId);
        setProfile(res.data);
      } catch (err) {
        console.error("Failed to fetch user profile:", err);
        if (err.response && err.response.status === 404) {
            setError('User profile not found.');
        } else {
            setError('Could not load user profile.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchUserProfile();
  }, [userId]);

  if (loading) return <div className="loading-container-page"><div className="spinner-page"></div><p>Loading Profile...</p></div>;
  if (error) return <p className="alert-message alert-error container">{error}</p>;
  if (!profile) return <p className="no-results-message-page container">User profile not found.</p>;

  // Sử dụng CSS tương tự MyProfilePage hoặc tạo CSS riêng
  return (
    <div className="profile-page-container container">
      <header className="profile-header">
        <div className={`profile-avatar-placeholder ${!profile.profile_picture_url ? 'initial-avatar' : ''}`}
             data-initial={profile.username ? profile.username.charAt(0).toUpperCase() : 'U'}>
          {profile.profile_picture_url &&
            <img src={profile.profile_picture_url} alt={`${profile.username}'s profile`} className="profile-avatar-img"/>
          }
        </div>
        <h1>{profile.username}'s Profile</h1>
        {/* <p className="profile-email">{profile.email || 'Email not public'}</p> */}
      </header>
      <section className="profile-section profile-details">
        <h3 className="profile-section-header">About {profile.username}</h3>
        <p>{profile.bio || 'This user has not provided a bio yet.'}</p>
        <p><strong>Joined:</strong> {profile.registration_date ? new Date(profile.registration_date).toLocaleDateString() : 'N/A'}</p>
        {/* Hiển thị số lượng MIDI đã upload của user này (cần API riêng hoặc trả về từ /auth/profile/:userId) */}
        {/* <p><strong>MIDIs Uploaded:</strong> {profile.midiUploadCount || 0}</p> */}
      </section>
      <section className="profile-section profile-activity">
        <h3 className="profile-section-header">{profile.username}'s MIDIs</h3>
        {/* TODO: Fetch và hiển thị danh sách MIDI của user này */}
        <p>
          <Link to={`/?uploaderId=${profile._id}`} className="btn btn-outline">View all MIDIs by {profile.username}</Link>
        </p>
      </section>
    </div>
  );
};

export default UserProfilePage;