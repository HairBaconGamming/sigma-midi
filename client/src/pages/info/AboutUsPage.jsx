// client/src/pages/info/AboutUsPage.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import '../../assets/css/InfoPage.css'; // We'll create a generic InfoPage.css

const AboutUsPage = () => {
  return (
    <>
      <Helmet>
        <title>About Us - sigmaMIDI</title>
        <meta name="description" content="Learn more about sigmaMIDI, our mission, and the team behind the ultimate MIDI sharing platform." />
      </Helmet>
      <div className="info-page-container container">
        <header className="info-page-header">
          <h1>About sigmaMIDI</h1>
        </header>
        <section className="info-page-content">
          <p>Welcome to sigmaMIDI, your ultimate destination for discovering, sharing, and exploring MIDI files!</p>
          <h2>Our Mission</h2>
          <p>
            At sigmaMIDI, we believe in the power of music to connect and inspire. Our mission is to provide a vibrant, open, and accessible platform for musicians, composers, hobbyists, and music enthusiasts to:
          </p>
          <ul>
            <li>Share their own MIDI creations with a global community.</li>
            <li>Discover a vast library of MIDI files across all genres and styles.</li>
            <li>Learn and practice music using high-quality MIDI renditions.</li>
            <li>Collaborate and find inspiration from fellow music lovers.</li>
          </ul>

          <h2>What is MIDI?</h2>
          <p>
            MIDI (Musical Instrument Digital Interface) is a technical standard that describes a protocol, digital interface, and connectors and allows a wide variety of electronic musical instruments, computers, and other related devices to connect and communicate with one another. A MIDI file does not contain actual audio data but rather "instructions" on how music should be played, such as which notes to play, when to play them, how loud, and for how long.
          </p>

          <h2>Why sigmaMIDI?</h2>
          <p>
            We aim to be more than just a repository. sigmaMIDI offers:
          </p>
          <ul>
            <li><strong>A User-Friendly Interface:</strong> Easy to navigate, upload, and find what you're looking for.</li>
            <li><strong>Advanced Search & Filtering:</strong> Quickly locate MIDIs by title, artist, genre, tags, and more.</li>
            <li><strong>Integrated MIDI Player:</strong> Preview MIDIs directly in your browser.</li>
            <li><strong>Desktop Application:</strong> Enhance your experience with our dedicated desktop player, featuring advanced playback controls and unique integrations (like "Play on Roblox").</li>
            <li><strong>Community Focused:</strong> We encourage interaction, feedback, and contributions from all users.</li>
            <li><strong>Constantly Evolving:</strong> We are committed to continuously improving the platform and adding new features based on community feedback.</li>
          </ul>

          <h2>The Team</h2>
          <p>
            sigmaMIDI was created by a passionate team of developers and music enthusiasts dedicated to building the best possible MIDI sharing experience. We are [Your Name/Team Name], and we love music as much as you do!
          </p>
          <p>
            (Consider adding a bit more about your team or your motivation if you like.)
          </p>

          <h2>Get Involved!</h2>
          <p>
            Whether you're here to upload your masterpieces, find the perfect MIDI for your project, or simply explore the world of digital music, we're thrilled to have you. Join our community, start sharing, and let the music play!
          </p>
          <p>
            If you have any questions, feedback, or suggestions, please don't hesitate to <Link to="/contact">contact us</Link>.
          </p>
        </section>
      </div>
    </>
  );
};

export default AboutUsPage;