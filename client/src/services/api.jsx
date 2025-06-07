// client/src/services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: '/api', // Assumes your backend API is served from /api
  headers: {
    'Content-Type': 'application/json',
  },
});

// Optional: Add a request interceptor to include the token
// This is an alternative to setting it globally in AuthContext,
// or can be a fallback if the global one is somehow cleared.
// api.interceptors.request.use(config => {
//   const token = localStorage.getItem('token');
//   if (token) {
//     config.headers['x-auth-token'] = token;
//   }
//   return config;
// }, error => {
//   return Promise.reject(error);
// });


// Optional: Add a response interceptor for global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Example: Handle 401 Unauthorized (e.g., token expired) globally
    if (error.response && error.response.status === 401) {
      // Potentially trigger a logout or token refresh mechanism
      // localStorage.removeItem('token');
      // window.location.href = '/login'; // Force redirect
      console.error('API Error 401: Unauthorized. Token might be invalid or expired.');
    } else {
        console.error('API Error:', error.response ? error.response.data : error.message);
    }
    return Promise.reject(error);
  }
);

export default api;