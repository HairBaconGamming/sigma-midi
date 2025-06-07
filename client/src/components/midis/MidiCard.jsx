// client/src/components/midis/MidiCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { trackMidiDownload } from '../../services/apiMidis';
import { FaEye, FaDownload, FaCalendarAlt, FaUserEdit, FaMusic, FaTachometerAlt } from 'react-icons/fa';
import '../../assets/css/MidiCard.css';

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  } catch (e) {
    return 'N/A';
  }
};

const MidiCard = ({ midi }) => {
  const handleDownload = async (e) => {
    e.preventDefault(); // Prevent navigation if card itself is a link
    e.stopPropagation();

    if (!midi || !midi.file_path) {
      alert("MIDI file path not available.");
      return;
    }
    try {
      await trackMidiDownload(midi.id);
      const downloadUrl = `${window.location.origin}${midi.file_path}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', midi.original_filename || `midi_${midi.id}.mid`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error tracking download or initiating download:", error);
      alert("Could not initiate download. Please try again.");
    }
  };

  // Placeholder for thumbnail - replace with actual logic if you have thumbnails
  const thumbnailUrl = midi.thumbnail_url || `https://upload.wikimedia.org/wikipedia/commons/a/a0/MIDI_LOGO.svg`; // Example dynamic placeholder

  return (
    <div className="midi-card">
      <Link to={`/midi/${midi.id}`} className="card-link-wrapper">
        <div className="midi-card-thumbnail-container">
          {/* In a real app, you'd have a dynamic thumbnail */}
          <img src={thumbnailUrl} alt={`${midi.title} thumbnail`} className="midi-card-thumbnail" />
          <div className="thumbnail-overlay">
            <span className="play-icon-overlay">▶</span>
          </div>
        </div>
        <div className="midi-card-content">
          <h3 className="midi-card-title" title={midi.title}>
            {midi.title}
          </h3>
          <p className="midi-card-artist">
            <FaMusic className="icon" /> {midi.artist || 'Unknown Artist'}
          </p>
          {midi.arrangement_by && (
            <p className="midi-card-arrangement">
              <FaUserEdit className="icon" /> Arr. by: {midi.arrangement_by}
            </p>
          )}
          <div className="midi-card-details">
            <span><FaTachometerAlt className="icon" /> {midi.bpm ? `${midi.bpm} BPM` : 'N/A BPM'}</span>
            <span>{midi.size_kb} KB</span>
          </div>
        </div>
      </Link>
      <div className="midi-card-footer">
        <div className="midi-card-stats">
          <span><FaEye className="icon" /> {midi.views || 0}</span>
          <span><FaDownload className="icon" /> {midi.downloads || 0}</span>
          <span><FaCalendarAlt className="icon" /> {formatDate(midi.upload_date)}</span>
        </div>
        <div className="midi-card-actions">
          <button onClick={handleDownload} className="btn-card btn-download-card" title="Download MIDI">
            <FaDownload />
          </button>
          <Link to={`/midi/${midi.id}`} className="btn-card btn-view-card" title="View Details">
            View
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MidiCard;