// client/src/pages/MidiDetailPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getMidiById, trackMidiDownload, getMidiFileStreamUrl } from '../services/apiMidis';
import {
  FaDownload, FaPlayCircle, FaPauseCircle, FaUser, FaCalendarAlt, FaInfoCircle,
  FaTachometerAlt, FaMusic, FaEye, FaUserEdit, FaArrowLeft, FaTags, FaGuitar,
  FaStopwatch, FaStarHalfAlt, FaClipboardList, FaUndo, FaVolumeUp, FaVolumeMute
  // FaShareAlt, FaHeart, FaRegHeart // Keep if you plan to use them
} from 'react-icons/fa';
import * as Tone from 'tone';
import { Midi as ToneMidi } from '@tonejs/midi';
import { Piano } from '@tonejs/piano';

import '../assets/css/MidiDetailPage.css';
import { useAuth } from '../contexts/AuthContext'; // Keep if used for other features

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
    if (isNaN(seconds) || seconds === null || seconds === undefined || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

const MidiDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  // const { isAuthenticated, user } = useAuth();

  const [midi, setMidi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMidiLoaded, setIsMidiLoaded] = useState(false);
  const [isPianoReady, setIsPianoReady] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [durationTotal, setDurationTotal] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playerError, setPlayerError] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('');

  // Tone.js Refs
  const pianoRef = useRef(null);
  const parsedMidiRef = useRef(null);
  const toneContextStarted = useRef(false);
  const progressIntervalRef = useRef(null);
  const scheduledEventsRef = useRef([]);
  const animationFrameRef = useRef(null); // For smooth progress updates

  const cleanupTone = useCallback(() => {
    console.log("Cleanup Tone called");
    Tone.Transport.stop();
    Tone.Transport.cancel();
    scheduledEventsRef.current.forEach(eventId => Tone.Transport.clear(eventId));
    scheduledEventsRef.current = [];

    if (pianoRef.current) {
      pianoRef.current.releaseAll();
    }
    if (progressIntervalRef.current) { // Legacy interval, transitioning to rAF
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsPlaying(false);
    setPlaybackTime(0);
    // Don't reset isMidiLoaded, isPianoReady, parsedMidiRef here,
    // they are reset when a new MIDI is explicitly loaded.
  }, []);

  // Effect for initializing Piano
  useEffect(() => {
    if (!pianoRef.current && !isPianoReady) {
      setLoadingMessage('Initializing piano sound...');
      const piano = new Piano({ velocities: 4 });
      piano.toDestination();
      pianoRef.current = piano;

      piano.load()
        .then(() => {
          setIsPianoReady(true);
          setLoadingMessage('');
          console.log("@tonejs/piano samples loaded and ready.");
        })
        .catch(err => {
          console.error("Failed to load piano samples:", err);
          setPlayerError("Could not load piano sound.");
          setIsPianoReady(false);
          setLoadingMessage('');
        });
    }
  }, [isPianoReady]); // Runs if isPianoReady is false (initial load)

  // Effect for fetching MIDI data when 'id' changes
  useEffect(() => {
    const fetchMidiAndSetupPlayer = async () => {
      try {
        setLoading(true);
        setError('');
        setPlayerError('');
        setLoadingMessage('Fetching MIDI data...');
        
        cleanupTone(); // Clean up previous MIDI state

        const res = await getMidiById(id);
        setMidi(res.data);
        parsedMidiRef.current = null; // Reset for the new file
        setIsMidiLoaded(false);
        setDurationTotal(res.data?.duration_seconds || 0); // Set initial duration

        if (res.data && res.data.fileId) {
          setLoadingMessage('Loading MIDI file...');
          await loadMidiForPlayback(res.data.fileId);
        } else {
          setPlayerError('MIDI file information not found for this entry.');
          setIsMidiLoaded(false);
        }
      } catch (err) {
        console.error("Failed to fetch MIDI details", err);
        setError(err.response?.data?.msg || 'An error occurred loading MIDI details.');
        setIsMidiLoaded(false);
      } finally {
        setLoading(false);
        // setLoadingMessage(''); // Cleared by specific load steps
      }
    };

    fetchMidiAndSetupPlayer();

    return () => {
      cleanupTone(); // Full cleanup on component unmount
    };
  }, [id, cleanupTone]); // id and cleanupTone are dependencies

  const loadMidiForPlayback = async (fileId) => {
    try {
      const midiUrl = getMidiFileStreamUrl(fileId);
      const parsed = await ToneMidi.fromUrl(midiUrl);
      parsedMidiRef.current = parsed;
      setDurationTotal(parsed.duration); // Update with precise duration
      setIsMidiLoaded(true);
      setPlayerError('');
      console.log("MIDI parsed:", parsedMidiRef.current.name, "Duration:", parsed.duration);
      setLoadingMessage('');
    } catch (e) {
      console.error("Error loading/parsing MIDI for playback:", e);
      setPlayerError(`Could not load MIDI: ${e.message}.`);
      setIsMidiLoaded(false);
      parsedMidiRef.current = null;
      setLoadingMessage('');
    }
  };
  
  const scheduleMidiNotes = useCallback(() => {
    if (!parsedMidiRef.current || !pianoRef.current || !isPianoReady) return false;

    scheduledEventsRef.current.forEach(eventId => Tone.Transport.clear(eventId));
    scheduledEventsRef.current = [];
    Tone.Transport.cancel(); // General cancel

    parsedMidiRef.current.tracks.forEach(track => {
      track.notes.forEach(note => {
        const eventId = Tone.Transport.schedule(time => {
          if (pianoRef.current && isPianoReady) {
            pianoRef.current.triggerAttackRelease(note.name, note.duration, time, note.velocity);
          }
        }, note.time);
        scheduledEventsRef.current.push(eventId);
      });
    });
    console.log("Notes scheduled.");
    return true;
  }, [isPianoReady]); // Depends on isPianoReady

  const updateProgress = useCallback(() => {
    if (isPlaying && parsedMidiRef.current) {
      const currentTime = Tone.Transport.seconds;
      setPlaybackTime(currentTime);

      if (currentTime >= durationTotal - 0.05) { // Small buffer for end
        handleStop(true); // Auto-stop at the end
      } else {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    }
  }, [isPlaying, durationTotal]); // Re-create if isPlaying or durationTotal changes

  // Effect to manage progress updates using requestAnimationFrame
  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, updateProgress]);


  const startToneContext = async () => {
    if (Tone.context.state !== 'running') {
      try {
        await Tone.start();
        toneContextStarted.current = true;
        console.log("AudioContext started/resumed");
        return true;
      } catch (e) {
        console.error("Error starting AudioContext:", e);
        setPlayerError("Audio system error. Please interact with the page (click) and try again.");
        return false;
      }
    }
    return true;
  };

  const togglePlay = async () => {
    const audioContextReady = await startToneContext();
    if (!audioContextReady) return;

    if (!isMidiLoaded || !parsedMidiRef.current || !isPianoReady) {
      setPlayerError("Player not ready (MIDI or Piano).");
      return;
    }

    if (Tone.Transport.state === "started") { // Already playing, so pause
      Tone.Transport.pause();
      setIsPlaying(false);
      console.log("Transport paused at:", formatTime(Tone.Transport.seconds));
    } else { // Paused or stopped, so play
      // Ensure notes are scheduled if transport was stopped or events were cleared
      if (Tone.Transport.state === "stopped" || scheduledEventsRef.current.length === 0) {
        console.log("Transport stopped or no events, scheduling...");
        Tone.Transport.seconds = playbackTime; // Set desired start time
        if (!scheduleMidiNotes()) {
            setPlayerError("Failed to schedule MIDI notes.");
            return;
        }
      }
      // If just paused, events are still there, transport time is where it was.
      // If seeking while paused, playbackTime is updated, and transport.seconds will reflect that.
      // The above `Tone.Transport.seconds = playbackTime` handles resuming from seeked position.
      
      Tone.Transport.start();
      setIsPlaying(true);
      console.log("Transport started from:", formatTime(Tone.Transport.seconds));
    }
  };

  const handleStop = (resetTimeToZero = true) => {
    console.log("Handle Stop called, resetTime:", resetTimeToZero);
    Tone.Transport.stop(); // This also sets Tone.Transport.seconds to 0 by default
    if (pianoRef.current && isPianoReady) {
        pianoRef.current.releaseAll();
    }
    // Clear scheduled events so a fresh schedule happens on next play
    scheduledEventsRef.current.forEach(eventId => Tone.Transport.clear(eventId));
    scheduledEventsRef.current = [];
    
    setIsPlaying(false); // This will stop the requestAnimationFrame loop
    
    if (resetTimeToZero) {
        setPlaybackTime(0); // UI reflects 0
        // Tone.Transport.seconds is already 0 from stop()
    } else {
        // If we wanted to stop but retain position (less common for a "stop" button)
        setPlaybackTime(Tone.Transport.seconds); 
    }
  };
  
  const handleSeek = async (event) => {
    const audioContextReady = await startToneContext();
    if (!audioContextReady || !isMidiLoaded || !parsedMidiRef.current || !isPianoReady || durationTotal <= 0) return;

    const progressBar = event.currentTarget;
    const clickPosition = (event.nativeEvent.offsetX / progressBar.offsetWidth);
    const newTime = Math.max(0, Math.min(clickPosition * durationTotal, durationTotal));
    
    setPlaybackTime(newTime); // Update UI immediately
    Tone.Transport.seconds = newTime; // Set transport's internal time

    console.log("Seeked to:", formatTime(newTime));

    // If playing, need to stop, re-sync, and restart for events to play correctly from new position
    if (isPlaying) {
      Tone.Transport.pause(); // Pause momentarily instead of full stop to avoid time reset
      if (pianoRef.current) pianoRef.current.releaseAll();
      
      // Re-schedule notes to ensure correct timing relative to the new start if needed,
      // though simply setting Tone.Transport.seconds SHOULD be enough if events are absolute.
      // However, to be safe and handle complex MIDI events, re-scheduling can be more robust.
      // For this simple player, merely setting .seconds might be okay.
      // Let's test without full reschedule first for seeking while playing.
      // If issues occur, uncomment the reschedule block.
      
      /* // More robust re-scheduling for seeking while playing:
      scheduledEventsRef.current.forEach(eventId => Tone.Transport.clear(eventId));
      scheduledEventsRef.current = [];
      if (!scheduleMidiNotes()) {
          setPlayerError("Failed to reschedule notes after seek.");
          setIsPlaying(false); // Stop if error
          return;
      }
      Tone.Transport.seconds = newTime; // Ensure this is set after potential reschedule
      */
      Tone.Transport.start(); // Resume
    }
    // If paused, the time is set. On next play, it will start from `playbackTime`
    // and scheduleMidiNotes (if needed) will use that.
  };

  const toggleMute = async () => { /* ... (same as before, ensure startToneContext) ... */ };
  const handleDownload = async () => { /* ... (same as before) ... */ };

  if (loading && !midi) { /* ... loading UI ... */ }
  if (error) return <p className="alert-message alert-error container">{error}</p>;
  if (!midi) return <p className="no-results-message-page container">MIDI not found.</p>;

  const uploaderUsername = midi.uploader?.username || 'Unknown';
  const uploaderIdForLink = midi.uploader?._id || uploaderUsername;
  const thumbnailUrl = midi.thumbnail_url || `/api/midis/placeholder-thumbnail/${(parseInt(midi._id.slice(-5), 16) % 20)}.png`;
  
  const progressPercent = durationTotal > 0 ? (playbackTime / durationTotal) * 100 : 0;
  const playerIsEffectivelyBusy = loadingMessage || (!isMidiLoaded && !playerError && midi && midi.fileId) || (!isPianoReady && !playerError);

  return (
    <div className="midi-detail-page-container container">
      <button onClick={() => navigate(-1)} className="back-button">
        <FaArrowLeft /> Back
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
            <button onClick={handleDownload} className="btn-detail-action btn-download-detail">
                <FaDownload className="icon" /> Download ({midi.size_bytes ? `${(midi.size_bytes / 1024).toFixed(1)} KB` : 'N/A'})
            </button>
            <div className="detail-stats">
                <span><FaEye className="icon" /> {midi.views || 0}</span>
                <span><FaDownload className="icon" /> {midi.downloads || 0}</span>
            </div>
        </div>
        
        <div className="midi-player-section">
          <h3><FaMusic className="icon" /> Piano Player</h3>
          {playerError && <p className="player-error-message">{playerError}</p>}
          
          {playerIsEffectivelyBusy ? (
            <div className="player-loading">
              <div className="spinner-player"></div>
              <p>{loadingMessage || "Preparing player..."}</p>
            </div>
          ) : (
            <div className="midi-player-controls">
              <button 
                onClick={togglePlay} 
                className="btn-player-action" 
                aria-label={isPlaying ? "Pause" : "Play"} 
                disabled={!isMidiLoaded || !isPianoReady}
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <FaPauseCircle /> : <FaPlayCircle />}
              </button>
              <button 
                onClick={() => handleStop(true)} 
                className="btn-player-action" 
                aria-label="Stop and Reset" 
                disabled={!isMidiLoaded || !isPianoReady}
                title="Stop and Reset"
              >
                <FaUndo />
              </button>
              <div className="player-time-display current-time">{formatTime(playbackTime)}</div>
              <div 
                className="player-progress-bar-container" 
                onClick={handleSeek} 
                role="slider" 
                aria-valuenow={Math.round(progressPercent)} 
                aria-valuemin="0" 
                aria-valuemax="100" 
                tabIndex={(isMidiLoaded && isPianoReady) ? 0 : -1}
                title="Seek"
              >
                <div className="player-progress-bar" style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}></div>
              </div>
              <div className="player-time-display total-time">{formatTime(durationTotal)}</div>
              <button 
                onClick={toggleMute} 
                className="btn-player-action btn-volume" 
                aria-label={isMuted ? "Unmute" : "Mute"} 
                disabled={!isPianoReady}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
              </button>
            </div>
          )}
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
            {midi.tags && midi.tags.length > 0 && 
                <li><strong><FaTags className="icon"/> Tags:</strong> 
                    <span className="tags-list">{midi.tags.map(tag => <span key={tag} className="tag-item">{tag}</span>)}</span>
                </li>
            }
            {midi.bpm && <li><strong><FaTachometerAlt className="icon"/> BPM (Tempo):</strong> {midi.bpm}</li>}
            <li><strong><FaStopwatch className="icon"/> Duration:</strong> {formatTime(durationTotal)}</li>
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
  );
};

export default MidiDetailPage;