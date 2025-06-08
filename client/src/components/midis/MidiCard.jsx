// client/src/components/midis/MidiCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { trackMidiDownload, getMidiFileStreamUrl } from '../../services/apiMidis'; // Import getMidiFileStreamUrl
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
    e.preventDefault();
    e.stopPropagation();

    if (!midi || !midi.fileId) { // MODIFIED: Check for fileId
      alert("MIDI file information not available for download.");
      return;
    }
    try {
      await trackMidiDownload(midi._id); // Track download using MIDI document _id
      
      // MODIFIED: Get stream URL using fileId
      const downloadUrl = getMidiFileStreamUrl(midi.fileId);

      const link = document.createElement('a');
      link.href = downloadUrl;
      // original_filename is now directly on the midi object from backend
      link.setAttribute('download', midi.original_filename || `midi_${midi._id}.mid`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error tracking download or initiating download:", error);
      alert("Could not initiate download. Please try again.");
    }
  };

  // Assuming backend provides a direct thumbnail_url or a placeholder mechanism
  const thumbnailUrl = midi.thumbnail_url || `/api/midis/placeholder-thumbnail/${(parseInt(midi._id.slice(-2), 16) % 10) + 1}.png`;


  return (
    <div className="midi-card">
      <Link to={`/midi/${midi._id}`} className="card-link-wrapper"> {/* MODIFIED: Use _id */}
        <div className="midi-card-thumbnail-container">
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
            {/* MODIFIED: Use size_bytes and format it */}
            <span>{midi.size_bytes ? `${(midi.size_bytes / 1024).toFixed(1)} KB` : 'N/A KB'}</span>
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
          <Link to={`/midi/${midi._id}`} className="btn-card btn-view-card" title="View Details"> {/* MODIFIED: Use _id */}
            View
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MidiCard;