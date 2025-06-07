import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMidiById, trackMidiDownload } from '../services/apiMidis';
// import '../assets/css/MidiDetailPage.css'; // Tạo file CSS này
// import MidiPlayer from 'midi-player-js'; // Hoặc một thư viện MIDI player khác nếu muốn có preview

// Helper function to format date
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (e) {
        return 'N/A';
    }
};


const MidiDetailPage = () => {
  const { id } = useParams();
  const [midi, setMidi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // const [isPlaying, setIsPlaying] = useState(false);
  // const playerRef = useRef(null); // For MIDI player instance

  useEffect(() => {
    const fetchMidi = async () => {
      try {
        setLoading(true);
        const res = await getMidiById(id);
        setMidi(res.data);
        setError('');
      } catch (err) {
        console.error("Failed to fetch MIDI details", err);
        setError('Failed to load MIDI details. It might not exist or there was a server error.');
      } finally {
        setLoading(false);
      }
    };
    fetchMidi();

    // Cleanup for MIDI player if used
    // return () => {
    //   if (playerRef.current) {
    //     playerRef.current.stop();
    //   }
    // };
  }, [id]);

  const handleDownload = async () => {
    if (!midi || !midi.file_path) {
        alert("MIDI file path not available.");
        return;
    }
    try {
      await trackMidiDownload(midi.id);
      const downloadUrl = `${window.location.origin}${midi.file_path}`;
      // Tạo một thẻ a ẩn để trigger download với tên file gốc
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

  // Basic MIDI Player functionality (Placeholder - needs a library)
  // const togglePlay = () => {
  //   if (!midi || !midi.file_path) return;
  //   const midiUrl = `${window.location.origin}${midi.file_path}`;

  //   if (!playerRef.current) {
  //     playerRef.current = new MidiPlayer.Player(function(event) {
  //       // Handle MIDI events if needed for visualization
  //       if (event.name === 'Note on' && event.velocity > 0) {
  //         console.log('Note on:', event.noteName, event.velocity);
  //       } else if (event.name === 'Note off' || (event.name === 'Note on' && event.velocity === 0)) {
  //         console.log('Note off:', event.noteName);
  //       }
  //       if (playerRef.current && playerRef.current.getSongPercentRemaining() === 0 && isPlaying) {
  //           setIsPlaying(false); // Auto-stop when song ends
  //       }
  //     });
  //     playerRef.current.on('endOfFile', () => setIsPlaying(false));
  //     playerRef.current.loadDataUri(midiUrl); // Hoặc loadFile nếu thư viện hỗ trợ
  //   }

  //   if (isPlaying) {
  //     playerRef.current.pause(); // Hoặc stop() tùy thư viện
  //   } else {
  //     playerRef.current.play();
  //   }
  //   setIsPlaying(!isPlaying);
  // };


  if (loading) return <p>Loading MIDI details...</p>;
  if (error) return <p className="error-message">{error}</p>;
  if (!midi) return <p>MIDI not found.</p>;

  return (
    <div className="midi-detail-page">
      <div className="midi-header">
        <h1>{midi.title}</h1>
        <p className="artist-info">
          By: {midi.artist || 'Unknown Artist'}
          {midi.arrangement_by && ` (Arrangement: ${midi.arrangement_by})`}
        </p>
      </div>

      <div className="midi-content-layout">
        <div className="midi-info-panel">
          <p><strong>Uploaded by:</strong> <Link to={`/user/${midi.uploader_username}`}>{midi.uploader_username || 'Unknown'}</Link></p>
          <p><strong>Uploaded on:</strong> {formatDate(midi.upload_date)}</p>
          <p><strong>Size:</strong> {midi.size_kb} KB</p>
          {midi.bpm && <p><strong>BPM:</strong> {midi.bpm}</p>}
          <p><strong>Views:</strong> {midi.views}</p>
          <p><strong>Downloads:</strong> {midi.downloads}</p>

          {midi.description && (
            <div className="midi-description">
              <h4>Description:</h4>
              <p>{midi.description}</p>
            </div>
          )}

          <button onClick={handleDownload} className="btn btn-download btn-primary">
            DOWNLOAD MIDI
          </button>

          {/* Placeholder for MIDI Player controls */}
          {/* <div className="midi-player-controls">
            <button onClick={togglePlay} className="btn">
              {isPlaying ? 'PAUSE PREVIEW' : 'PLAY PREVIEW'}
            </button>
            <p>Preview functionality requires a MIDI player library.</p>
          </div> */}
        </div>

        <div className="midi-visual-panel">
          {/* Placeholder for thumbnail or visualizer */}
          <img src="/placeholder-image.png" alt={`${midi.title} thumbnail`} className="midi-thumbnail-large" />
          <p className="advertisement-note">
            (This area could show a thumbnail or a MIDI visualizer if implemented)
          </p>
        </div>
      </div>


      {/* Placeholder for Advertisement section */}
      <div className="advertisement-section">
        <h4>Advertisement</h4>
        <div className="ad-placeholder">
            <button className="btn btn-download-ad">DOWNLOAD (Ad)</button>
            <p><small>Beware of scam Advertisements!</small></p>
        </div>
      </div>

      {/* Placeholder for Comments section */}
      {/* <div className="comments-section">
        <h4>Comments</h4>
        <p>(Comments feature to be implemented)</p>
      </div> */}
    </div>
  );
};

export default MidiDetailPage;