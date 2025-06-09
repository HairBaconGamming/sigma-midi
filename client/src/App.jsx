// client/src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async'; // <-- ENSURE THIS IMPORT IS PRESENT
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PlayerProvider } from './contexts/PlayerContext';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import MiniPlayerBar from './components/layout/MiniPlayerBar';
// Page imports
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import UploadPage from './pages/UploadPage';
import MidiDetailPage from './pages/MidiDetailPage';
import MyProfilePage from './pages/MyProfilePage';
import MyMidisPage from './pages/MyMidisPage';
import UserProfilePage from './pages/UserProfilePage';
import LeaderboardPage from './pages/LeaderboardPage';
import DesktopAppPage from './pages/DesktopAppPage';

import './assets/css/App.css';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="loading-container global-loading"> {/* Use global loading style */}
        <div className="spinner"></div>
        <p>Verifying Authentication...</p> {/* More specific message */}
      </div>
    );
  }
  return isAuthenticated ? children : <Navigate to="/login" replace />; // Added replace prop
};

function AppContent() {
  const { loadUser, loading: authLoading } = useAuth();

  useEffect(() => {
    // loadUser is called by AuthProvider's own useEffect,
    // but if you need to trigger it again on some AppContent specific event, keep it.
    // For initial load, AuthProvider handles it.
    // If AuthProvider already calls loadUser, you might not need this useEffect here.
    // loadUser(); 
  }, [loadUser]); // Be mindful of re-triggering loadUser if not necessary

  // authLoading from useAuth() indicates if the initial user authentication check is complete.
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
            element={<PrivateRoute><UploadPage /></PrivateRoute>}
          />
          <Route
            path="/profile"
            element={<PrivateRoute><MyProfilePage /></PrivateRoute>}
          />
          <Route
            path="/my-midis"
            element={<PrivateRoute><MyMidisPage /></PrivateRoute>}
          />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/profile/:userId" element={<UserProfilePage />} />
          <Route path="/desktop-app" element={<DesktopAppPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <MiniPlayerBar />
      <Footer />
    </>
  );
}

function App() {
  return (
    // StrictMode can be helpful for development, but sometimes can cause double renders
    // for useEffects with empty dependency arrays if not careful.
    //<React.StrictMode> 
      <HelmetProvider> {/* HelmetProvider should be high up, wrapping router usually */}
        <AuthProvider>
          <PlayerProvider>
            <Router>
              <AppContent />
            </Router>
          </PlayerProvider>
        </AuthProvider>
      </HelmetProvider>
    //</React.StrictMode>
  );
}

export default App;