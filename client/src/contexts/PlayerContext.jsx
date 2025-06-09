// client/src/contexts/PlayerContext.jsx
import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';
import { Midi as ToneMidi } from '@tonejs/midi';
import { Piano } from '@tonejs/piano';
import { getMidiFileStreamUrl } from '../services/apiMidis'; // Assuming this is where it is

const PlayerContext = createContext();

export const usePlayer = () => useContext(PlayerContext);

export const PlayerProvider = ({ children }) => {
  const [currentPlayingMidi, setCurrentPlayingMidi] = useState(null); // Holds { _id, title, artist, fileId, duration_seconds, etc. }
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [durationTotal, setDurationTotal] = useState(0);
  const [isMidiDataLoaded, setIsMidiDataLoaded] = useState(false); // If ToneMidi has parsed the file
  const [isPianoSamplerReady, setIsPianoSamplerReady] = useState(false);
  const [isLoadingPlayer, setIsLoadingPlayer] = useState(false); // For loading MIDI or piano
  const [playerError, setPlayerError] = useState('');
  const [isMuted, setIsMuted] = useState(false);

  const pianoRef = useRef(null);
  const parsedMidiFileRef = useRef(null);
  const scheduledEventsRef = useRef([]);
  const animationFrameRef = useRef(null);
  const toneContextStarted = useRef(false);

  // Initialize Piano once
  useEffect(() => {
    if (!pianoRef.current && !isPianoSamplerReady) {
      console.log("Global Player: Initializing Piano...");
      setIsLoadingPlayer(true);
      const piano = new Piano({ velocities: 4, release: true });
      piano.toDestination();
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
          setIsPianoSamplerReady(false);
          setIsLoadingPlayer(false);
          pianoRef.current = null;
        });
    }
  }, [isPianoSamplerReady]);


  const cleanupCurrentMidiAudio = useCallback(() => {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
    scheduledEventsRef.current = [];
    if (pianoRef.current && isPianoSamplerReady) {
      // Release all notes for safety, though triggerAttackRelease should manage them with transport stop
      for (let i = 21; i <= 108; i++) pianoRef.current.keyUp({ midi: i, time: Tone.now() });
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setIsPlaying(false);
    setPlaybackTime(0);
    // Don't reset currentPlayingMidi here, it's managed by playMidi function
  }, [isPianoSamplerReady]);


  const loadAndParseMidi = useCallback(async (midiToLoad) => {
    if (!midiToLoad || !midiToLoad.fileId) {
      setPlayerError("No file ID provided for playback.");
      return false;
    }
    if (!isPianoSamplerReady || !pianoRef.current) {
      setPlayerError("Piano sound not ready.");
      return false;
    }

    cleanupCurrentMidiAudio(); // Clean up before loading new
    setIsLoadingPlayer(true);
    setPlayerError('');
    setIsMidiDataLoaded(false);
    parsedMidiFileRef.current = null;

    try {
      const midiUrl = getMidiFileStreamUrl(midiToLoad.fileId);
      const parsed = await ToneMidi.fromUrl(midiUrl);
      parsedMidiFileRef.current = parsed;
      setDurationTotal(parsed.duration);
      setCurrentPlayingMidi(midiToLoad); // Now set the full MIDI object
      setIsMidiDataLoaded(true);
      console.log("Global Player: MIDI parsed:", parsed.name);
      return true;
    } catch (e) {
      console.error("Global Player: Error loading/parsing MIDI:", e);
      setPlayerError(`Could not load MIDI: ${e.message}`);
      setCurrentPlayingMidi(null); // Clear if loading failed
      return false;
    } finally {
      setIsLoadingPlayer(false);
    }
  }, [isPianoSamplerReady, cleanupCurrentMidiAudio]);

  const scheduleNotesForGlobalPlayer = useCallback(() => {
    if (!parsedMidiFileRef.current || !pianoRef.current || !isPianoSamplerReady) return false;
    
    scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
    scheduledEventsRef.current = [];
    Tone.Transport.cancel();

    parsedMidiFileRef.current.tracks.forEach(track => {
      track.notes.forEach(note => {
        const eventId = Tone.Transport.schedule(time => {
          if (pianoRef.current && isPianoSamplerReady) {
            pianoRef.current.keyDown({ note: note.name, time, velocity: note.velocity });
            pianoRef.current.keyUp({ note: note.name, time: time + note.duration });
          }
        }, note.time);
        scheduledEventsRef.current.push(eventId);
      });
    });
    console.log("Global Player: Notes scheduled.");
    return true;
  }, [isPianoSamplerReady]);

  const startToneAudioContext = async () => {
    if (Tone.context.state !== 'running') {
      try {
        await Tone.start();
        toneContextStarted.current = true;
        return true;
      } catch (e) {
        setPlayerError("Audio context error. Please interact with the page.");
        return false;
      }
    }
    return true;
  };

  const updateProgressLoop = useCallback(() => {
    if (Tone.Transport.state === "started" && parsedMidiFileRef.current) {
      const currentTime = Tone.Transport.seconds;
      setPlaybackTime(currentTime);
      if (currentTime >= durationTotal - 0.05 && durationTotal > 0) {
        console.log("Global Player: MIDI end.");
        // Option: stop, or loop, or go to next in playlist
        Tone.Transport.stop();
        setIsPlaying(false);
        setPlaybackTime(0); // Reset for next play
        Tone.Transport.seconds = 0;
         // Re-schedule for next play from beginning
        if (parsedMidiFileRef.current) scheduleNotesForGlobalPlayer();
      } else {
        animationFrameRef.current = requestAnimationFrame(updateProgressLoop);
      }
    }
  }, [durationTotal, scheduleNotesForGlobalPlayer]);

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


  const playMidi = useCallback(async (midiData) => {
    if (!midiData || !midiData.fileId) {
        console.error("Global Player: playMidi called with invalid midiData", midiData);
        setPlayerError("Invalid MIDI data to play.");
        return;
    }
    if (!isPianoSamplerReady) {
        setPlayerError("Piano sound is not ready yet. Please wait.");
        // Optionally, queue this action or try to initialize piano again
        return;
    }

    console.log("Global Player: playMidi called for", midiData.title);
    const audioContextNowReady = await startToneAudioContext();
    if (!audioContextNowReady) return;

    // If it's a new MIDI or MIDI data isn't loaded for the current one
    if (!currentPlayingMidi || currentPlayingMidi._id !== midiData._id || !isMidiDataLoaded) {
        const loaded = await loadAndParseMidi(midiData);
        if (!loaded) return; // Error handled in loadAndParseMidi
        // Notes will be scheduled by togglePlayControls or seek
    }
    // If already loaded, just ensure time is set and toggle play
    setPlaybackTime(0); // Start new MIDI from beginning
    Tone.Transport.seconds = 0;
    
    // Now call togglePlayControls to handle actual playback start
    // Pass true to force play, as this function is explicitly "playMidi"
    togglePlayControls(true);

  }, [isPianoSamplerReady, currentPlayingMidi, isMidiDataLoaded, loadAndParseMidi, togglePlayControls]);


  // Renamed to avoid conflict with isPlaying state
  const togglePlayControls = useCallback(async (forcePlay) => {
    if (!currentPlayingMidi || !isMidiDataLoaded || !isPianoSamplerReady || !pianoRef.current) {
      setPlayerError("Cannot play: Player not fully ready.");
      return;
    }
    const audioContextNowReady = await startToneAudioContext();
    if (!audioContextNowReady) return;

    const currentTransportState = Tone.Transport.state;

    if (currentTransportState === "started" && forcePlay !== true) { // Pause if playing
      Tone.Transport.pause();
      setIsPlaying(false);
    } else { // Play if paused, stopped, or forcePlay is true
      if (currentTransportState === "stopped" || scheduledEventsRef.current.length === 0) {
        // If stopped or no events scheduled (e.g., after seek or initial load)
        // Ensure playbackTime is respected if resuming/seeking,
        // otherwise it will be 0 for a fresh play.
        Tone.Transport.seconds = playbackTime;
        if (!scheduleNotesForGlobalPlayer()) {
            setPlayerError("Failed to schedule notes.");
            return;
        }
      }
      // If paused, Tone.Transport.seconds is already at the paused position.
      // If forcePlay, we ensure it starts regardless of current isPlaying state.
      Tone.Transport.start();
      setIsPlaying(true);
    }
  }, [currentPlayingMidi, isMidiDataLoaded, isPianoSamplerReady, playbackTime, scheduleNotesForGlobalPlayer]);


  const seekPlayer = useCallback(async (time) => {
    if (!currentPlayingMidi || !isMidiDataLoaded || !parsedMidiFileRef.current || !isPianoSamplerReady || durationTotal <= 0) return;
    
    const audioContextNowReady = await startToneAudioContext();
    if (!audioContextNowReady) return;

    const newTime = Math.max(0, Math.min(time, durationTotal));
    setPlaybackTime(newTime);

    const wasPlaying = isPlaying;
    if (wasPlaying) Tone.Transport.pause();
    
    // Release any sounding notes
    if (pianoRef.current) {
        for (let i = 21; i <= 108; i++) pianoRef.current.keyUp({ midi: i, time: Tone.now() });
    }

    // Clear and reschedule
    scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
    scheduledEventsRef.current = [];
    Tone.Transport.cancel();
    
    if (!scheduleNotesForGlobalPlayer()) {
        setPlayerError("Failed to reschedule after seek.");
        if(wasPlaying) setIsPlaying(false);
        return;
    }
    
    Tone.Transport.seconds = newTime;

    if (wasPlaying) Tone.Transport.start();

  }, [currentPlayingMidi, isMidiDataLoaded, isPianoSamplerReady, durationTotal, isPlaying, scheduleNotesForGlobalPlayer]);

  const togglePlayerMute = useCallback(async () => {
    if (!isPianoSamplerReady || !pianoRef.current) return;
    const audioContextNowReady = await startToneAudioContext();
    if (!audioContextNowReady) return;

    const newMuteState = !isMuted;
    if (pianoRef.current.volume) {
      pianoRef.current.volume.mute = newMuteState;
    }
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
    playMidi, // Expose this to trigger play from anywhere
    togglePlay: togglePlayControls, // Expose general toggle
    seekPlayer,
    togglePlayerMute,
    stopPlayer: cleanupCurrentMidiAudio, // Expose a way to stop fully
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};