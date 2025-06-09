// client/src/components/midis/MidiCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { trackMidiDownload, getMidiFileStreamUrl } from '../../services/apiMidis';
import { usePlayer } from '../../contexts/PlayerContext';
import {
    FaEye, FaDownload, FaCalendarAlt, FaUserEdit, FaMusic,
    FaTachometerAlt, FaPlay, FaPause, FaInfoCircle,
    FaLock // THÊM ICON KHÓA
} from 'react-icons/fa';
import '../../assets/css/MidiCard.css'; // Sẽ cập nhật file này

// ... (formatDate, formatFileSize không đổi)
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
    isPianoSamplerReady,
    isLoadingPlayer
  } = usePlayer();

  if (!midi || !midi._id) {
    console.warn("MidiCard received invalid or missing midi prop:", midi);
    return (
        <div className="midi-card midi-card-error-placeholder">
            <p>Error loading MIDI data.</p>
        </div>
    );
  }

  const handleDownload = async (e) => {
    e.preventDefault();
    e.stopPropagation();
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
    } catch (error) {
      console.error("Error tracking download or initiating download:", error);
      alert("Could not initiate download. Please try again.");
    }
  };

  const handlePlayButtonClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentPlayingMidi && currentPlayingMidi._id === midi._id) {
      togglePlay();
    } else {
      playMidi(midi);
    }
  };

  const isThisMidiActiveInGlobalPlayer = currentPlayingMidi && currentPlayingMidi._id === midi._id;
  const PlayButtonIcon = isThisMidiActiveInGlobalPlayer && globalIsPlaying ? FaPause : FaPlay;
  const playButtonTitle = isThisMidiActiveInGlobalPlayer && globalIsPlaying ? "Pause" : "Play";
  const playButtonDisabled = !isPianoSamplerReady || isLoadingPlayer;

  const thumbnailUrl = midi.thumbnail_url || `/api/midis/placeholder-thumbnail/${(parseInt(midi._id.slice(-2), 16) % 10) + 1}.png`;

  // Xác định class cho card private
  const cardClasses = `midi-card ${!midi.is_public ? 'midi-card-private' : ''}`;

  return (
    <div className={cardClasses}> {/* Sử dụng cardClasses */}
      {/* Dải băng Private (ví dụ) */}
      {!midi.is_public && (
        <div className="private-indicator-banner">
          <FaLock /> Private
        </div>
      )}

      <Link to={`/midi/${midi._id}`} className="card-link-wrapper" title={`View details for ${midi.title}`}>
        <div className="midi-card-thumbnail-container">
          <img
            src={thumbnailUrl}
            alt={`${midi.title} thumbnail`}
            className="midi-card-thumbnail"
            loading="lazy"
          />
          <div className="thumbnail-overlay">
            {/* Overlay content if any */}
          </div>
        </div>
        <div className="midi-card-content">
          <h3 className="midi-card-title" title={midi.title}>
            {!midi.is_public && <FaLock className="title-lock-icon" title="Private MIDI" />} {/* Icon khóa nhỏ cạnh title */}
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
            disabled={playButtonDisabled || !midi.is_public} // Vô hiệu hóa play nếu private (trừ khi đang ở My MIDIs và có logic khác)
            aria-label={playButtonTitle}
          >
            <PlayButtonIcon />
          </button>
          <button
            onClick={handleDownload}
            className="btn-card btn-download-card"
            title="Download MIDI"
            disabled={!midi.fileId || !midi.is_public} // Vô hiệu hóa download nếu private
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
            <FaInfoCircle/>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MidiCard;