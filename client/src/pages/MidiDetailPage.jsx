// client/src/pages/MidiDetailPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getMidiById, trackMidiDownload } from '../services/apiMidis';
import { FaDownload, FaPlayCircle, FaPauseCircle, FaUser, FaCalendarAlt, FaInfoCircle, FaTachometerAlt, FaMusic, FaEye, FaUserEdit, FaArrowLeft } from 'react-icons/fa';
// import MidiPlayer from 'midi-player-js'; // Example, choose a suitable library
// import { Midi } from '@tonejs/midi'; // For parsing and getting info with Tone.js
// import * as Tone from 'tone'; // For playback with Tone.js
import '../assets/css/MidiDetailPage.css';

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
  const navigate = useNavigate();
  const [midi, setMidi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  // const playerRef = useRef(null); // For midi-player-js
  // const tonePlayerRef = useRef(null); // For Tone.js player
  // const toneSynthRef = useRef(null); // For Tone.js synth

  useEffect(() => {
    const fetchMidi = async () => {
      try {
        setLoading(true);
        const res = await getMidiById(id);
        setMidi(res.data);
        setError('');
      } catch (err) {
        console.error("Failed to fetch MIDI details", err.response ? err.response.data : err.message);
        setError('Failed to load MIDI details. It might not exist or there was a server error.');
      } finally {
        setLoading(false);
      }
    };
    fetchMidi();

    // Cleanup for Tone.js player
    // return () => {
    //   if (tonePlayerRef.current) {
    //     tonePlayerRef.current.stop();
    //     tonePlayerRef.current.dispose();
    //   }
    //   if (toneSynthRef.current) {
    //     toneSynthRef.current.dispose();
    //   }
    //   Tone.Transport.stop();
    //   Tone.Transport.cancel();
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

  // Placeholder for Tone.js MIDI Playback (more complex setup needed)
  // const togglePlayWithTone = async () => {
  //   if (!midi || !midi.file_path) return;
  //   const midiUrl = `${window.location.origin}${midi.file_path}`;

  //   try {
  //     await Tone.start(); // Required for user gesture

  //     if (!toneSynthRef.current) {
  //       toneSynthRef.current = new Tone.PolySynth(Tone.Synth, {
  //         envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 }
  //       }).toDestination();
  //     }

  //     if (isPlaying && tonePlayerRef.current) {
  //       Tone.Transport.stop();
  //       tonePlayerRef.current.stop(); // Stop the part
  //       setIsPlaying(false);
  //     } else {
  //       const parsedMidi = await Midi.fromUrl(midiUrl);
  //       if (tonePlayerRef.current) {
  //           tonePlayerRef.current.dispose(); // Dispose previous part if any
  //       }

  //       tonePlayerRef.current = new Tone.Part((time, note) => {
  //         toneSynthRef.current.triggerAttackRelease(note.name, note.duration, time, note.velocity);
  //       }, parsedMidi.tracks[0].notes).start(0); // Play first track for simplicity

  //       Tone.Transport.bpm.value = parsedMidi.header.tempos[0]?.bpm || midi.bpm || 120;
  //       Tone.Transport.start();
  //       setIsPlaying(true);

  //       Tone.Transport.on('stop', () => {
  //           if (isPlaying) setIsPlaying(false); // Ensure state updates if transport stops externally
  //       });
  //     }
  //   } catch (e) {
  //     console.error("Error playing MIDI with Tone.js:", e);
  //     setError("Could not play MIDI preview.");
  //     setIsPlaying(false);
  //   }
  // };


  if (loading) {
    return (
      <div className="loading-container-page">
        <div className="spinner-page"></div>
        <p>Loading MIDI Details...</p>
      </div>
    );
  }
  if (error) return <p className="error-message-page">{error}</p>;
  if (!midi) return <p className="no-results-message-page">MIDI not found.</p>;

  const thumbnailUrl = midi.thumbnail_url || `/api/midis/placeholder-thumbnail/${midi.id % 10 + 1}.png`;


  return (
    <div className="midi-detail-page-container">
      <button onClick={() => navigate(-1)} className="back-button">
        <FaArrowLeft /> Back to List
      </button>

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
                <span><FaUser className="icon" /> Uploaded by: <Link to={`/user/${midi.uploader_username}`}>{midi.uploader_username || 'Unknown'}</Link></span>
                <span><FaCalendarAlt className="icon" /> On: {formatDate(midi.upload_date)}</span>
            </div>
        </div>
      </header>

      <div className="midi-detail-actions-bar">
        <button onClick={handleDownload} className="btn-detail-action btn-download-detail">
          <FaDownload className="icon" /> Download MIDI ({midi.size_kb} KB)
        </button>
        {/* <button onClick={togglePlayWithTone} className="btn-detail-action btn-play-detail">
          {isPlaying ? <><FaPauseCircle className="icon" /> Pause Preview</> : <><FaPlayCircle className="icon" /> Play Preview</>}
        </button> */}
        <div className="detail-stats">
            <span><FaEye className="icon" /> {midi.views} Views</span>
            <span><FaDownload className="icon" /> {midi.downloads} Downloads</span>
        </div>
      </div>


      {/* Placeholder for a more sophisticated MIDI player / visualizer */}
      <div className="midi-player-visualizer-placeholder">
        <p>MIDI Player / Visualizer Area</p>
        <p>(Requires integration with a library like Tone.js, MIDI.js, or a visualizer component)</p>
        <div className="mock-player-controls">
            <button><FaPlayCircle size={24}/></button>
            <div className="mock-progress-bar"><div></div></div>
            <span>0:00 / 0:33</span>
        </div>
      </div>


      {midi.description && (
        <section className="midi-detail-section description-section">
          <h3><FaInfoCircle className="icon" /> Description</h3>
          <p className="description-text">{midi.description}</p>
        </section>
      )}

      <section className="midi-detail-section metadata-section">
        <h3><FaTachometerAlt className="icon" /> Additional Info</h3>
        <ul>
          <li><strong>Original Filename:</strong> {midi.original_filename}</li>
          {midi.bpm && <li><strong>BPM (Tempo):</strong> {midi.bpm}</li>}
          {/* Add more metadata if available, e.g., key, time signature from MIDI parsing */}
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
        <h3><FaComments className="icon" /> Comments</h3>
        <p>(Comments feature to be implemented)</p>
      </section> */}
    </div>
  );
};

export default MidiDetailPage;