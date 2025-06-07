import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api'; // Giả sử bạn có API để lấy/cập nhật profile
// import '../assets/css/ProfilePage.css'; // Tạo file CSS này sau

const MyProfilePage = () => {
  const { user, loading: authLoading, token } = useAuth(); // user từ context là thông tin ban đầu
  const [profileData, setProfileData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  // const [isEditing, setIsEditing] = useState(false);
  // const [formData, setFormData] = useState({ bio: '', profile_picture_url: '' });


  useEffect(() => {
    const fetchProfile = async () => {
      if (user && token) { // Chỉ fetch nếu user đã được load và có token
        setIsLoading(true);
        try {
          // API endpoint này cần được tạo ở backend (cả webapp và db-api)
          // Nó nên trả về thông tin chi tiết hơn của user, có thể bao gồm cả số lượng MIDI đã upload
          const res = await api.get(`/users/profile/${user.id}`); // Hoặc 1 endpoint /me
          setProfileData(res.data);
          // setFormData({ bio: res.data.bio || '', profile_picture_url: res.data.profile_picture_url || '' });
        } catch (err) {
          console.error("Failed to fetch profile", err);
          setError("Could not load your profile data.");
        } finally {
          setIsLoading(false);
        }
      } else if (!authLoading && !user) {
          setError("You need to be logged in to view your profile.");
          setIsLoading(false);
      }
    };

    if (!authLoading) { // Chờ auth state được xác định
        fetchProfile();
    }
  }, [user, authLoading, token]);

  // const handleEditToggle = () => setIsEditing(!isEditing);

  // const handleChange = (e) => {
  //   setFormData({ ...formData, [e.target.name]: e.target.value });
  // };

  // const handleSubmit = async (e) => {
  //   e.preventDefault();
  //   setIsLoading(true);
  //   try {
  //     const res = await api.put(`/users/profile/${user.id}`, formData); // Endpoint cập nhật profile
  //     setProfileData(res.data);
  //     setIsEditing(false);
  //     alert("Profile updated successfully!");
  //   } catch (err) {
  //     console.error("Failed to update profile", err);
  //     setError("Could not update profile.");
  //   }
  //   setIsLoading(false);
  // };


  if (authLoading || isLoading) {
    return (
      <div className="loading-container-page">
        <div className="spinner-page"></div>
        <p>Loading Profile...</p>
      </div>
    );
  }

  if (error) {
    return <p className="error-message-page">{error}</p>;
  }

  if (!profileData) {
    return <p className="no-results-message-page">Profile data not available.</p>;
  }

  return (
    <div className="profile-page-container container"> {/* Thêm class container */}
      <header className="profile-header">
        {/* <img 
            src={profileData.profile_picture_url || `https://via.placeholder.com/150?text=${profileData.username.charAt(0)}`} 
            alt={`${profileData.username}'s profile`} 
            className="profile-avatar"
        /> */}
        <div className={`profile-avatar-placeholder ${!profileData.profile_picture_url ? 'initial-avatar' : ''}`} 
             data-initial={profileData.username ? profileData.username.charAt(0).toUpperCase() : 'U'}>
          {profileData.profile_picture_url && 
            <img src={profileData.profile_picture_url} alt={`${profileData.username}'s profile`} className="profile-avatar-img"/>
          }
        </div>
        <h1>{profileData.username}'s Profile</h1>
        <p className="profile-email">{profileData.email || 'No email provided'}</p>
        {/* <button onClick={handleEditToggle} className="btn btn-outline profile-edit-btn">
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </button> */}
      </header>

      {/* {isEditing ? (
        <form onSubmit={handleSubmit} className="profile-edit-form">
          <div className="form-group">
            <label htmlFor="bio">Bio:</label>
            <textarea id="bio" name="bio" value={formData.bio} onChange={handleChange} rows="4"></textarea>
          </div>
          <div className="form-group">
            <label htmlFor="profile_picture_url">Profile Picture URL:</label>
            <input type="text" id="profile_picture_url" name="profile_picture_url" value={formData.profile_picture_url} onChange={handleChange} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>Save Changes</button>
        </form>
      ) : ( */}
        <section className="profile-details">
          <div className="profile-detail-item">
            <h3>About Me</h3>
            <p>{profileData.bio || 'No bio provided yet.'}</p>
          </div>
          <div className="profile-detail-item">
            <h3>Account Details</h3>
            <p><strong>Joined:</strong> {new Date(profileData.registration_date).toLocaleDateString()}</p>
            {/* <p><strong>MIDIs Uploaded:</strong> {profileData.midiUploadCount || 0}</p> */}
            {/* <p><strong>Last Login:</strong> {profileData.last_login_date ? new Date(profileData.last_login_date).toLocaleString() : 'N/A'}</p> */}
          </div>
        </section>
      {/* )} */}
      
      <section className="profile-activity">
        <h3>Recent Activity</h3>
        {/* Placeholder for recent activity, e.g., recently uploaded MIDIs, comments, favorites */}
        <p>Your recent activity will appear here.</p>
      </section>
    </div>
  );
};

export default MyProfilePage;