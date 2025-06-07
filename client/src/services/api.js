import axios from 'axios';

const api = axios.create({
  baseURL: '/api', // Backend API của webapp này
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor để log lỗi (tùy chọn)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response || error.message || error);
    return Promise.reject(error);
  }
);
export default api;