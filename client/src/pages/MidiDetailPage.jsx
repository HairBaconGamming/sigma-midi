// client/src/pages/MidiDetailPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getMidiById, trackMidiDownload, getMidiFileStreamUrl } from '../services/apiMidis';
import {
  FaDownload, FaPlayCircle, FaPauseCircle, FaUser, FaCalendarAlt, FaInfoCircle,
  FaTachometerAlt, FaMusic, FaEye, FaUserEdit, FaArrowLeft, FaTags, FaGuitar,
  FaStopwatch, FaStarHalfAlt, FaClipboardList, FaUndo, FaVolumeUp, FaVolumeMute
} from 'react-icons/fa';
import * as Tone from 'tone'; // For Web Audio API context and synth
import { Midi as ToneMidi } from '@tonejs/midi'; // For parsing MIDI files
import '../assets/css/MidiDetailPage.css';
import { useAuth } from '../contexts/AuthContext';

const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (e) {
        return 'N/A';
    }
};

const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};


const MidiDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [midi, setMidi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMidiLoaded, setIsMidiLoaded] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playerError, setPlayerError] = useState('');

  // Tone.js Refs
  const synths = useRef([]); // Store multiple synths for polyphony
  const parsedMidiRef = useRef(null);
  const toneContextStarted = useRef(false);
  const progressIntervalRef = useRef(null);

  const MAX_POLYPHONY = 16; // Max simultaneous notes

  // Cleanup function for Tone.js resources
  const cleanupTone = useCallback(() => {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    synths.current.forEach(synth => synth.dispose());
    synths.current = [];
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    setIsPlaying(false);
    setIsMidiLoaded(false);
    setPlaybackTime(0);
    parsedMidiRef.current = null;
  }, []);


  useEffect(() => {
    const fetchMidiData = async () => {
      try {
        setLoading(true);
        setError('');
        setPlayerError('');
        cleanupTone(); // Clean up previous MIDI data if any

        const res = await getMidiById(id);
        setMidi(res.data);

        if (res.data && res.data.fileId) {
          loadMidiForPlayback(res.data.fileId);
        }

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
    fetchMidiData();

    return () => {
      cleanupTone(); // Ensure cleanup on component unmount
    };
  }, [id, cleanupTone]); // Add cleanupTone to dependencies

  const loadMidiForPlayback = async (fileId) => {
    try {
      setPlayerError('');
      const midiUrl = getMidiFileStreamUrl(fileId);
      const parsed = await ToneMidi.fromUrl(midiUrl);
      parsedMidiRef.current = parsed;

      // Prepare synths (do this once per MIDI load)
      synths.current.forEach(synth => synth.dispose());
      synths.current = [];
      for (let i = 0; i < MAX_POLYPHONY; i++) {
        // Using PolySynth for simpler polyphony handling, or manage individual Synths
        const synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'triangle8' }, // A slightly softer waveform
            envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.5 },
            volume: -10 // Initial volume
        }).toDestination();
        synths.current.push(synth);
      }
      
      // Schedule MIDI events
      Tone.Transport.cancel(); // Clear previous events
      parsed.tracks.forEach(track => {
        track.notes.forEach(note => {
          Tone.Transport.schedule(time => {
            // Find an available synth or round-robin
            const synth = synths.current[note.midi % MAX_POLYPHONY]; // Simple round-robin based on note
            if (synth) {
                 synth.triggerAttackRelease(note.name, note.duration, time + note.time, note.velocity);
            }
          }, note.time); // note.time is the absolute time in seconds from the start
        });
      });
      setIsMidiLoaded(true);
      console.log("MIDI parsed and scheduled for playback:", parsedMidiRef.current.name);
    } catch (e) {
      console.error("Error loading or parsing MIDI for playback:", e);
      setPlayerError("Could not load MIDI for playback. File might be corrupted or inaccessible.");
      setIsMidiLoaded(false);
    }
  };
  

  const startToneContext = async () => {
    if (!toneContextStarted.current) {
      await Tone.start();
      toneContextStarted.current = true;
      console.log("AudioContext started");
    }
  };

  const togglePlay = async () => {
    await startToneContext(); // Ensure AudioContext is running

    if (!isMidiLoaded || !parsedMidiRef.current) {
      setPlayerError("MIDI data not loaded yet. Please wait or try reloading.");
      return;
    }

    if (isPlaying) {
      Tone.Transport.pause();
      setIsPlaying(false);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    } else {
      if (Tone.Transport.state === "paused") {
          Tone.Transport.start();
      } else { // Or if stopped/never started for this MIDI
          Tone.Transport.seconds = playbackTime; // Resume from current playbackTime
          Tone.Transport.start();
      }
      setIsPlaying(true);
      progressIntervalRef.current = setInterval(() => {
        setPlaybackTime(Tone.Transport.seconds);
        if (Tone.Transport.seconds >= parsedMidiRef.current.duration) {
          handleStop(); // Auto-stop at the end
        }
      }, 100);
    }
  };

  const handleStop = (resetTime = true) => {
    Tone.Transport.stop();
    if (resetTime) Tone.Transport.seconds = 0; // Only reset if explicitly stopping to beginning
    setIsPlaying(false);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setPlaybackTime(resetTime ? 0 : Tone.Transport.seconds);
  };
  
  const handleSeek = (event) => {
    if (!isMidiLoaded || !parsedMidiRef.current) return;
    const progressBar = event.currentTarget;
    const clickPosition = (event.clientX - progressBar.getBoundingClientRect().left) / progressBar.offsetWidth;
    const newTime = clickPosition * parsedMidiRef.current.duration;
    
    Tone.Transport.seconds = newTime;
    setPlaybackTime(newTime);
    if (!isPlaying) { // If paused, just update time, don't start
        // No need to do anything extra, time is set
    }
  };

  const toggleMute = () => {
    synths.current.forEach(synth => {
        synth.volume.value = isMuted ? -10 : -Infinity; // Example: -10dB for unmuted, -Infinity for muted
    });
    setIsMuted(!isMuted);
  };


  const handleDownload = async () => { /* ... (existing implementation) ... */ };

  if (loading && !midi) { // Show full page loader only if no MIDI data yet
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
  const uploaderIdForLink = midi.uploader?._id || uploaderUsername;
  const thumbnailUrl = midi.thumbnail_url || `/api/midis/placeholder-thumbnail/${(parseInt(midi._id.slice(-5), 16) % 20)}.png`;
  const durationTotal = parsedMidiRef.current?.duration || midi.duration_seconds || 0;
  const progressPercent = durationTotal > 0 ? (playbackTime / durationTotal) * 100 : 0;

  return (
    <div className="midi-detail-page-container container">
      <button onClick={() => navigate(-1)} className="back-button">
        <FaArrowLeft /> Back
      </button>

      <article className="midi-detail-content-card">
        <header className="midi-detail-header">
          {/* ... (existing header content) ... */}
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
                      <Link to={`/profile/${uploaderIdForLink}`} className="uploader-link">{uploaderUsername}</Link>
                  </span>
                  <span><FaCalendarAlt className="icon" /> On: {formatDate(midi.upload_date)}</span>
                  {midi.last_updated_date && new Date(midi.last_updated_date).getTime() !== new Date(midi.upload_date).getTime() && (
                       <span><FaCalendarAlt className="icon" /> Updated: {formatDate(midi.last_updated_date)}</span>
                  )}
              </div>
          </div>
        </header>

        <div className="midi-detail-actions-bar">
          {/* ... (existing download button and stats) ... */}
          <button onClick={handleDownload} className="btn-detail-action btn-download-detail">
            <FaDownload className="icon" /> Download ({midi.size_bytes ? `${(midi.size_bytes / 1024).toFixed(1)} KB` : 'N/A'})
          </button>
          <div className="detail-stats">
              <span><FaEye className="icon" /> {midi.views || 0}</span>
              <span><FaDownload className="icon" /> {midi.downloads || 0}</span>
          </div>
        </div>
        
        {/* --- MIDI PLAYER SECTION --- */}
        <div className="midi-player-section">
          <h3><FaMusic className="icon" /> MIDI Player</h3>
          {playerError && <p className="player-error-message">{playerError}</p>}
          {!isMidiLoaded && !playerError && (
            <div className="player-loading">
              <div className="spinner-player"></div>
              <p>Loading MIDI for playback...</p>
            </div>
          )}
          {isMidiLoaded && (
            <div className="midi-player-controls">
              <button onClick={togglePlay} className="btn-player-action" aria-label={isPlaying ? "Pause" : "Play"} disabled={!isMidiLoaded}>
                {isPlaying ? <FaPauseCircle /> : <FaPlayCircle />}
              </button>
              <button onClick={() => handleStop(true)} className="btn-player-action" aria-label="Stop" disabled={!isMidiLoaded}>
                <FaUndo /> {/* Using Undo as a stop/reset icon */}
              </button>
              <div className="player-time-display current-time">{formatTime(playbackTime)}</div>
              <div className="player-progress-bar-container" onClick={handleSeek}>
                <div className="player-progress-bar" style={{ width: `${progressPercent}%` }}></div>
              </div>
              <div className="player-time-display total-time">{formatTime(durationTotal)}</div>
              <button onClick={toggleMute} className="btn-player-action btn-volume" aria-label={isMuted ? "Unmute" : "Mute"}>
                {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
              </button>
            </div>
          )}
        </div>
        {/* --- END MIDI PLAYER SECTION --- */}


        {midi.description && (
          <section className="midi-detail-section description-section">
            {/* ... (existing description content) ... */}
            <h3><FaInfoCircle className="icon" /> Description</h3>
            <p className="description-text">{midi.description}</p>
          </section>
        )}

        <section className="midi-detail-section metadata-section">
           {/* ... (existing metadata content) ... */}
           <h3><FaClipboardList className="icon" /> Details & Metadata</h3>
          <ul>
            <li><strong>Original Filename:</strong> {midi.original_filename || 'N/A'}</li>
            {midi.genre && <li><strong><FaTags className="icon"/> Genre:</strong> {midi.genre}</li>}
            {midi.tags && midi.tags.length > 0 && <li><strong><FaTags className="icon"/> Tags:</strong> <span className="tags-list">{midi.tags.map(tag => <span key={tag} className="tag-item">{tag}</span>)}</span></li>}
            {midi.bpm && <li><strong><FaTachometerAlt className="icon"/> BPM (Tempo):</strong> {midi.bpm}</li>}
            {/* Use durationTotal from player if MIDI is loaded, otherwise fallback to midi.duration_seconds */}
            <li><strong><FaStopwatch className="icon"/> Duration:</strong> {formatTime(durationTotal)}</li>
            {midi.key_signature && <li><strong>Key:</strong> {midi.key_signature}</li>}
            {midi.time_signature && <li><strong>Time Signature:</strong> {midi.time_signature}</li>}
            {midi.instrumentation && <li><strong><FaGuitar className="icon"/> Instrumentation:</strong> {midi.instrumentation}</li>}
            {midi.difficulty && <li><strong>Difficulty:</strong> <span className={`difficulty-level difficulty-${midi.difficulty}`}>{midi.difficulty}/5</span></li>}
          </ul>
        </section>

      </article>
    </div>
  );
};

export default MidiDetailPage;