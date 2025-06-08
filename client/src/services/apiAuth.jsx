// client/src/services/apiAuth.jsx
import api from './api';

export const loginUser = (userData) => api.post('/auth/login', userData);

export const registerUser = (userData) => api.post('/auth/register', userData);

// This requires the token to be set in the header,
// which AuthContext handles by setting api.defaults.headers.common
export const getAuthUser = () => api.get('/auth/me'); // Changed to /me to match backend

// NEW: Route để lấy profile công khai của user khác (nếu cần)
// Đảm bảo route này tồn tại ở backend (ví dụ: /api/auth/profile/:userId)
export const getUserPublicProfile = (userId) => api.get(`/auth/profile/${userId}`);

// NEW: Route để cập nhật profile của user đang login
// Đảm bảo route này tồn tại ở backend (ví dụ: /api/auth/me/profile)
export const updateUserProfile = (profileData) => api.put('/auth/me/profile', profileData);


// EXPORT HÀM NÀY
export const getLeaderboard = (params) => api.get('/auth/leaderboard', { params });