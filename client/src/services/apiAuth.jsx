import api from './api';

export const loginUser = (userData) => api.post('/auth/login', userData);
export const registerUser = (userData) => api.post('/auth/register', userData);
export const getAuthUser = () => api.get('/auth/user'); // Cần token trong header