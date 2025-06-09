// client/src/contexts/PlayerContext.jsx
import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';
import { Midi as ToneMidi } from '@tonejs/midi';
import { Piano } from '@tonejs/piano';
import { getMidiFileStreamUrl } from '../services/apiMidis';

const PlayerContext = createContext();

export const usePlayer = () => useContext(PlayerContext);

export const PlayerProvider = ({ children }) => {
  const [currentPlayingMidi, setCurrentPlayingMidi] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [durationTotal, setDurationTotal] = useState(0);
  const [isMidiDataLoaded, setIsMidiDataLoaded] = useState(false);
  const [isPianoSamplerReady, setIsPianoSamplerReady] = useState(false);
  const [isLoadingPlayer, setIsLoadingPlayer] = useState(false);
  const [playerError, setPlayerError] = useState('');
  const [isMuted, setIsMuted] = useState(false);

  const pianoRef = useRef(null);
  const parsedMidiFileRef = useRef(null);
  const scheduledEventsRef = useRef([]);
  const animationFrameRef = useRef(null);

  // Piano initialization and component cleanup effect.
  useEffect(() => {
    if (!pianoRef.current) { // Simplified check, as this only needs to run once.
      console.log("Global Player: Initializing Piano...");
      setIsLoadingPlayer(true);
      const piano = new Piano({ velocities: 4, release: true }).toDestination();
      pianoRef.current = piano;
      
      piano.load()
        .then(() => {
          setIsPianoSamplerReady(true);
          setIsLoadingPlayer(false);
          console.log("Global Player: Piano samples loaded.");
        })
        .catch(err => {
          console.error("Global Player: Failed to load piano samples:", err);
          setPlayerError("Could not load piano sound for global player.");
          setIsLoadingPlayer(false); // Ensure loading is always false on completion
        });
    }

    return () => {
        pianoRef.current?.dispose();
        Tone.Transport.stop();
        Tone.Transport.cancel();
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount.

  const stopCurrentTrackAudio = useCallback((resetMidiState = false) => {
    Tone.Transport.stop();
    Tone.Transport.cancel(); // Clears all scheduled events from the transport
    scheduledEventsRef.current = []; // Clear our ref as well for good measure

    if (pianoRef.current && isPianoSamplerReady) {
      for (let i = 21; i <= 108; i++) pianoRef.current.keyUp({ midi: i, time: Tone.now() });
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setIsPlaying(false);
    setPlaybackTime(0);
    
    if (resetMidiState) {
        setCurrentPlayingMidi(null);
        parsedMidiFileRef.current = null;
        setIsMidiDataLoaded(false);
        setDurationTotal(0);
        setPlayerError('');
    }
  }, [isPianoSamplerReady]);

  // Exposed function to fully close the player
  const clearAndClosePlayer = useCallback(() => {
      stopCurrentTrackAudio(true); // Pass true to reset all MIDI-specific state
  }, [stopCurrentTrackAudio]);

  const scheduleNotes = useCallback(() => {
    if (!parsedMidiFileRef.current || !pianoRef.current || !isPianoSamplerReady) {
        console.warn("Global Player: Cannot schedule notes - prerequisites not met.");
        return false;
    }
    
    // Always start with a clean transport slate before scheduling
    Tone.Transport.cancel();
    scheduledEventsRef.current = [];

    parsedMidiFileRef.current.tracks.forEach(track => {
      track.notes.forEach(note => {
        const eventId = Tone.Transport.schedule(time => {
          pianoRef.current?.keyDown({ note: note.name, time, velocity: note.velocity });
          pianoRef.current?.keyUp({ note: note.name, time: time + note.duration });
        }, note.time);
        scheduledEventsRef.current.push(eventId);
      });
    });
    console.log("Global Player: Notes scheduled for", parsedMidiFileRef.current.name);
    return true;
  }, [isPianoSamplerReady]);

  const startToneAudioContext = async () => {
    if (Tone.context.state !== 'running') {
      try {
        await Tone.start();
        console.log("Global Player: Tone AudioContext started.");
        return true;
      } catch (e) {
        setPlayerError("Audio context error. Click a player button to start.");
        console.error("Global Player: Error starting Tone AudioContext:", e);
        return false;
      }
    }
    return true;
  };

  const updateProgressLoop = useCallback(() => {
    const currentTime = Tone.Transport.seconds;
    setPlaybackTime(currentTime);

    if (currentTime >= durationTotal - 0.05 && durationTotal > 0) {
      console.log("Global Player: MIDI end reached.");
      stopCurrentTrackAudio(false); // Stop audio, reset time, but don't clear the MIDI
      // Re-schedule so the track is ready to be played again from the beginning
      scheduleNotes();
    } else {
      animationFrameRef.current = requestAnimationFrame(updateProgressLoop);
    }
  }, [durationTotal, stopCurrentTrackAudio, scheduleNotes]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgressLoop);
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, updateProgressLoop]);

  // Combined play/pause/start logic
  const togglePlay = useCallback(async () => {
    if (!currentPlayingMidi || !isMidiDataLoaded) {
      setPlayerError("No MIDI loaded to play.");
      return;
    }
    
    if (!await startToneAudioContext()) return;
    
    if (Tone.Transport.state === "started") {
      Tone.Transport.pause();
      setIsPlaying(false);
    } else {
      // If stopped, ensure notes are scheduled (e.g., after seek or first load)
      if (Tone.Transport.state === "stopped" && scheduledEventsRef.current.length === 0) {
        if (!scheduleNotes()) {
            setPlayerError("Failed to schedule notes for playback.");
            return;
        }
      }
      Tone.Transport.start();
      setIsPlaying(true);
    }
  }, [currentPlayingMidi, isMidiDataLoaded, scheduleNotes]);

  // Exposed function to initiate playing a specific MIDI
  const playMidi = useCallback(async (midiData) => {
    if (!midiData?.fileId) {
      setPlayerError("Invalid MIDI data provided.");
      return;
    }
    if (!isPianoSamplerReady) {
      setPlayerError("Piano sound is not ready yet. Please wait.");
      return;
    }
    if (!await startToneAudioContext()) return;

    // If it's the same MIDI and it's just paused, simply resume.
    if (currentPlayingMidi?._id === midiData._id && isMidiDataLoaded && !isPlaying) {
        togglePlay();
        return;
    }

    // Stop any currently playing track before loading a new one.
    stopCurrentTrackAudio(false);
    setIsLoadingPlayer(true);
    setPlayerError('');
    
    try {
      const midiUrl = getMidiFileStreamUrl(midiData.fileId);
      const parsed = await ToneMidi.fromUrl(midiUrl);
      
      // *** LOGIC REFINEMENT ***
      // Set refs and state together after successful loading.
      parsedMidiFileRef.current = parsed;
      setCurrentPlayingMidi(midiData);
      setDurationTotal(parsed.duration);
      setIsMidiDataLoaded(true); // State is now consistent with refs
      
      // Reset playback position for the new track.
      setPlaybackTime(0);
      Tone.Transport.seconds = 0;

      // Now schedule and play.
      if (scheduleNotes()) {
        Tone.Transport.start();
        setIsPlaying(true);
      } else {
        throw new Error("Could not schedule MIDI notes.");
      }

    } catch(e) {
        console.error("Global Player: Error in playMidi execution:", e);
        setPlayerError(`Failed to play MIDI: ${e.message}`);
        clearAndClosePlayer();
    } finally {
        setIsLoadingPlayer(false);
    }
  }, [isPianoSamplerReady, currentPlayingMidi, isMidiDataLoaded, isPlaying, stopCurrentTrackAudio, scheduleNotes, togglePlay, clearAndClosePlayer]);

  const seekPlayer = useCallback(async (time) => {
    if (!currentPlayingMidi || !isMidiDataLoaded || durationTotal <= 0 || !await startToneAudioContext()) {
        return;
    }
    
    const newTime = Math.max(0, Math.min(time, durationTotal));
    const wasPlaying = isPlaying;
    
    // Stop the transport completely to ensure clean state for seeking
    stopCurrentTrackAudio(false);
    setPlaybackTime(newTime); // Set UI time immediately
    
    // Set the transport's time and re-schedule all notes
    Tone.Transport.seconds = newTime;
    if (!scheduleNotes()) {
        setPlayerError("Failed to reschedule notes after seek.");
        return;
    }
    
    // Resume playback if it was playing before the seek
    if (wasPlaying) {
      Tone.Transport.start();
      setIsPlaying(true);
    }
  }, [currentPlayingMidi, isMidiDataLoaded, durationTotal, isPlaying, stopCurrentTrackAudio, scheduleNotes]);

  const togglePlayerMute = useCallback(async () => {
    if (!isPianoSamplerReady || !pianoRef.current || !await startToneAudioContext()) return;
    const newMuteState = !isMuted;
    pianoRef.current.volume.mute = newMuteState;
    setIsMuted(newMuteState);
  }, [isPianoSamplerReady, isMuted]);

  const value = {
    currentPlayingMidi,
    isPlaying,
    playbackTime,
    durationTotal,
    isMidiDataLoaded,
    isPianoSamplerReady,
    isLoadingPlayer,
    playerError,
    isMuted,
    playMidi,
    togglePlay, // Simplified to a single toggle function
    seekPlayer,
    togglePlayerMute,
    clearAndClosePlayer,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};