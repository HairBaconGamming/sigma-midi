import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import UploadPage from './pages/UploadPage';
import MidiDetailPage from './pages/MidiDetailPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import api from './services/api'; // Helper để set token cho axios
import './assets/css/App.css'; // CSS chung

// Component PrivateRoute để bảo vệ route cần login
const PrivateRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    if (loading) return <div>Loading...</div>; // Hoặc spinner
    return isAuthenticated ? children : <Navigate to="/login" />;
};

function AppContent() {
    const { loadUser } = useAuth();
    useEffect(() => {
        loadUser(); // Tải thông tin user khi app khởi động nếu có token
    }, [loadUser]);

    return (
        <>
            <Navbar />
            <div className="container">
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/midi/:id" element={<MidiDetailPage />} />
                    <Route
                        path="/upload"
                        element={
                            <PrivateRoute>
                                <UploadPage />
                            </PrivateRoute>
                        }
                    />
                    {/* Thêm các route khác nếu cần */}
                </Routes>
            </div>
        </>
    );
}


function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;