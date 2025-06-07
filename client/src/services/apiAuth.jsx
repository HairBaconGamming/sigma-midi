// client/src/services/apiAuth.js
import api from './api';

export const loginUser = (userData) => api.post('/auth/login', userData);

export const registerUser = (userData) => api.post('/auth/register', userData);

// This requires the token to be set in the header,
// which AuthContext handles by setting api.defaults.headers.common
export const getAuthUser = () => api.get('/auth/user');