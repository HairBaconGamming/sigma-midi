// client/src/pages/MidiDetailPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getMidiById, trackMidiDownload, getMidiFileStreamUrl } from '../services/apiMidis';
import {
  FaDownload, FaPlayCircle, FaPauseCircle, FaUser, FaCalendarAlt, FaInfoCircle,
  FaTachometerAlt, FaMusic, FaEye, FaUserEdit, FaArrowLeft, FaTags, FaGuitar,
  FaStopwatch, FaStarHalfAlt, FaClipboardList, FaUndo, FaVolumeUp, FaVolumeMute
  // FaShareAlt, FaHeart, FaRegHeart // Keep if you plan to use them for future features
} from 'react-icons/fa';
import * as Tone from 'tone';
import { Midi as ToneMidi } from '@tonejs/midi';
import { Piano } from '@tonejs/piano';

import '../assets/css/MidiDetailPage.css';
import { useAuth } from '../contexts/AuthContext'; // Keep if used for other features like owner checks, favorites

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
  const { isAuthenticated, user } = useAuth(); // Get user for potential owner checks

  const [midi, setMidi] = useState(null);
  const [loading, setLoading] = useState(true); // For overall page data
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
  const toneContextStarted = useRef(false); // To track if Tone.start() was called explicitly by user action
  const scheduledEventsRef = useRef([]);
  const animationFrameRef = useRef(null);

  // --- Tone.js and Player Logic ---

  const cleanupTone = useCallback(() => {
    console.log("Cleanup Tone called");
    Tone.Transport.stop();
    Tone.Transport.cancel(); // Clears all scheduled events from the transport
    
    scheduledEventsRef.current.forEach(eventId => Tone.Transport.clear(eventId));
    scheduledEventsRef.current = [];

    // For @tonejs/piano, notes scheduled with triggerAttackRelease should stop with Transport.
    // If any notes were manually triggered with keyDown/triggerAttack, they would need manual release.
    // The Piano instance doesn't have a global releaseAll().
    // Releasing notes on the piano instance if it exists might be needed for stuck notes
    // but usually Transport.stop() and cancelling events is sufficient for triggerAttackRelease.
    // if (pianoRef.current && typeof pianoRef.current.releaseAll === 'function') { // Check if method exists
    //   pianoRef.current.releaseAll(); // This method might not exist on Piano wrapper
    // }


    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsPlaying(false);
    setPlaybackTime(0); // Reflect that transport time is reset by stop()
  }, []);

  // Effect for initializing Piano
  useEffect(() => {
    if (!isPianoReady && !pianoRef.current) { // Only initialize if not already ready or in progress
      setLoadingMessage('Initializing piano sound...');
      console.log("Attempting to initialize @tonejs/piano...");
      const piano = new Piano({ velocities: 4, release: true }); // Added release samples
      
      piano.toDestination();
      // Assign to ref immediately so other functions can check its existence,
      // even if not fully loaded yet.
      pianoRef.current = piano; 

      piano.load()
        .then(() => {
          setIsPianoReady(true);
          setLoadingMessage('');
          console.log("@tonejs/piano samples loaded and ready.");
        })
        .catch(err => {
          console.error("Failed to load piano samples:", err);
          setPlayerError("Could not load piano sound. Playback might be affected or unavailable.");
          setIsPianoReady(false); 
          setLoadingMessage('');
          pianoRef.current = null; // Nullify ref on load error
        });
    }
    // No cleanup for pianoRef itself here, as it's intended to persist across MIDI loads
    // unless the entire component unmounts.
  }, [isPianoReady]);

  // Effect for fetching MIDI data when 'id' changes
  useEffect(() => {
    const fetchMidiAndSetupPlayer = async () => {
      try {
        setLoading(true); setError(''); setPlayerError('');
        setLoadingMessage('Fetching MIDI data...');
        
        cleanupTone(); // Clean up previous MIDI-specific state and transport events

        const res = await getMidiById(id);
        setMidi(res.data);
        parsedMidiRef.current = null; // Reset for the new file
        setIsMidiLoaded(false);
        setDurationTotal(res.data?.duration_seconds || 0); // Set initial/fallback duration

        if (res.data && res.data.fileId) {
          setLoadingMessage('Loading MIDI file...');
          await loadMidiForPlayback(res.data.fileId);
        } else {
          setPlayerError('MIDI file information not found for this entry.');
          setIsMidiLoaded(false);
        }
      } catch (err) {
        console.error("Failed to fetch MIDI details", err.response ? err.response.data : err.message);
        setError(err.response?.data?.msg || 'An error occurred while loading MIDI details.');
        setIsMidiLoaded(false);
      } finally {
        setLoading(false); // Overall page loading
        // setLoadingMessage will be cleared by specific load steps or if no further steps
      }
    };

    fetchMidiAndSetupPlayer();

    return () => {
      cleanupTone(); // Full cleanup when component unmounts
    };
  }, [id, cleanupTone]);

  const loadMidiForPlayback = async (fileId) => {
    try {
      const midiUrl = getMidiFileStreamUrl(fileId);
      const parsed = await ToneMidi.fromUrl(midiUrl);
      parsedMidiRef.current = parsed;
      setDurationTotal(parsed.duration); // Update with precise duration from parsed MIDI
      setIsMidiLoaded(true);
      setPlayerError('');
      console.log("MIDI parsed:", parsedMidiRef.current.name, "Duration:", parsed.duration);
      setLoadingMessage('');
    } catch (e) {
      console.error("Error loading or parsing MIDI for playback:", e);
      setPlayerError(`Could not load MIDI file: ${e.message}.`);
      setIsMidiLoaded(false);
      parsedMidiRef.current = null;
      setLoadingMessage('');
    }
  };
  
  const scheduleMidiNotes = useCallback(() => {
    if (!parsedMidiRef.current || !pianoRef.current || !isPianoReady) {
      console.warn("Cannot schedule notes: MIDI not parsed or piano not ready.");
      setPlayerError("Cannot schedule notes: MIDI or Piano sound not ready.");
      return false; 
    }

    // Ensure previous events are thoroughly cleared before scheduling new ones
    scheduledEventsRef.current.forEach(eventId => Tone.Transport.clear(eventId));
    scheduledEventsRef.current = [];
    Tone.Transport.cancel(); // This is a more general cancel for all transport events

    console.log(`Scheduling ${parsedMidiRef.current.tracks.reduce((sum, t) => sum + t.notes.length, 0)} notes.`);
    parsedMidiRef.current.tracks.forEach(track => {
      track.notes.forEach(note => {
        const eventId = Tone.Transport.schedule(time => {
          if (pianoRef.current && isPianoReady) {
            pianoRef.current.keyDown({note: note.name, time: time, velocity: note.velocity});
            // Schedule keyUp for note release
            pianoRef.current.keyUp({note: note.name, time: time + note.duration});
          }
        }, note.time); // note.time is absolute time from start of MIDI
        scheduledEventsRef.current.push(eventId);
      });
    });
    console.log("All notes scheduled on Tone.Transport using keyDown/keyUp.");
    return true;
  }, [isPianoReady]); // Depends on isPianoReady to ensure pianoRef.current exists and is loaded

  const updateProgress = useCallback(() => {
    if (isPlaying && parsedMidiRef.current) { // Ensure parsedMidiRef.current exists
      const currentTime = Tone.Transport.seconds;
      setPlaybackTime(currentTime);

      if (currentTime >= durationTotal - 0.05 && durationTotal > 0) {
        console.log("MIDI end reached in updateProgress.");
        handleStop(true);
      } else {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    }
  }, [isPlaying, durationTotal, handleStop]); // Added handleStop

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, updateProgress]);

  const startToneContext = async () => {
    if (Tone.context.state !== 'running') {
      try {
        await Tone.start(); // This must be called by a user gesture
        toneContextStarted.current = true; 
        console.log("AudioContext started/resumed via Tone.start()");
        return true;
      } catch (e) {
        console.error("Error starting AudioContext with Tone.start():", e);
        setPlayerError("Audio system error. Please click the page or a button and try again.");
        return false;
      }
    }
    return true;
  };

  const togglePlay = async () => {
    const audioContextReady = await startToneContext();
    if (!audioContextReady) return;

    if (!isMidiLoaded || !parsedMidiRef.current || !isPianoReady || !pianoRef.current) {
      setPlayerError("Player not ready (MIDI not loaded or Piano sound not ready).");
      return;
    }

    if (Tone.Transport.state === "started") { // If playing, then pause
      Tone.Transport.pause();
      setIsPlaying(false);
      console.log("Transport paused at:", formatTime(Tone.Transport.seconds));
    } else { // If paused or stopped, then play
      // If stopped or events were cleared (e.g. after seek while paused), schedule them.
      if (Tone.Transport.state === "stopped" || scheduledEventsRef.current.length === 0) {
        console.log("Transport stopped or no events currently scheduled. Setting time and scheduling notes...");
        Tone.Transport.seconds = playbackTime; // Set desired start time
        if (!scheduleMidiNotes()) { // Schedule notes
            setPlayerError("Failed to schedule MIDI notes for playback.");
            return; // Don't proceed if scheduling failed
        }
      }
      // If it was just paused, events are still scheduled. Transport.seconds is where it was.
      // The `Tone.Transport.seconds = playbackTime` above handles resuming from a specific seeked point correctly.
      
      Tone.Transport.start();
      setIsPlaying(true);
      console.log("Transport started/resumed from:", formatTime(Tone.Transport.seconds));
    }
  };

  // useCallback for handleStop as it's in a dependency array
  const handleStop = useCallback((resetTimeToZero = true) => {
    console.log("Handle Stop called, resetTime:", resetTimeToZero);
    Tone.Transport.stop(); // This also stops all scheduled events and resets transport time to 0.
    
    // For @tonejs/piano, if using keyDown/keyUp, you might need to explicitly release held notes.
    // However, Transport.stop() should inherently stop new keyDown events from firing.
    // Releasing all notes on the piano instance can prevent "stuck" notes if any were
    // somehow triggered without a corresponding keyUp.
    if (pianoRef.current && isPianoReady) {
        // Iterate through a wide range of MIDI notes and release them.
        // This is a more forceful "panic" button for stuck notes with @tonejs/piano.
        for (let i = 21; i <= 108; i++) { // A0 to C8
            pianoRef.current.keyUp({ midi: i, time: Tone.now() });
        }
        console.log("All potential piano notes released via keyUp loop.");
    }
    
    // Events are implicitly cancelled by Tone.Transport.stop() from its internal queue
    // but explicitly clearing our ref is good practice.
    scheduledEventsRef.current.forEach(eventId => Tone.Transport.clear(eventId)); // May be redundant but safe
    scheduledEventsRef.current = [];
    
    setIsPlaying(false); // Will stop the requestAnimationFrame loop
    
    if (resetTimeToZero) {
        setPlaybackTime(0); 
    } else {
        setPlaybackTime(Tone.Transport.seconds); // Should be 0 anyway after Transport.stop()
    }
  }, [isPianoReady]); // isPianoReady ensures pianoRef.current operations are safe
  
  const handleSeek = async (event) => {
    const audioContextReady = await startToneContext();
    if (!audioContextReady || !isMidiLoaded || !parsedMidiRef.current || !isPianoReady || durationTotal <= 0) return;

    const progressBar = event.currentTarget;
    const clickPosition = (event.nativeEvent.offsetX / progressBar.offsetWidth);
    const newTime = Math.max(0, Math.min(clickPosition * durationTotal, durationTotal));
    
    setPlaybackTime(newTime); // Update UI immediately

    const wasPlaying = isPlaying;
    if (wasPlaying) {
      Tone.Transport.pause(); // Pause before making significant changes
    }
    
    // Stop any currently sounding notes on the piano manually
    if (pianoRef.current && isPianoReady) {
        for (let i = 21; i <= 108; i++) { // Release all possible piano notes
            pianoRef.current.keyUp({ midi: i, time: Tone.now() });
        }
    }
    
    // Always clear old events and re-schedule when seeking.
    // This ensures notes are triggered correctly relative to the new transport position.
    scheduledEventsRef.current.forEach(eventId => Tone.Transport.clear(eventId));
    scheduledEventsRef.current = [];
    Tone.Transport.cancel(); // Thoroughly clear transport of any prior events

    if (!scheduleMidiNotes()) { // Re-schedule all notes based on the original MIDI data
        setPlayerError("Failed to reschedule notes after seek.");
        if(wasPlaying) setIsPlaying(false); // If it was playing, but scheduling failed, set to not playing
        return;
    }
    
    Tone.Transport.seconds = newTime; // NOW set the new time on the transport AFTER re-scheduling
    console.log("Seeked. Transport time set to:", formatTime(newTime));

    if (wasPlaying) {
      Tone.Transport.start(); // Resume playback if it was playing
      setIsPlaying(true); // Ensure isPlaying state is correct
    }
    // If it was paused, it remains paused at the new time, with fresh events scheduled.
  };

  const toggleMute = async () => {
    const audioContextReady = await startToneContext();
    if (!audioContextReady || !pianoRef.current || !isPianoReady) return;

    const newMuteState = !isMuted;
    // @tonejs/piano uses a Tone.Volume node internally, which has a 'mute' property.
    if (pianoRef.current.volume) { // Check if volume property exists
        pianoRef.current.volume.mute = newMuteState;
    } else { // Fallback if direct volume.mute isn't available (older versions or different setup)
        pianoRef.current.output.gain.value = newMuteState ? 0 : 1; // Assumes output is a GainNode
    }
    setIsMuted(newMuteState);
    console.log("Mute toggled. New mute state:", newMuteState);
  };

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

  // --- RENDER LOGIC ---
  if (loading && !midi) {
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
  
  const progressPercent = durationTotal > 0 ? (playbackTime / durationTotal) * 100 : 0;
  const playerIsEffectivelyBusy = loadingMessage || (!isMidiLoaded && !playerError && midi && midi.fileId) || (!isPianoReady && !playerError);

  return (
    <div className="midi-detail-page-container container">
      <button onClick={() => navigate(-1)} className="back-button" title="Go back">
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
                disabled={!isMidiLoaded || !isPianoReady} // Disable if nothing to stop/reset
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