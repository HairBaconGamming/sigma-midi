// client/src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { loginUser as apiLoginUser, registerUser as apiRegisterUser, getAuthUser as apiGetAuthUser } from '../services/apiAuth';
// import jwt_decode from 'jwt-decode'; // Can be used for client-side token expiration check

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const setAuthTokenHeader = useCallback((newToken) => {
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
      setAuthTokenHeader(storedToken);
      try {
        // Optional: Client-side token expiration check
        // const decoded = jwt_decode(storedToken);
        // if (decoded.exp * 1000 < Date.now()) {
        //   console.log("Token expired, logging out.");
        //   logout();
        //   setLoading(false);
        //   return;
        // }
        const res = await apiGetAuthUser();
        setUser(res.data);
        setIsAuthenticated(true);
      } catch (err) {
        console.error("Error loading user:", err.response ? err.response.data : err.message);
        setAuthTokenHeader(null);
        setUser(null);
        setIsAuthenticated(false);
      }
    }
    setLoading(false);
  }, [setAuthTokenHeader]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const res = await apiLoginUser({ username, password });
      setAuthTokenHeader(res.data.token);
      setUser(res.data.user);
      setIsAuthenticated(true);
      setLoading(false);
      return res.data;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const register = async (username, password) => {
    setLoading(true);
    try {
      const res = await apiRegisterUser({ username, password });
      setAuthTokenHeader(res.data.token);
      setUser(res.data.user);
      setIsAuthenticated(true);
      setLoading(false);
      return res.data;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const logout = useCallback(() => {
    setAuthTokenHeader(null);
    setUser(null);
    setIsAuthenticated(false);
    // No need to set loading here unless there's an async logout process
  }, [setAuthTokenHeader]);

  const value = {
    user,
    token,
    isAuthenticated,
    loading, // This loading is for the initial user load / auth state determination
    login,
    register,
    logout,
    loadUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};