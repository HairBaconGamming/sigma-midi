// client/src/components/layout/Footer.jsx
import React from 'react';
import { Link } from 'react-router-dom'; 
import '../../assets/css/Footer.css'; // Create this CSS file
import { FaGithub, FaTwitter, FaEnvelope } from 'react-icons/fa';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section about">
          <h1 className="logo-text">
            <span className="brand-sigma">sigma</span><span className="brand-midi">MIDI</span>
          </h1>
          <p>
            The ultimate repository for sharing and discovering MIDI files.
            Join our community and contribute your musical creations!
          </p>
          <div className="contact">
            <span><FaEnvelope /> info@sigmamidi.com</span>
            {/* Add more contact info if needed */}
          </div>
          <div className="socials">
            <a href="https://github.com/yourprofile/sigmamidi" target="_blank" rel="noopener noreferrer"><FaGithub /></a>
            <a href="https://twitter.com/sigmamidi" target="_blank" rel="noopener noreferrer"><FaTwitter /></a>
            {/* Add more social links */}
          </div>
        </div>

        <div className="footer-section links">
          <h2>Quick Links</h2>
          <ul>
            <li><a href="/about">About Us</a></li>
            <li><a href="/faq">FAQ</a></li>
            <li><a href="/terms">Terms of Service</a></li>
            <li><a href="/privacy">Privacy Policy</a></li>
            <li><Link to="/desktop-app"><FaDesktop style={{marginRight: '5px'}}/> Desktop App</Link></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </div>

        <div className="footer-section contact-form-placeholder">
          <h2>Stay Updated</h2>
          <p>Subscribe to our newsletter for the latest updates and new MIDIs.</p>
          <form action="#" method="post" className="newsletter-form">
            <input type="email" name="email" className="text-input contact-input" placeholder="Your email address..." />
            <button type="submit" className="btn btn-newsletter">
              Subscribe
            </button>
          </form>
        </div>
      </div>

      <div className="footer-bottom">
        © {currentYear} sigmaMIDI | Designed by YourName/YourTeam
      </div>
    </footer>
  );
};

export default Footer;