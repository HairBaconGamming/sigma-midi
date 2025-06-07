import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api'; // Axios instance
import { loginUser, registerUser, getAuthUser } from '../services/apiAuth';
import jwt_decode from 'jwt-decode';


const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true); // Ban đầu là true để load user

  const setAuthToken = useCallback((newToken) => {
    if (newToken) {
      localStorage.setItem('token', newToken);
      api.defaults.headers.common['x-auth-token'] = newToken;
      setToken(newToken);
    } else {
      localStorage.removeItem('token');
      delete api.defaults.headers.common['x-auth-token'];
      setToken(null);
    }
  }, []);


  const loadUser = useCallback(async () => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setAuthToken(storedToken); // Set header cho các request sau
      try {
        // const decoded = jwt_decode(storedToken); // Kiểm tra token hết hạn
        // if (decoded.exp * 1000 < Date.now()) {
        //   logout(); // Token hết hạn
        //   return;
        // }
        const res = await getAuthUser(); // Gọi API /api/auth/user
        setUser(res.data);
        setIsAuthenticated(true);
      } catch (err) {
        console.error("Error loading user:", err);
        setAuthToken(null); // Xóa token nếu không hợp lệ
        setUser(null);
        setIsAuthenticated(false);
      }
    }
    setLoading(false);
  }, [setAuthToken]);


  useEffect(() => {
    loadUser();
  }, [loadUser]);


  const login = async (username, password) => {
    try {
      const res = await loginUser({ username, password });
      setAuthToken(res.data.token);
      setUser(res.data.user);
      setIsAuthenticated(true);
      setLoading(false);
      return res.data;
    } catch (err) {
      console.error("Login failed in context", err);
      setLoading(false);
      throw err;
    }
  };

  const register = async (username, password) => {
    try {
      const res = await registerUser({ username, password });
      setAuthToken(res.data.token);
      setUser(res.data.user);
      setIsAuthenticated(true);
      setLoading(false);
      return res.data;
    } catch (err) {
      console.error("Register failed in context", err);
      setLoading(false);
      throw err;
    }
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setLoading(false);
  };

  const value = {
    user,
    token,
    isAuthenticated,
    loading,
    login,
    register,
    logout,
    loadUser,
    setAuthToken
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};