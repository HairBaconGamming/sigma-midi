// client/src/pages/DesktopAppPage.jsx
import React from 'react';
import { FaDesktop, FaWindows, FaDownload, FaGithub, FaStarHalfAlt } from 'react-icons/fa';
import '../assets/css/DesktopAppPage.css'; // We'll create this CSS file

const DesktopAppPage = () => {
  const downloadLink = "https://drive.google.com/file/d/1SRRieQ__B4Mu8vNJrit9J0yD-OTBBcGN/view?usp=sharing";
  // It's better if the above link directly triggers a download. 
  // Google Drive links often go to a preview page first.
  // If possible, create a direct download link or host the .exe/.zip on a service that provides one.
  // For example, a GitHub release asset URL.

  const directDownloadLinkWorkaround = "https://drive.google.com/uc?export=download&id=1SRRieQ__B4Mu8vNJrit9J0yD-OTBBcGN";


  return (
    <div className="desktop-app-page-container container">
      <header className="desktop-app-header">
        <FaDesktop className="header-icon" />
        <h1>sigmaMIDI Desktop Player</h1>
        <p>Enhance your MIDI experience with our dedicated desktop application for Windows.</p>
      </header>

      <section className="desktop-app-section features-section">
        <h2><FaStarHalfAlt className="icon" /> Key Features</h2>
        <ul>
          <li>🎹 Play MIDI files locally with advanced controls.</li>
          <li>🎮 Specialized "Play on Roblox" mode for seamless integration.</li>
          <li>🌐 Browse and download MIDIs directly from the sigmaMIDI online repository.</li>
          <li>⚙️ Customizable note mapping, playback speed, and transposition.</li>
          <li> Mute individual MIDI tracks for practice or arrangement.</li>
          <li> Kèm theo đó là âm lượng hệ thống và giao diện tùy chỉnh</li>
          <li>🎨 Visual piano roll and keyboard display.</li>
          <li>🔄 Persistent settings to save your preferences.</li>
        </ul>
      </section>

      <section className="desktop-app-section download-section">
        <h2><FaDownload className="icon" /> Download for Windows</h2>
        <p>
          Get the latest version of the sigmaMIDI Desktop Player.
          <br />
          Compatible with Windows 7, 8, 10, and 11.
        </p>
        <a 
          href={directDownloadLinkWorkaround} // Use the direct download workaround
          className="btn btn-primary btn-download-app" 
          target="_blank" // Open in new tab, Google Drive might still show intermediate page
          rel="noopener noreferrer"
        >
          <FaWindows className="icon" /> Download sigmaMIDI Player (.exe / .zip)
        </a>
        <p className="download-note">
          Note: The application is currently available for Windows. <br/>
          The file might be a `.zip` containing the executable or a direct `.exe`. Please check your browser's security settings if you encounter issues.
        </p>
      </section>

      <section className="desktop-app-section requirements-section">
        <h3>System Requirements</h3>
        <ul>
          <li>Operating System: Windows 7 or newer</li>
          <li>Python: (If running from source - not needed for .exe) Python 3.8+</li>
          <li>Dependencies: (If running from source) PyQT6, Mido, Pygame, Keyboard, etc.</li>
          <li>Disk Space: ~50-100MB (may vary)</li>
        </ul>
      </section>
      
      <section className="desktop-app-section source-code-section">
          <h2><FaGithub className="icon" /> Source Code & Contributions</h2>
          <p>
              The desktop player is open source! You can find the source code, report issues, or contribute to its development on GitHub.
          </p>
          <a 
            href="https://github.com/HairBaconGamming/sigmaMIDIs" // Replace with actual link
            className="btn btn-outline btn-github-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaGithub className="icon" /> View on GitHub
          </a>
      </section>

      <section className="desktop-app-section feedback-section">
        <h3>Feedback & Support</h3>
        <p>
          Have questions or feedback? Join our community or contact us through the main website.
        </p>
        {/* Add link to contact page or community if you have one */}
      </section>
    </div>
  );
};

export default DesktopAppPage;