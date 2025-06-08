// client/src/pages/MidiDetailPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getMidiById, trackMidiDownload, getMidiFileStreamUrl } from '../services/apiMidis';
import { FaDownload, FaPlayCircle, FaPauseCircle, FaUser, FaCalendarAlt, FaInfoCircle, FaTachometerAlt, FaMusic, FaEye, FaUserEdit, FaArrowLeft, FaTags, FaGuitar, FaStopwatch, FaStarHalfAlt, FaClipboardList, FaShareAlt, FaHeart, FaRegHeart } from 'react-icons/fa'; // Added more icons
// import * as Tone from 'tone'; // Uncomment if using Tone.js
// import { Midi as ToneMidi } from '@tonejs/midi'; // Uncomment if using Tone.js
import '../../assets/css/MidiDetailPage.css'; // Ensure this CSS file is created and styled
import { useAuth } from '../../contexts/AuthContext'; // For potential user-specific actions

const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (e) {
        return 'N/A';
    }
};

const formatDuration = (seconds) => {
    if (seconds === null || seconds === undefined || seconds < 0) return 'N/A';
    const m = Math.floor(seconds / 60);
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}m ${s}s`;
};


const MidiDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth(); // Get auth state for potential actions

  const [midi, setMidi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false); // For client-side player state
  // const [isFavorited, setIsFavorited] = useState(false); // Example for favorite state
  // const [currentRating, setCurrentRating] = useState(0); // Example for user's rating

  // Refs for Tone.js or other players
  // const tonePlayerRef = useRef(null);
  // const toneSynthRef = useRef(null);
  // const audioContextStarted = useRef(false);


  useEffect(() => {
    const fetchMidi = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await getMidiById(id);
        setMidi(res.data);
        // TODO: Fetch user's favorite status and rating for this MIDI if logged in
        // if (isAuthenticated && res.data) {
        //   // Example: checkFavoriteStatus(res.data._id);
        //   // Example: fetchUserRating(res.data._id);
        // }
      } catch (err) {
        console.error("Failed to fetch MIDI details", err.response ? err.response.data : err.message);
        if (err.response && err.response.status === 404) {
            setError('Sorry, this MIDI could not be found or is not public.');
        } else {
            setError('An error occurred while loading MIDI details. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchMidi();

    // Cleanup for audio players
    // return () => {
    //   if (tonePlayerRef.current) {
    //     Tone.Transport.stop();
    //     Tone.Transport.cancel();
    //     tonePlayerRef.current.dispose();
    //   }
    //   if (toneSynthRef.current) {
    //     toneSynthRef.current.dispose();
    //   }
    // };
  }, [id, isAuthenticated]); // Re-fetch if auth state changes (e.g., for favorite status)

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
      // Optimistically update download count on client, or re-fetch MIDI
      setMidi(prev => prev ? ({ ...prev, downloads: (prev.downloads || 0) + 1 }) : null);
    } catch (error) {
      console.error("Error tracking download or initiating download:", error);
      alert("Could not initiate download. Please try again.");
    }
  };

  // const handleToggleFavorite = async () => {
  //   if (!isAuthenticated || !midi) return;
  //   // TODO: API call to toggle favorite status
  //   // setIsFavorited(!isFavorited);
  //   // setMidi(prev => prev ? ({ ...prev, favoritesCount: isFavorited ? prev.favoritesCount -1 : prev.favoritesCount + 1 })) : null;
  //   alert("Favorite toggle placeholder");
  // };

  // const handleShare = () => {
  //   if (navigator.share) {
  //     navigator.share({
  //       title: midi?.title || 'Check out this MIDI!',
  //       text: `Listen to ${midi?.title} by ${midi?.artist || 'Unknown Artist'} on sigmaMIDI.`,
  //       url: window.location.href,
  //     })
  //     .then(() => console.log('Successful share'))
  //     .catch((error) => console.log('Error sharing', error));
  //   } else {
  //     navigator.clipboard.writeText(window.location.href);
  //     alert('Link copied to clipboard!');
  //   }
  // };


  // Placeholder for Tone.js MIDI Playback
  // const togglePlayWithTone = async () => { /* ... (logic from previous response) ... */ };


  if (loading) {
    return (
      <div className="loading-container-page">
        <div className="spinner-page"></div>
        <p>Loading MIDI Details...</p>
      </div>
    );
  }
  if (error) return <p className="alert-message alert-error container">{error}</p>;
  if (!midi) return <p className="no-results-message-page container">MIDI not found.</p>;

  const uploaderUsername = midi.uploader?.username || 'Unknown';
  const uploaderIdForLink = midi.uploader?._id || uploaderUsername; // Use ID if available for link
  const thumbnailUrl = midi.thumbnail_url || `/api/midis/placeholder-thumbnail/${(parseInt(midi._id.slice(-5), 16) % 20)}.png`; // More varied placeholders

  return (
    <div className="midi-detail-page-container container">
      <button onClick={() => navigate('/')} className="back-button"> {/* Navigate to home or previous list */}
        <FaArrowLeft /> Back to MIDIs
      </button>

      <article className="midi-detail-content-card">
        <header className="midi-detail-header">
          <div className="header-thumbnail-container">
              <img src={thumbnailUrl} alt={`${midi.title} thumbnail`} className="header-thumbnail" />
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
                      <Link to={`/user/${uploaderIdForLink}`} className="uploader-link">{uploaderUsername}</Link>
                  </span>
                  <span><FaCalendarAlt className="icon" /> On: {formatDate(midi.upload_date)}</span>
                  {midi.last_updated_date && new Date(midi.last_updated_date).getTime() !== new Date(midi.upload_date).getTime() && (
                       <span><FaCalendarAlt className="icon" /> Updated: {formatDate(midi.last_updated_date)}</span>
                  )}
              </div>
          </div>
        </header>

        <div className="midi-detail-actions-bar">
          <button onClick={handleDownload} className="btn-detail-action btn-download-detail">
            <FaDownload className="icon" /> Download ({midi.size_bytes ? `${(midi.size_bytes / 1024).toFixed(1)} KB` : 'N/A'})
          </button>
          {/* <button onClick={togglePlayWithTone} className="btn-detail-action btn-play-detail ${isPlaying ? 'playing' : ''}">
            {isPlaying ? <><FaPauseCircle className="icon" /> Pause</> : <><FaPlayCircle className="icon" /> Preview</>}
          </button> */}
          <div className="action-icons-group">
            {/* <button onClick={handleToggleFavorite} className={`btn-icon-action ${isFavorited ? 'active' : ''}`} title={isFavorited ? "Remove from Favorites" : "Add to Favorites"}>
                {isFavorited ? <FaHeart /> : <FaRegHeart />}
            </button>
            <button onClick={handleShare} className="btn-icon-action" title="Share MIDI">
                <FaShareAlt />
            </button> */}
          </div>
          <div className="detail-stats">
              <span><FaEye className="icon" /> {midi.views || 0}</span>
              <span><FaDownload className="icon" /> {midi.downloads || 0}</span>
              {/* <span><FaStarHalfAlt className="icon" /> {midi.rating_avg?.toFixed(1) || 'N/A'} ({midi.rating_count || 0})</span> */}
          </div>
        </div>

        <div className="midi-player-visualizer-placeholder">
          <p>MIDI Player / Visualizer Area</p>
          <div className="mock-player-controls">
              <button aria-label="Play/Pause"><FaPlayCircle size={30}/></button>
              <div className="mock-progress-bar" role="slider" aria-valuenow={30} aria-valuemin={0} aria-valuemax={100}><div style={{width: '30%'}}></div></div>
              <span>0:00 / {formatDuration(midi.duration_seconds)}</span>
          </div>
        </div>

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
            {midi.tags && midi.tags.length > 0 && <li><strong><FaTags className="icon"/> Tags:</strong> <span className="tags-list">{midi.tags.map(tag => <span key={tag} className="tag-item">{tag}</span>)}</span></li>}
            {midi.bpm && <li><strong><FaTachometerAlt className="icon"/> BPM (Tempo):</strong> {midi.bpm}</li>}
            {midi.duration_seconds !== null && <li><strong><FaStopwatch className="icon"/> Duration:</strong> {formatDuration(midi.duration_seconds)}</li>}
            {midi.key_signature && <li><strong>Key:</strong> {midi.key_signature}</li>}
            {midi.time_signature && <li><strong>Time Signature:</strong> {midi.time_signature}</li>}
            {midi.instrumentation && <li><strong><FaGuitar className="icon"/> Instrumentation:</strong> {midi.instrumentation}</li>}
            {midi.difficulty && <li><strong>Difficulty:</strong> <span className={`difficulty-level difficulty-${midi.difficulty}`}>{midi.difficulty}/5</span></li>}
          </ul>
        </section>

        <section className="midi-detail-section advertisement-placeholder">
          <h4>Advertisement</h4>
          <div className="ad-box">
              <button className="btn-ad-download">DOWNLOAD (Ad)</button>
              <p><small>Beware of scam Advertisements!</small></p>
          </div>
        </section>

        {/* <section className="midi-detail-section comments-section">
          <h3><FaComments className="icon" /> Comments ({midi.commentsCount || 0})</h3>
          { Comment submission form and list of comments }
        </section> */}
      </article>
    </div>
  );
};

export default MidiDetailPage;