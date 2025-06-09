// client/src/pages/MidiDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getMidiById, trackMidiDownload, getMidiFileStreamUrl } from '../services/apiMidis';
import {
  FaDownload, FaPlayCircle, FaPauseCircle, FaUser, FaCalendarAlt, FaInfoCircle,
  FaTachometerAlt, FaMusic, FaEye, FaUserEdit, FaArrowLeft, FaTags, FaGuitar,
  FaStopwatch, FaStarHalfAlt, FaClipboardList
  // FaShareAlt, FaHeart, FaRegHeart // For future features
} from 'react-icons/fa';
import { Helmet } from 'react-helmet-async';
import { usePlayer } from '../contexts/PlayerContext'; // Import global player context
import { useAuth } from '../contexts/AuthContext';   // For user data, e.g., owner checks

import '../assets/css/MidiDetailPage.css';

const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (e) {
        console.warn("Error formatting date:", dateString, e);
        return 'Invalid Date';
    }
};

const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === null || seconds === undefined || seconds < 0) return 'N/A'; // Changed from 0:00 to N/A for consistency
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}m ${s}s`; // Changed format to "Xm YYs" for clarity
};


const MidiDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: authUser } = useAuth(); // Get authenticated user for potential owner actions

  // Global Player context
  const { 
    playMidi, // Function to start playing a MIDI in the global player
    togglePlay, // Function to toggle play/pause of the currently loaded MIDI in global player
    currentPlayingMidi, 
    isPlaying: globalIsPlaying,
    isPianoSamplerReady, // Check if the global piano is ready
    isLoadingPlayer: isGlobalPlayerLoading,
  } = usePlayer();

  const [midi, setMidi] = useState(null); // Local state for this page's MIDI details
  const [loading, setLoading] = useState(true); // Loading state for fetching this page's MIDI details
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMidiDetails = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getMidiById(id);
        setMidi(res.data);
      } catch (err) {
        console.error("Failed to fetch MIDI details for page", err.response ? err.response.data : err.message);
        if (err.response && err.response.status === 404) {
            setError('Sorry, this MIDI could not be found or is not public.');
        } else {
            setError('An error occurred while loading MIDI details. Please try again later.');
        }
        setMidi(null); // Clear previous midi data on error
      } finally {
        setLoading(false);
      }
    };
    fetchMidiDetails();
  }, [id]);

  const handleDownload = async () => {
    if (!midi || !midi.fileId) {
      alert("MIDI file information not available for download.");
      return;
    }
    try {
      await trackMidiDownload(midi._id);
      const downloadUrl = getMidiFileStreamUrl(midi.fileId);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', midi.original_filename || `midi_${midi._id}.mid`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setMidi(prev => prev ? ({ ...prev, downloads: (prev.downloads || 0) + 1 }) : null);
    } catch (downloadError) {
      console.error("Error tracking download or initiating download:", downloadError);
      alert("Could not initiate download. Please try again.");
    }
  };

  const handlePlayButtonClick = () => {
    if (!midi) return;

    // If this MIDI is already the one in the global player, just toggle its state
    if (currentPlayingMidi && currentPlayingMidi._id === midi._id) {
      togglePlay(); // Toggle play/pause for the already loaded MIDI
    } else {
      // If a different MIDI is playing, or no MIDI, load and play this one
      playMidi(midi); // This will load, parse, schedule, and play in the global context
    }
  };

  // Determine if the MIDI displayed on this page is the one currently active in the global player
  const isThisMidiActiveInGlobalPlayer = currentPlayingMidi && currentPlayingMidi._id === midi?._id;
  const playButtonText = isThisMidiActiveInGlobalPlayer && globalIsPlaying ? 'Pause in Bar' : 'Play in Bar';
  const PlayButtonIcon = isThisMidiActiveInGlobalPlayer && globalIsPlaying ? FaPauseCircle : FaPlayCircle;


  // --- Meta Tags for SEO and Social Sharing ---
  const pageTitle = midi ? `${midi.title} by ${midi.artist || 'Unknown Artist'} - sigmaMIDI` : 'MIDI Details - sigmaMIDI';
  const pageDescription = midi ? `Listen to, download, and explore the MIDI file "${midi.title}" by ${midi.artist || 'Unknown Artist'}. Genre: ${midi.genre || 'N/A'}. Uploaded by ${midi.uploader?.username || 'User'}.` : 'View details for this MIDI file on sigmaMIDI, the ultimate MIDI repository.';
  const pageUrl = window.location.href;
  const imageUrl = midi?.thumbnail_url || (midi ? `/api/midis/placeholder-thumbnail/${(parseInt(midi._id.slice(-5), 16) % 20)}.png` : `https://midi-sigma.glitch.me/og-image.png`);


  if (loading) {
    return (
      <div className="loading-container-page">
        <div className="spinner-page"></div>
        <p>Loading MIDI Details...</p>
      </div>
    );
  }
  if (error) return <p className="alert-message alert-error container">{error}</p>;
  if (!midi) return <p className="no-results-message-page container">MIDI not found or not accessible.</p>;

  // Safely access uploader info
  const uploaderUsername = midi.uploader?.username || 'Unknown User';
  const uploaderIdForLink = midi.uploader?._id; // Will be undefined if no uploader
  const displayDuration = formatTime(currentPlayingMidi && currentPlayingMidi._id === midi._id 
                                      ? currentPlayingMidi.duration // Prefer duration from global player if it's this MIDI
                                      : midi.duration_seconds);     // Otherwise, use static duration

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="title" content={pageTitle} />
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={pageUrl} />
        
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={new URL(imageUrl, window.location.origin).href} /> {/* Ensure absolute URL */}
        <meta property="og:type" content="music.song" />
        <meta property="og:site_name" content="sigmaMIDI" />
        {midi.artist && <meta property="music:musician" content={midi.artist} />}
        {/* Add more OG tags like music:duration, music:album, etc. if available */}

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={new URL(imageUrl, window.location.origin).href} />
      </Helmet>

      <div className="midi-detail-page-container container">
        <button onClick={() => navigate(-1)} className="back-button" title="Go back to previous page">
          <FaArrowLeft /> Back
        </button>

        <article className="midi-detail-content-card">
          <header className="midi-detail-header">
            <div className="header-thumbnail-container">
                <img 
                    src={midi.thumbnail_url || `/api/midis/placeholder-thumbnail/${(parseInt(midi._id.slice(-5), 16) % 20)}.png`} 
                    alt={`${midi.title} thumbnail`} 
                    className="header-thumbnail" 
                />
            </div>
            <div className="header-info">
                <h1>{midi.title}</h1>
                <p className="header-artist">
                    <FaMusic className="icon" /> By: {midi.artist || 'Unknown Artist'}
                </p>
                {midi.arrangement_by && (
                    <p className="header-arrangement">
                    <FaUserEdit className="icon" /> Arrangement: {midi.arrangement_by}
                    </p>
                )}
                <div className="header-meta">
                    <span>
                        <FaUser className="icon" /> Uploaded by:
                        {uploaderIdForLink ? (
                            <Link to={`/profile/${uploaderIdForLink}`} className="uploader-link">{uploaderUsername}</Link>
                        ) : (
                            <span className="uploader-link">{uploaderUsername}</span>
                        )}
                    </span>
                    <span><FaCalendarAlt className="icon" /> On: {formatDate(midi.upload_date)}</span>
                    {midi.last_updated_date && new Date(midi.last_updated_date).toISOString() !== new Date(midi.upload_date).toISOString() && (
                         <span><FaCalendarAlt className="icon" /> Updated: {formatDate(midi.last_updated_date)}</span>
                    )}
                </div>
            </div>
          </header>

          <div className="midi-detail-actions-bar">
              <button 
                onClick={handlePlayButtonClick} 
                className={`btn-detail-action btn-play-detail ${isThisMidiActiveInGlobalPlayer && globalIsPlaying ? 'playing' : ''}`}
                disabled={!isPianoSamplerReady || isGlobalPlayerLoading || !midi.fileId}
                title={playButtonText}
              >
                <PlayButtonIcon className="icon" /> {playButtonText}
              </button>
              <button onClick={handleDownload} className="btn-detail-action btn-download-detail" disabled={!midi.fileId}>
                <FaDownload className="icon" /> Download ({midi.size_bytes ? `${(midi.size_bytes / 1024).toFixed(1)} KB` : 'N/A'})
              </button>
              <div className="detail-stats">
                  <span><FaEye className="icon" /> {midi.views || 0}</span>
                  <span><FaDownload className="icon" /> {midi.downloads || 0}</span>
                  {/* Example: <span><FaStarHalfAlt className="icon" /> {midi.rating_avg?.toFixed(1) || 'N/A'} ({midi.rating_count || 0})</span> */}
              </div>
          </div>
          
          {/* The actual audio player is now the global MiniPlayerBar. 
              You could add a visual-only piano roll here if desired,
              which would listen to playbackTime from PlayerContext if currentPlayingMidi matches this page's midi.
              For simplicity, this section is removed if it was purely for audio.
          */}
          {/* Example placeholder if you want a visualizer section on this page */}
          {/* <div className="midi-visualizer-placeholder-on-page">
             <p>Visualizer for {midi.title} would go here.</p>
             {isThisMidiActiveInGlobalPlayer && <p>Currently playing in mini-bar. Time: {formatTime(globalPlayerTime)}</p>}
          </div> */}


          {midi.description && (
            <section className="midi-detail-section description-section">
              <h3><FaInfoCircle className="icon" /> Description</h3>
              <p className="description-text">{midi.description}</p>
            </section>
          )}

          <section className="midi-detail-section metadata-section">
             <h3><FaClipboardList className="icon" /> Details & Metadata</h3>
            <ul>
              <li><strong>Original Filename:</strong> {midi.original_filename || 'N/A'}</li>
              {midi.genre && <li><strong><FaTags className="icon"/> Genre:</strong> {midi.genre}</li>}
              {midi.tags && midi.tags.length > 0 && 
                  <li><strong><FaTags className="icon"/> Tags:</strong> 
                      <span className="tags-list">{midi.tags.map(tag => <span key={tag} className="tag-item">{tag}</span>)}</span>
                  </li>
              }
              {midi.bpm && <li><strong><FaTachometerAlt className="icon"/> BPM (Tempo):</strong> {midi.bpm}</li>}
              <li><strong><FaStopwatch className="icon"/> Duration:</strong> {displayDuration}</li>
              {midi.key_signature && <li><strong>Key:</strong> {midi.key_signature}</li>}
              {midi.time_signature && <li><strong>Time Signature:</strong> {midi.time_signature}</li>}
              {midi.instrumentation && <li><strong><FaGuitar className="icon"/> Instrumentation:</strong> {midi.instrumentation}</li>}
              {midi.difficulty && 
                  <li><strong><FaStarHalfAlt className="icon"/> Difficulty:</strong> 
                      <span className={`difficulty-level difficulty-${midi.difficulty}`}>{midi.difficulty}/5</span>
                  </li>
              }
            </ul>
          </section>

        </article>
      </div>
    </>
  );
};

export default MidiDetailPage;