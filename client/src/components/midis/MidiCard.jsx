// client/src/components/midis/MidiCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { trackMidiDownload, getMidiFileStreamUrl } from '../../services/apiMidis';
import { usePlayer } from '../../contexts/PlayerContext'; // Import global player context
import { 
    FaEye, FaDownload, FaCalendarAlt, FaUserEdit, FaMusic, 
    FaTachometerAlt, FaPlay, FaPause, FaInfoCircle // Added FaPlay, FaPause, FaInfoCircle
} from 'react-icons/fa';
import '../../assets/css/MidiCard.css';

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  } catch (e) {
    console.warn("Error formatting date in MidiCard:", dateString, e);
    return 'Invalid Date';
  }
};

const formatFileSize = (bytes) => {
    if (isNaN(parseFloat(bytes)) || !isFinite(bytes) || bytes === 0) return 'N/A KB';
    if (bytes < 1024) return bytes + ' B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = (bytes / Math.pow(1024, i)).toFixed(1);
    return `${value} ${['B', 'KB', 'MB', 'GB'][i]}`;
};

const MidiCard = ({ midi }) => {
  const { 
    playMidi, 
    togglePlay, 
    currentPlayingMidi, 
    isPlaying: globalIsPlaying,
    isPianoSamplerReady, // To disable play button if piano isn't ready
    isLoadingPlayer // To disable play button if player is busy
  } = usePlayer();

  if (!midi || !midi._id) {
    // Handle cases where midi prop is missing or invalid
    // This could be a simple placeholder or null to render nothing
    console.warn("MidiCard received invalid or missing midi prop:", midi);
    return (
        <div className="midi-card midi-card-error-placeholder">
            <p>Error loading MIDI data.</p>
        </div>
    );
  }

  const handleDownload = async (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent card's Link navigation

    if (!midi.fileId) {
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
      // Note: Download count update would ideally come from a re-fetch or optimistic update
      // For now, it's handled on the detail page after download.
    } catch (error) {
      console.error("Error tracking download or initiating download:", error);
      alert("Could not initiate download. Please try again.");
    }
  };

  const handlePlayButtonClick = (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent card's Link navigation

    if (currentPlayingMidi && currentPlayingMidi._id === midi._id) {
      togglePlay(); // Toggle play/pause for the currently loaded MIDI
    } else {
      playMidi(midi); // Load and play this new MIDI
    }
  };

  // Determine if this MIDI is the one active in the global player
  const isThisMidiActiveInGlobalPlayer = currentPlayingMidi && currentPlayingMidi._id === midi._id;
  const PlayButtonIcon = isThisMidiActiveInGlobalPlayer && globalIsPlaying ? FaPause : FaPlay;
  const playButtonTitle = isThisMidiActiveInGlobalPlayer && globalIsPlaying ? "Pause" : "Play";
  const playButtonDisabled = !isPianoSamplerReady || isLoadingPlayer;


  const thumbnailUrl = midi.thumbnail_url || `/api/midis/placeholder-thumbnail/${(parseInt(midi._id.slice(-2), 16) % 10) + 1}.png`;

  return (
    <div className="midi-card">
      <Link to={`/midi/${midi._id}`} className="card-link-wrapper" title={`View details for ${midi.title}`}>
        <div className="midi-card-thumbnail-container">
          <img 
            src={thumbnailUrl} 
            alt={`${midi.title} thumbnail`} 
            className="midi-card-thumbnail" 
            loading="lazy" // Lazy load images for better performance
          />
          <div className="thumbnail-overlay">
            {/* The play button is now separate, but you can keep a visual cue if desired */}
            {/* <span className="play-icon-overlay">▶</span> */}
          </div>
        </div>
        <div className="midi-card-content">
          <h3 className="midi-card-title" title={midi.title}>
            {midi.title || 'Untitled MIDI'}
          </h3>
          <p className="midi-card-artist" title={midi.artist || 'Unknown Artist'}>
            <FaMusic className="icon" /> {midi.artist || 'Unknown Artist'}
          </p>
          {midi.arrangement_by && (
            <p className="midi-card-arrangement" title={`Arranged by ${midi.arrangement_by}`}>
              <FaUserEdit className="icon" /> Arr. by: {midi.arrangement_by}
            </p>
          )}
          <div className="midi-card-details">
            <span><FaTachometerAlt className="icon" /> {midi.bpm ? `${midi.bpm} BPM` : 'N/A'}</span>
            <span>{formatFileSize(midi.size_bytes)}</span>
          </div>
        </div>
      </Link>
      <div className="midi-card-footer">
        <div className="midi-card-stats">
          <span><FaEye className="icon" /> {midi.views || 0}</span>
          <span><FaDownload className="icon" /> {midi.downloads || 0}</span>
          <span title={`Uploaded on ${formatDate(midi.upload_date)}`}><FaCalendarAlt className="icon" /> {formatDate(midi.upload_date)}</span>
        </div>
        <div className="midi-card-actions">
          <button 
            onClick={handlePlayButtonClick} 
            className="btn-card btn-play-card" 
            title={playButtonTitle}
            disabled={playButtonDisabled}
            aria-label={playButtonTitle}
          >
            <PlayButtonIcon />
          </button>
          <button 
            onClick={handleDownload} 
            className="btn-card btn-download-card" 
            title="Download MIDI"
            disabled={!midi.fileId}
            aria-label="Download MIDI"
          >
            <FaDownload />
          </button>
          <Link 
            to={`/midi/${midi._id}`} 
            className="btn-card btn-view-card" 
            title="View Details"
            aria-label="View MIDI Details"
          >
            <FaInfoCircle/> {/* Changed from text "View" to an icon */}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MidiCard;