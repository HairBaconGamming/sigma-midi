// client/src/pages/MidiDetailPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getMidiById, trackMidiDownload, getMidiFileStreamUrl } from '../services/apiMidis';
import {
  FaDownload, FaPlayCircle, FaPauseCircle, FaUser, FaCalendarAlt, FaInfoCircle,
  FaTachometerAlt, FaMusic, FaEye, FaUserEdit, FaArrowLeft, FaTags, FaGuitar,
  FaStopwatch, FaStarHalfAlt, FaClipboardList, FaUndo
} from 'react-icons/fa';
import * as Tone from 'tone';
import { Midi as ToneMidi } from '@tonejs/midi';
import { Piano } from '@tonejs/piano';

import { usePlayer } from '../../contexts/PlayerContext';

import '../assets/css/MidiDetailPage.css';
import { useAuth } from '../contexts/AuthContext';

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
  const { user } = useAuth();

  const [midi, setMidi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMidiLoaded, setIsMidiLoaded] = useState(false);
  const [isPianoReady, setIsPianoReady] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [durationTotal, setDurationTotal] = useState(0);
  const [playerError, setPlayerError] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('');

  // Tone.js Refs
  const pianoRef = useRef(null);
  const parsedMidiRef = useRef(null);
  const scheduledEventsRef = useRef([]);
  const animationFrameRef = useRef(null);

  // --- Tone.js and Player Logic ---

  const cleanupTone = useCallback(() => {
    console.log("Cleanup Tone called");
    Tone.Transport.stop();
    Tone.Transport.cancel(); 
    scheduledEventsRef.current = [];

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsPlaying(false);
    setPlaybackTime(0);
  }, []);

  useEffect(() => {
    if (!isPianoReady && !pianoRef.current) {
      setLoadingMessage('Initializing piano sound...');
      console.log("Attempting to initialize @tonejs/piano...");
      const piano = new Piano({ velocities: 4, release: true });
      
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
          setPlayerError("Could not load piano sound. Playback is unavailable.");
          setIsPianoReady(false); 
          setLoadingMessage('');
          pianoRef.current = null;
        });
    }
  }, [isPianoReady]);

  useEffect(() => {
    const fetchMidiAndSetupPlayer = async () => {
      try {
        setLoading(true); setError(''); setPlayerError('');
        setLoadingMessage('Fetching MIDI data...');
        
        cleanupTone(); 

        const res = await getMidiById(id);
        setMidi(res.data);
        parsedMidiRef.current = null;
        setIsMidiLoaded(false);
        setDurationTotal(res.data?.duration_seconds || 0);

        if (res.data?.fileId) {
          setLoadingMessage('Loading MIDI file...');
          await loadMidiForPlayback(res.data.fileId);
        } else {
          setPlayerError('MIDI file information not found for this entry.');
        }
      } catch (err) {
        console.error("Failed to fetch MIDI details", err.response ? err.response.data : err.message);
        setError(err.response?.data?.msg || 'An error occurred while loading MIDI details.');
      } finally {
        setLoading(false);
      }
    };

    fetchMidiAndSetupPlayer();

    return () => {
      cleanupTone();
    };
  }, [id, cleanupTone]);

  const loadMidiForPlayback = async (fileId) => {
    try {
      const midiUrl = getMidiFileStreamUrl(fileId);
      const parsed = await ToneMidi.fromUrl(midiUrl);
      parsedMidiRef.current = parsed;
      setDurationTotal(parsed.duration);
      setIsMidiLoaded(true);
      setPlayerError('');
      console.log("MIDI parsed:", parsed.name, "Duration:", parsed.duration);
    } catch (e) {
      console.error("Error loading or parsing MIDI for playback:", e);
      setPlayerError(`Could not load MIDI file: ${e.message}.`);
      setIsMidiLoaded(false);
    } finally {
        setLoadingMessage('');
    }
  };
  
  const scheduleMidiNotes = useCallback(() => {
    if (!parsedMidiRef.current || !pianoRef.current || !isPianoReady) {
      console.warn("Cannot schedule notes: MIDI not parsed or piano not ready.");
      setPlayerError("Cannot schedule notes: MIDI or Piano sound not ready.");
      return false; 
    }

    Tone.Transport.cancel();
    scheduledEventsRef.current = [];

    console.log(`Scheduling ${parsedMidiRef.current.tracks.reduce((sum, t) => sum + t.notes.length, 0)} notes.`);
    parsedMidiRef.current.tracks.forEach(track => {
      track.notes.forEach(note => {
        const eventId = Tone.Transport.schedule(time => {
          pianoRef.current?.keyDown({note: note.name, time: time, velocity: note.velocity});
          pianoRef.current?.keyUp({note: note.name, time: time + note.duration});
        }, note.time);
        scheduledEventsRef.current.push(eventId);
      });
    });
    console.log("All notes scheduled on Tone.Transport.");
    return true;
  }, [isPianoReady]);

  const handleStop = useCallback((resetTimeToZero = true) => {
    console.log("Handle Stop called, resetTime:", resetTimeToZero);
    Tone.Transport.stop();
    
    if (pianoRef.current && isPianoReady) {
        for (let i = 21; i <= 108; i++) {
            pianoRef.current.keyUp({ midi: i, time: Tone.now() });
        }
        console.log("All potential piano notes released.");
    }
    
    scheduledEventsRef.current = [];
    
    setIsPlaying(false);
    
    if (resetTimeToZero) {
        setPlaybackTime(0); 
    }
  }, [isPianoReady]);

  const updateProgress = useCallback(() => {
    if (isPlaying) {
      const currentTime = Tone.Transport.seconds;
      setPlaybackTime(currentTime);

      if (durationTotal > 0 && currentTime >= durationTotal - 0.05) {
        console.log("MIDI playback finished.");
        handleStop(true);
      } else {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    }
  }, [isPlaying, durationTotal, handleStop]);

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
      }
    };
  }, [isPlaying, updateProgress]);

  const startToneContext = async () => {
    if (Tone.context.state !== 'running') {
      try {
        await Tone.start();
        console.log("AudioContext started/resumed successfully.");
        return true;
      } catch (e) {
        console.error("Error starting AudioContext:", e);
        setPlayerError("Audio system failed. Please click a button and try again.");
        return false;
      }
    }
    return true;
  };

  const togglePlay = async () => {
    if (!await startToneContext()) return;

    if (!isMidiLoaded || !isPianoReady) {
      setPlayerError("Player not ready (MIDI not loaded or Piano sound not ready).");
      return;
    }

    if (Tone.Transport.state === "started") {
      Tone.Transport.pause();
      setIsPlaying(false);
      console.log("Transport paused at:", formatTime(Tone.Transport.seconds));
    } else {
      if (Tone.Transport.state === "stopped" || scheduledEventsRef.current.length === 0) {
        console.log("Scheduling notes before playback...");
        Tone.Transport.seconds = playbackTime;
        if (!scheduleMidiNotes()) {
            setPlayerError("Failed to schedule MIDI notes for playback.");
            return;
        }
      }
      
      Tone.Transport.start();
      setIsPlaying(true);
      console.log("Transport started/resumed from:", formatTime(Tone.Transport.seconds));
    }
  };
  
  const handleSeek = async (event) => {
    const progressBar = event.currentTarget;
    const offsetX = event.nativeEvent.offsetX;

    if (!await startToneContext() || !isMidiLoaded || !isPianoReady || durationTotal <= 0) {
      return;
    }

    if (!progressBar) return;

    const clickPosition = (offsetX / progressBar.offsetWidth);
    const newTime = Math.max(0, Math.min(clickPosition * durationTotal, durationTotal));
    
    setPlaybackTime(newTime); 

    const wasPlaying = isPlaying;
    if (wasPlaying) {
      Tone.Transport.pause();
    }
    
    if (pianoRef.current) {
        for (let i = 21; i <= 108; i++) {
            pianoRef.current.keyUp({ midi: i, time: Tone.now() });
        }
    }
    
    Tone.Transport.cancel();
    scheduledEventsRef.current = [];
    if (!scheduleMidiNotes()) {
        setPlayerError("Failed to reschedule notes after seek.");
        if(wasPlaying) setIsPlaying(false);
        return;
    }
    
    Tone.Transport.seconds = newTime;
    console.log("Seeked. Transport time set to:", formatTime(newTime));

    if (wasPlaying) {
      Tone.Transport.start();
    }
  };

  const handleDownload = async () => {
    if (!midi?.fileId) {
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
      console.error("Error initiating download:", downloadError);
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
  const playerIsBusy = loadingMessage || (!isMidiLoaded && !playerError && midi?.fileId) || (!isPianoReady && !playerError);

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
          
          {playerIsBusy ? (
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