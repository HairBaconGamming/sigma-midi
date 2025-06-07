// client/src/pages/MyProfilePage.jsx
import React, { useEffect, useState, useCallback } from 'react'; // Thêm useCallback
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import '../assets/css/ProfilePage.css'; // Đảm bảo đã import CSS
import { FaUserCircle, FaEnvelope, FaCalendarAlt, FaInfoCircle, FaEdit, FaSave, FaTimes, FaMusic } from 'react-icons/fa'; // Thêm icons

const initialProfileState = {
  username: '',
  email: '',
  bio: '',
  profile_picture_url: '',
  registration_date: '',
  midiUploadCount: 0, // Ví dụ thêm trường này
  // Thêm các trường khác bạn mong đợi từ API
};

const MyProfilePage = () => {
  const { user, loading: authLoading, token } = useAuth();
  const [profileData, setProfileData] = useState(initialProfileState); // Khởi tạo với object
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(initialProfileState); // Form data cũng khởi tạo tương tự

  const fetchProfile = useCallback(async () => {
    if (user && token) {
      setIsLoading(true);
      setError('');
      try {
        // Endpoint này cần được điều chỉnh ở backend để trả về đủ thông tin
        const res = await api.get(`/users/profile/${user.id}`); // Hoặc /api/auth/me
        setProfileData({ ...initialProfileState, ...res.data }); // Merge với initial để đảm bảo có đủ key
        setFormData({ ...initialProfileState, ...res.data }); // Set form data khi fetch thành công
      } catch (err) {
        console.error("Failed to fetch profile", err.response ? err.response.data : err.message);
        setError("Could not load your profile data. Please try again later.");
        setProfileData(initialProfileState); // Reset về initial nếu lỗi
      } finally {
        setIsLoading(false);
      }
    } else if (!authLoading && !user) {
      setError("You need to be logged in to view your profile.");
      setIsLoading(false);
      setProfileData(initialProfileState); // Reset nếu không có user
    }
  }, [user, token, authLoading]); // Thêm authLoading vào dependencies

  useEffect(() => {
    if (!authLoading) { // Chỉ fetch khi auth state đã được xác định
        fetchProfile();
    }
  }, [fetchProfile, authLoading]); // authLoading ở đây nữa

  const handleEditToggle = () => {
    if (isEditing) {
      // Nếu đang edit mà cancel, reset form về profileData hiện tại
      setFormData(profileData);
    }
    setIsEditing(!isEditing);
    setError(''); // Clear lỗi khi toggle edit mode
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      // Chỉ gửi các trường có thể thay đổi, ví dụ bio và profile_picture_url
      const updatePayload = {
        bio: formData.bio,
        profile_picture_url: formData.profile_picture_url,
        // Thêm các trường khác nếu cho phép edit
      };
      // Endpoint này cần được tạo ở backend (cả webapp và db-api)
      const res = await api.put(`/users/profile/${user.id}`, updatePayload);
      setProfileData({ ...initialProfileState, ...res.data });
      setFormData({ ...initialProfileState, ...res.data });
      setIsEditing(false);
      // setSuccess("Profile updated successfully!"); // Nên có state cho success message
      alert("Profile updated successfully!");
    } catch (err) {
      console.error("Failed to update profile", err.response ? err.response.data : err.message);
      setError(err.response?.data?.error || "Could not update profile. Please try again.");
    }
    setIsLoading(false);
  };

  if (authLoading) { // Hiển thị loading toàn cục khi auth state chưa sẵn sàng
    return (
      <div className="loading-container global-loading"> {/* Sử dụng global loading */}
        <div className="spinner"></div>
        <p>Initializing...</p>
      </div>
    );
  }

  if (isLoading && !profileData.username) { // Hiển thị loading khi đang fetch profile lần đầu
      return (
        <div className="loading-container-page">
            <div className="spinner-page"></div>
            <p>Loading Profile...</p>
        </div>
      )
  }


  if (error && !profileData.username) { // Chỉ hiển thị lỗi toàn trang nếu không có data nào
    return <p className="alert-message alert-error">{error}</p>;
  }

  // Ngay cả khi có lỗi fetch nhưng user đã login, vẫn hiển thị phần cơ bản
  const displayUsername = profileData.username || user?.username || 'User';
  const displayEmail = profileData.email || user?.email || 'No email provided';
  const displayRegDate = profileData.registration_date || user?.registration_date;

  return (
    <div className="profile-page-container container">
      <header className="profile-header">
        <div className={`profile-avatar-placeholder ${!formData.profile_picture_url ? 'initial-avatar' : ''}`}
             data-initial={displayUsername ? displayUsername.charAt(0).toUpperCase() : 'U'}>
          {formData.profile_picture_url &&
            <img src={formData.profile_picture_url} alt={`${displayUsername}'s profile`} className="profile-avatar-img"/>
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

      {error && isEditing && <p className="alert-message alert-error">{error}</p>}

      {isEditing ? (
        <form onSubmit={handleSubmit} className="profile-edit-form">
          <div className="form-group">
            <label htmlFor="profile_picture_url">Profile Picture URL:</label>
            <input type="text" id="profile_picture_url" name="profile_picture_url" value={formData.profile_picture_url || ''} onChange={handleChange} placeholder="https://example.com/image.png"/>
          </div>
          <div className="form-group">
            <label htmlFor="bio">Bio:</label>
            <textarea id="bio" name="bio" value={formData.bio || ''} onChange={handleChange} rows="5" placeholder="Tell us a little about yourself..."></textarea>
          </div>
          {/* Thêm các trường có thể edit khác ở đây */}
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
            {/* <h4>Bio</h4> */}
            <p>{profileData.bio || 'No bio provided yet. Click "Edit Profile" to add one!'}</p>
          </div>

          <h3 className="profile-section-header" style={{marginTop: 'var(--spacing-xl)'}}><FaCalendarAlt className="icon" /> Account Details</h3>
          <div className="profile-detail-item">
            <p><strong>Joined:</strong> {displayRegDate ? new Date(displayRegDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</p>
            {/* <p><strong>MIDIs Uploaded:</strong> {profileData.midiUploadCount || 0}</p> */}
            {/* <p><strong>Last Login:</strong> {profileData.last_login_date ? new Date(profileData.last_login_date).toLocaleString() : 'N/A'}</p> */}
          </div>
        </section>
      )}

      {!isEditing && (
        <section className="profile-section profile-activity">
          <h3 className="profile-section-header"><FaMusic className="icon" /> My MIDIs</h3>
          {/* Placeholder: Liên kết đến trang My MIDIs hoặc hiển thị một vài MIDI gần đây */}
          <p>View all your uploaded MIDIs on your dedicated page.</p>
          <Link to="/my-midis" className="btn btn-secondary">View My MIDIs</Link>
        </section>
      )}
    </div>
  );
};

export default MyProfilePage;