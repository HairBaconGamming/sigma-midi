// client/src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate }
from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import UploadPage from './pages/UploadPage';
import MidiDetailPage from './pages/MidiDetailPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './assets/css/App.css';
import Footer from './components/layout/Footer'; // Import Footer

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading User...</p>
      </div>
    );
  }
  return isAuthenticated ? children : <Navigate to="/login" />;
};

function AppContent() {
  const { loadUser, loading: authLoading } = useAuth(); // Get authLoading state

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Show a global loading indicator while auth state is being determined
  if (authLoading) {
    return (
      <div className="loading-container global-loading">
        <div className="spinner"></div>
        <p>Initializing sigmaMIDI...</p>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="main-content">
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
          {/* Add a catch-all for 404 if desired */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer /> {/* Add Footer */}
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