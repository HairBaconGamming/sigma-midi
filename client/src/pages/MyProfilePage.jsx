// client/src/pages/MyProfilePage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAuthUser, updateUserProfile } from '../services/apiAuth'; // Import correct service functions
import '../assets/css/ProfilePage.css';
import { FaUserCircle, FaEnvelope, FaCalendarAlt, FaInfoCircle, FaEdit, FaSave, FaTimes, FaMusic } from 'react-icons/fa';

const initialProfileState = {
  username: '',
  email: '',
  bio: '',
  profile_picture_url: '',
  registration_date: '',
  // midiUploadCount: 0, // This would need to be fetched separately or included in /auth/me response
};

const MyProfilePage = () => {
  const { user: authContextUser, loading: authLoading, token, loadUser: reloadAuthContextUser } = useAuth(); // Get reload function
  const [profileData, setProfileData] = useState(initialProfileState);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(initialProfileState);

  const fetchProfile = useCallback(async () => {
    if (authContextUser && token) { // Use authContextUser for initial check
      setIsLoading(true);
      setError('');
      try {
        // Use getAuthUser which calls /api/auth/me
        const res = await getAuthUser();
        const fetchedData = { ...initialProfileState, ...res.data };
        setProfileData(fetchedData);
        setFormData(fetchedData); // Initialize edit form with fetched data
      } catch (err) {
        console.error("Failed to fetch profile", err.response ? err.response.data : err.message);
        setError("Could not load your profile data. Please try again later.");
        // Fallback to context user data if fetch fails, but still allow editing of bio/pic
        const contextUserAsProfile = {
            ...initialProfileState,
            username: authContextUser?.username || '',
            email: authContextUser?.email || '',
            registration_date: authContextUser?.registration_date || '',
            bio: authContextUser?.bio || '', // Include bio and pic from context if available
            profile_picture_url: authContextUser?.profile_picture_url || '',
        };
        setProfileData(contextUserAsProfile);
        setFormData(contextUserAsProfile);
      } finally {
        setIsLoading(false);
      }
    } else if (!authLoading && !authContextUser) {
      setError("You need to be logged in to view your profile.");
      setIsLoading(false);
      setProfileData(initialProfileState);
      setFormData(initialProfileState);
    }
  }, [authContextUser, token, authLoading]);

  useEffect(() => {
    if (!authLoading) {
        fetchProfile();
    }
  }, [fetchProfile, authLoading]);

  const handleEditToggle = () => {
    if (isEditing) {
      // When canceling edit, reset formData to the current profileData (which might be from context or last successful fetch/save)
      setFormData(profileData);
    } else {
      // When starting edit, ensure formData is based on the latest profileData
      setFormData(profileData);
    }
    setIsEditing(!isEditing);
    setError('');
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const updatePayload = {
        bio: formData.bio || '', // Ensure empty string if null/undefined
        profile_picture_url: formData.profile_picture_url || '',
      };
      // Use updateUserProfile which calls PUT /api/auth/me/profile
      const res = await updateUserProfile(updatePayload);
      const updatedData = { ...profileData, ...res.data }; // Merge with existing profileData to keep fields not returned by update
      setProfileData(updatedData);
      setFormData(updatedData);
      setIsEditing(false);
      reloadAuthContextUser(); // Reload user in AuthContext to reflect changes globally (e.g., navbar)
      alert("Profile updated successfully!");
    } catch (err) {
      console.error("Failed to update profile", err.response ? err.response.data : err.message);
      setError(err.response?.data?.msg || err.response?.data?.error || "Could not update profile. Please try again.");
    }
    setIsLoading(false);
  };

  if (authLoading && !authContextUser) { // Show global loading only if auth context is still loading initial user
    return (
      <div className="loading-container global-loading">
        <div className="spinner"></div>
        <p>Initializing...</p>
      </div>
    );
  }

  if (isLoading && !profileData.username && !authContextUser?.username) {
      return (
        <div className="loading-container-page">
            <div className="spinner-page"></div>
            <p>Loading Profile...</p>
        </div>
      );
  }

  if (error && !profileData.username && !authContextUser?.username) {
    return <p className="alert-message alert-error container">{error}</p>;
  }

  // Prioritize formData for display when editing, then profileData, then authContextUser as fallback
  const displayUsername = formData.username || profileData.username || authContextUser?.username || 'User';
  const displayEmail = formData.email || profileData.email || authContextUser?.email || 'No email provided';
  const displayRegDate = profileData.registration_date || authContextUser?.registration_date;
  const currentBio = isEditing ? formData.bio : profileData.bio;
  const currentProfilePic = isEditing ? formData.profile_picture_url : profileData.profile_picture_url;

  return (
    <div className="profile-page-container container">
      <header className="profile-header">
        <div className={`profile-avatar-placeholder ${!currentProfilePic ? 'initial-avatar' : ''}`}
             data-initial={displayUsername ? displayUsername.charAt(0).toUpperCase() : 'U'}>
          {currentProfilePic &&
            <img src={currentProfilePic} alt={`${displayUsername}'s profile`} className="profile-avatar-img"/>
          }
        </div>
        <h1>{displayUsername}'s Profile</h1>
        <p className="profile-email"><FaEnvelope className="icon"/> {displayEmail}</p>
        {!isEditing && (
            <button onClick={handleEditToggle} className="btn btn-outline profile-edit-btn">
                <FaEdit className="icon"/> Edit Profile
            </button>
        )}
      </header>

      {error && <p className="alert-message alert-error" style={{textAlign: 'center', maxWidth: '600px', margin: '0 auto var(--spacing-lg) auto'}}>{error}</p>}


      {isEditing ? (
        <form onSubmit={handleSubmit} className="profile-edit-form">
          <h3 className="profile-section-header"><FaEdit className="icon" /> Edit Your Information</h3>
          <div className="form-group">
            <label htmlFor="profile_picture_url">Profile Picture URL:</label>
            <input type="text" id="profile_picture_url" name="profile_picture_url" value={formData.profile_picture_url || ''} onChange={handleChange} placeholder="https://example.com/image.png"/>
          </div>
          <div className="form-group">
            <label htmlFor="bio">Bio:</label>
            <textarea id="bio" name="bio" value={formData.bio || ''} onChange={handleChange} rows="5" placeholder="Tell us a little about yourself..."></textarea>
          </div>
          <div className="form-actions">
            <button type="button" onClick={handleEditToggle} className="btn btn-ghost" disabled={isLoading}>
              <FaTimes className="icon"/> Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? <><span className="spinner-btn"></span> Saving...</> : <><FaSave className="icon"/> Save Changes</>}
            </button>
          </div>
        </form>
      ) : (
        <section className="profile-section profile-details">
          <h3 className="profile-section-header"><FaInfoCircle className="icon" /> About Me</h3>
          <div className="profile-detail-item">
            <p>{currentBio || 'No bio provided yet. Click "Edit Profile" to add one!'}</p>
          </div>

          <h3 className="profile-section-header" style={{marginTop: 'var(--spacing-xl)'}}><FaCalendarAlt className="icon" /> Account Details</h3>
          <div className="profile-detail-item">
            <p><strong>Joined:</strong> {displayRegDate ? new Date(displayRegDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</p>
            {/* <p><strong>MIDIs Uploaded:</strong> {profileData.midiUploadCount || 0}</p> */}
          </div>
        </section>
      )}

      {!isEditing && (
        <section className="profile-section profile-activity">
          <h3 className="profile-section-header"><FaMusic className="icon" /> My MIDIs</h3>
          <p>View all your uploaded MIDIs and manage them from your dedicated page.</p>
          <Link to="/my-midis" className="btn btn-secondary">
            <FaMusic className="icon" style={{marginRight: 'var(--spacing-sm)'}}/> View My MIDIs
          </Link>
        </section>
      )}
    </div>
  );
};

export default MyProfilePage;