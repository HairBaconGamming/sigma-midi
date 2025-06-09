// client/src/App.jsx
import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { PlayerProvider } from "./contexts/PlayerContext";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import MiniPlayerBar from "./components/layout/MiniPlayerBar";
// Page imports
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import UploadPage from "./pages/UploadPage";
import MidiDetailPage from "./pages/MidiDetailPage";
import MyProfilePage from "./pages/MyProfilePage";
import MyMidisPage from "./pages/MyMidisPage";
import UserProfilePage from "./pages/UserProfilePage";
import LeaderboardPage from "./pages/LeaderboardPage";
import DesktopAppPage from "./pages/DesktopAppPage";
import EditMidiPage from "./pages/EditMidiPage";

// Import new info pages
import AboutUsPage from "./pages/info/AboutUsPage";
import FAQPage from "./pages/info/FAQPage";
import TermsOfServicePage from "./pages/info/TermsOfServicePage";
import PrivacyPolicyPage from "./pages/info/PrivacyPolicyPage";
import ContactPage from "./pages/info/ContactPage";

import "./assets/css/App.css";

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="loading-container global-loading">
        <div className="spinner"></div>
        <p>Verifying Authentication...</p>
      </div>
    );
  }
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function AppContent() {
  const { loading: authLoading } = useAuth(); // Removed loadUser, AuthProvider handles it

  // useEffect(() => {
  //   // loadUser(); // This is likely redundant if AuthProvider's useEffect calls it
  // }, [loadUser]);

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
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <MyProfilePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/my-midis"
            element={
              <PrivateRoute>
                <MyMidisPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/midi/edit/:id" // THÊM ROUTE NÀY
            element={
              <PrivateRoute>
                <EditMidiPage />
              </PrivateRoute>
            }
          />n
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/profile/:userId" element={<UserProfilePage />} />
          <Route path="/desktop-app" element={<DesktopAppPage />} />

          {/* New Info Page Routes */}
          <Route path="/about" element={<AboutUsPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/contact" element={<ContactPage />} />

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
    <React.StrictMode>
      {" "}
      {/* Keep StrictMode for development benefits */}
      <HelmetProvider>
        <AuthProvider>
          <PlayerProvider>
            <Router>
              <AppContent />
            </Router>
          </PlayerProvider>
        </AuthProvider>
      </HelmetProvider>
    </React.StrictMode>
  );
}

export default App;
